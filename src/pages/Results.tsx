import { useMemo, useState } from 'react';
import { Avatar } from '../components/Avatar';
import { FixSheet } from '../components/FixSheet';
import { Heatmap } from '../components/Heatmap';
import { Sheet } from '../components/Sheet';
import { Button, ButtonLink } from '../components/ui';
import { namesOf } from '../domain/final';
import { findBestSlots, whoInSlot, type BestOption } from '../domain/findBestSlots';
import type { Id } from '../domain/schemas';
import { dayInTz, formatDayShort, plural, SLOT_MS, timeInTz } from '../domain/slots';
import { useGrid } from '../hooks/useGrid';
import { useMeetingContext } from './meetingContext';
import p from './Page.module.css';
import s from './Results.module.css';

export function Results() {
  const { meeting } = useMeetingContext();
  const grid = useGrid(meeting);
  const options = useMemo(() => findBestSlots(meeting), [meeting]);
  const [fixing, setFixing] = useState<BestOption | null>(null);
  const [slot, setSlot] = useState<string | null>(null);
  const tz = meeting.timezone;
  const total = meeting.participants.length;
  const responded = meeting.participants.filter(
    (x) => Object.keys(meeting.availability[x.id] ?? {}).length > 0,
  );
  const requiredBlocking = meeting.participants.filter(
    (x) => x.isRequired && responded.includes(x),
  );

  return (
    <div className={p.stack}>
      {meeting.final && (
        <div className={p.callout}>
          <div className={p.spread}>
            <span>
              <strong>Зафиксировано:</strong> {formatDayShort(dayInTz(meeting.final.start, tz))},{' '}
              {timeInTz(meeting.final.start, tz)}
            </span>
            <ButtonLink to={`/m/${meeting.id}/final`} small variant="ghost">
              Итог →
            </ButtonLink>
          </div>
        </div>
      )}

      <section className={p.stack} aria-labelledby="top-title">
        <h2 id="top-title" className={p.sectionTitle}>
          Лучшее время
        </h2>
        {responded.length === 0 ? (
          <div className={s.emptyCard}>
            <p>
              Пока никто не отметился. Как только появятся отметки, здесь будут три лучших варианта.
            </p>
            <ButtonLink to={`/m/${meeting.id}`} variant="primary">
              Отметиться
            </ButtonLink>
          </div>
        ) : options.length === 0 ? (
          <div className={s.emptyCard}>
            <p>
              Нет интервала длиной {meeting.durationMin / 60} ч, где совпадают отметки
              {requiredBlocking.length > 0
                ? ` обязательных участников (${requiredBlocking.map((x) => x.name).join(', ')})`
                : ''}
              . Попробуйте уменьшить длительность или расширить даты.
            </p>
            <ButtonLink to={`/m/${meeting.id}/edit`}>Изменить настройки</ButtonLink>
          </div>
        ) : (
          <ol className={s.options}>
            {options.map((o, i) => (
              <OptionCard
                key={o.start}
                option={o}
                rank={i}
                tz={tz}
                total={total}
                names={(ids) => namesOf(meeting, ids)}
                onPick={() => setFixing(o)}
              />
            ))}
          </ol>
        )}
      </section>

      <section className={p.stack} aria-labelledby="heat-title">
        <div className={p.spread}>
          <h2 id="heat-title" className={p.sectionTitle}>
            Тепловая карта
          </h2>
          <Legend />
        </div>
        <Heatmap
          grid={grid}
          meeting={meeting}
          best={options[0]}
          selectedKey={slot ?? undefined}
          onSelect={setSlot}
        />
        <p className={p.muted}>
          Отметились {responded.length} из {total}. Нажмите на ячейку, чтобы увидеть, кто может.
        </p>
      </section>

      <SlotSheet slotKey={slot} onClose={() => setSlot(null)} />
      <FixSheet meeting={meeting} option={fixing} onClose={() => setFixing(null)} />
    </div>
  );
}

function OptionCard({
  option,
  rank,
  tz,
  total,
  names,
  onPick,
}: {
  option: BestOption;
  rank: number;
  tz: string;
  total: number;
  names: (ids: Id[]) => string[];
  onPick: () => void;
}) {
  const going = option.yes.length + option.maybe.length;
  const merged = option.starts.length > 1;
  const cant = names(option.no);
  const maybe = names(option.maybe);
  const silent = names(option.noResponse);
  return (
    <li className={`${s.option} ${rank === 0 ? s.first : ''}`}>
      <div className={s.optionMain}>
        <p className={s.optionTitle}>
          {formatDayShort(option.date)} · {timeInTz(option.start, tz)}–{timeInTz(option.end, tz)}
        </p>
        <p className={s.optionCount}>
          <strong>
            {going} из {total}
          </strong>
          {cant.length > 0 && (
            <span>
              , не {cant.length === 1 ? 'сможет' : 'смогут'} {cant.join(', ')}
            </span>
          )}
        </p>
        {merged && (
          <p className={s.optionNote}>
            Начать можно с {timeInTz(option.start, tz)} до {timeInTz(option.latestStart, tz)}
          </p>
        )}
        {maybe.length > 0 && <p className={s.optionNote}>Если нужно: {maybe.join(', ')}</p>}
        {silent.length > 0 && (
          <p className={s.optionNote}>Ещё не отметились: {silent.join(', ')}</p>
        )}
      </div>
      <Button variant={rank === 0 ? 'primary' : 'secondary'} onClick={onPick}>
        Выбрать
      </Button>
    </li>
  );
}

function Legend() {
  return (
    <div className={s.legend} aria-label="Легенда: доля участников">
      <span>0%</span>
      {[0, 1, 2, 3, 4].map((l) => (
        <span key={l} className={`${s.legendCell} ${s[`l${l}`]}`} aria-hidden="true" />
      ))}
      <span>100%</span>
    </div>
  );
}

function SlotSheet({ slotKey, onClose }: { slotKey: string | null; onClose: () => void }) {
  const { meeting } = useMeetingContext();
  const tz = meeting.timezone;
  if (!slotKey)
    return (
      <Sheet open={false} onClose={onClose} title="">
        {null}
      </Sheet>
    );
  const who = whoInSlot(meeting, slotKey);
  const end = Date.parse(slotKey) + SLOT_MS;
  const groups: { title: string; ids: Id[] }[] = [
    { title: 'Могут', ids: who.yes },
    { title: 'Если нужно', ids: who.maybe },
    { title: 'Не могут', ids: who.no },
    { title: 'Ещё не отметились', ids: who.noResponse },
  ];
  const n = who.yes.length + who.maybe.length;
  return (
    <Sheet
      open
      onClose={onClose}
      title={`${formatDayShort(dayInTz(slotKey, tz))}, ${timeInTz(slotKey, tz)}–${timeInTz(end, tz)}`}
    >
      <p className={p.muted}>
        {n} {plural(n, ['человек', 'человека', 'человек'])} из {meeting.participants.length}
      </p>
      <div className={s.groups}>
        {groups
          .filter((g) => g.ids.length > 0)
          .map((g) => (
            <div key={g.title}>
              <h3 className={p.sectionTitle}>{g.title}</h3>
              <ul className={s.people}>
                {namesOf(meeting, g.ids).map((name, i) => (
                  <li key={g.ids[i]}>
                    <Avatar name={name} size={28} />
                    {name}
                  </li>
                ))}
              </ul>
            </div>
          ))}
      </div>
    </Sheet>
  );
}
