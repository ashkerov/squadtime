import { useEffect, useMemo, useRef, useState } from 'react';
import { Avatar } from '../components/Avatar';
import { Menu, type MenuItem } from '../components/Menu';
import { ParticipantPicker, PickList } from '../components/ParticipantPicker';
import { TimeGrid } from '../components/TimeGrid';
import { showToast } from '../components/toastBus';
import { Button, ButtonLink, Chip, Segmented } from '../components/ui';
import { copyDayToAll, dayHasMarks, othersCount, type Marks } from '../domain/marks';
import type { SlotStatus } from '../domain/schemas';
import { weekdayShort } from '../domain/slots';
import { useActiveParticipant, useSaveAvailability } from '../hooks/meetings';
import { useGrid } from '../hooks/useGrid';
import { useNow } from '../hooks/useNow';
import { useMeetingContext } from './meetingContext';
import p from './Page.module.css';
import s from './Mark.module.css';

const EMPTY: Marks = {};
const MAX_HISTORY = 50;

function isTyping(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  return Boolean(el?.closest('input, textarea, select, [contenteditable="true"]'));
}

/** Главный экран: выбрать себя → провести пальцем → готово. Сохранение автоматическое. */
export function Mark() {
  const { meeting } = useMeetingContext();
  const { active, setActive } = useActiveParticipant(meeting);
  const [mode, setMode] = useState<SlotStatus>('yes');
  const [showOthers, setShowOthers] = useState(true);
  const save = useSaveAvailability(meeting.id);
  const grid = useGrid(meeting);
  const nowMs = useNow();

  const value = active ? (meeting.availability[active.id] ?? EMPTY) : EMPTY;

  // История для «Отменить»: своя у каждого участника.
  const [history, setHistory] = useState<{ pid?: string; stack: Marks[] }>({ stack: [] });
  const stack = history.pid === active?.id ? history.stack : [];
  const lastRef = useRef<Marks>(value);
  useEffect(() => {
    lastRef.current = value;
  }, [value]);

  const apply = (next: Marks) => {
    if (!active) return;
    const prev = lastRef.current;
    setHistory((h) => ({
      pid: active.id,
      stack: [...(h.pid === active.id ? h.stack : []), prev].slice(-MAX_HISTORY),
    }));
    lastRef.current = next;
    save.mutate({ participantId: active.id, slots: next });
  };

  const undo = () => {
    const prev = stack.at(-1);
    if (!active || !prev) return;
    setHistory({ pid: active.id, stack: stack.slice(0, -1) });
    lastRef.current = prev;
    save.mutate({ participantId: active.id, slots: prev });
  };

  // Горячие клавиши: 1 — «Могу», 2 — «Если нужно», Ctrl/⌘+Z — отменить.
  const undoRef = useRef(undo);
  useEffect(() => {
    undoRef.current = undo;
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target) || document.querySelector('[role="dialog"]')) return;
      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ' && !e.shiftKey) {
        e.preventDefault();
        undoRef.current();
      } else if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        if (e.key === '1') setMode('yes');
        if (e.key === '2') setMode('maybe');
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const hints = useMemo(
    () => (showOthers ? othersCount(meeting.availability, active?.id) : undefined),
    [showOthers, meeting.availability, active?.id],
  );

  const marked = meeting.participants.filter(
    (x) => Object.keys(meeting.availability[x.id] ?? {}).length > 0,
  );
  const hasMarks = Object.keys(value).length > 0;
  const firstMarkedDay = grid.days.findIndex((_, d) => dayHasMarks(grid, value, d));

  const dayLabel = firstMarkedDay >= 0 ? weekdayShort(grid.days[firstMarkedDay].date) : '';
  // «Вернуть» в тосте вызывает актуальную версию undo — история к тому моменту уже другая.
  const undoLatest = () => undoRef.current();
  const repeatDay = () => {
    apply(copyDayToAll(grid, value, firstMarkedDay, nowMs));
    showToast({
      message: `Отметки ${dayLabel} скопированы на все дни`,
      actionLabel: 'Отменить',
      onAction: undoLatest,
    });
  };
  const clearAll = () => {
    apply({});
    showToast({ message: 'Отметки очищены', actionLabel: 'Вернуть', onAction: undoLatest });
  };
  const tools: MenuItem[] = [
    ...(firstMarkedDay >= 0 && grid.days.length > 1
      ? [{ label: `Повторить ${dayLabel} на все дни`, onSelect: repeatDay }]
      : []),
    ...(hasMarks ? [{ label: 'Очистить мои отметки', danger: true, onSelect: clearAll }] : []),
  ];

  return (
    <div className={p.stack}>
      {meeting.participants.length === 0 ? (
        <div className={p.callout}>
          <h2 className={s.calloutTitle}>Кто отмечается первым?</h2>
          <p className={p.muted}>Добавьте своё имя — потом остальные добавят себя сами.</p>
          <div className={s.calloutBody}>
            <PickList meeting={meeting} onPick={setActive} />
          </div>
        </div>
      ) : (
        <div className={s.controls}>
          <ParticipantPicker meeting={meeting} active={active} onSelect={setActive} />
          <Segmented
            label="Какой статус ставить (клавиши 1 и 2)"
            value={mode}
            onChange={setMode}
            options={[
              {
                value: 'yes',
                label: (
                  <>
                    <span className={s.swYes} aria-hidden="true" />
                    Могу
                  </>
                ),
              },
              {
                value: 'maybe',
                label: (
                  <>
                    <span className={s.swMaybe} aria-hidden="true" />
                    Если нужно
                  </>
                ),
              },
            ]}
          />
        </div>
      )}

      {active && (
        <div className={s.toolbar}>
          {marked.some((x) => x.id !== active.id) && (
            <Chip
              selected={showOthers}
              onClick={() => setShowOthers((v) => !v)}
              className={s.toolChip}
              title="Цифры в ячейках — сколько других уже отметили это время"
            >
              👥 Другие
            </Chip>
          )}
          <Button
            variant="ghost"
            small
            onClick={undo}
            disabled={stack.length === 0}
            title="Отменить (Ctrl+Z)"
          >
            ↶ Отменить
          </Button>
          <span className={s.spacer} />
          {/* onSelect — обработчики кликов: ref читается только по нажатию, не при рендере */}
          {/* eslint-disable-next-line react-hooks/refs */}
          {tools.length > 0 && <Menu items={tools} label="Инструменты отметок" />}
        </div>
      )}

      <p className={p.muted}>
        {active
          ? showOthers && marked.some((x) => x.id !== active.id)
            ? 'Проведите по ячейкам — отметки сохраняются сами. Цифры — сколько других уже могут в это время.'
            : 'Проведите по ячейкам — отметки сохраняются сами. Повторное касание снимает отметку, тап по дню — весь день.'
          : 'Чтобы отмечать, выберите себя вверху.'}
      </p>

      <TimeGrid
        grid={grid}
        value={value}
        mode={mode}
        disabled={!active}
        nowMs={nowMs}
        hints={hints}
        onChange={apply}
        overlay={
          !active && meeting.participants.length > 0 ? (
            <div className={s.overlay}>
              <ParticipantPicker
                meeting={meeting}
                active={null}
                onSelect={setActive}
                prefix="Сначала"
              />
            </div>
          ) : undefined
        }
      />

      <div className={p.stickyBottom}>
        <div className={s.who}>
          {marked.length > 0 ? (
            <>
              <span className={s.avatars}>
                {marked.slice(0, 4).map((x) => (
                  <Avatar key={x.id} name={x.name} size={28} ring />
                ))}
              </span>
              <span className={s.count}>
                {marked.length} из {meeting.participants.length}
              </span>
            </>
          ) : (
            <span className={p.muted}>Пока никто не отметился</span>
          )}
        </div>
        <ButtonLink to={`/m/${meeting.id}/results`} variant="primary">
          Смотреть результаты
        </ButtonLink>
      </div>
    </div>
  );
}
