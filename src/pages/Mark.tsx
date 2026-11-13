import { useState } from 'react';
import { Avatar } from '../components/Avatar';
import { ParticipantPicker, PickList } from '../components/ParticipantPicker';
import { TimeGrid } from '../components/TimeGrid';
import { ButtonLink, Segmented } from '../components/ui';
import type { SlotStatus } from '../domain/schemas';
import { useActiveParticipant, useSaveAvailability } from '../hooks/meetings';
import { useGrid } from '../hooks/useGrid';
import { useMeetingContext } from './meetingContext';
import p from './Page.module.css';
import s from './Mark.module.css';

const EMPTY = {};

/** Главный экран: выбрать себя → провести пальцем → готово. Сохранение автоматическое. */
export function Mark() {
  const { meeting } = useMeetingContext();
  const { active, setActive } = useActiveParticipant(meeting);
  const [mode, setMode] = useState<SlotStatus>('yes');
  const save = useSaveAvailability(meeting.id);

  const grid = useGrid(meeting);

  const marked = meeting.participants.filter(
    (x) => Object.keys(meeting.availability[x.id] ?? {}).length > 0,
  );
  const value = active ? (meeting.availability[active.id] ?? EMPTY) : EMPTY;

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
            label="Какой статус ставить"
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

      <p className={p.muted}>
        {active
          ? 'Проведите по ячейкам — отметки сохраняются сами. Повторное касание снимает отметку, тап по дню — весь день.'
          : 'Чтобы отмечать, выберите себя вверху.'}
      </p>

      <TimeGrid
        grid={grid}
        value={value}
        mode={mode}
        disabled={!active}
        onChange={(slots) => active && save.mutate({ participantId: active.id, slots })}
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
