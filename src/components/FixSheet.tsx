import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { BestOption } from '../domain/findBestSlots';
import type { Meeting } from '../domain/schemas';
import { formatDayShort, timeInTz } from '../domain/slots';
import { useMeetingMutation } from '../hooks/meetings';
import { Sheet } from './Sheet';
import { Button, Chip } from './ui';
import s from './FixSheet.module.css';

/** Фиксация: выбор начала (если вариант склеен из нескольких) и места. */
export function FixSheet({
  meeting,
  option,
  onClose,
}: {
  meeting: Meeting;
  option: BestOption | null;
  onClose: () => void;
}) {
  return (
    <Sheet open={option !== null} onClose={onClose} title="Зафиксировать встречу">
      {option && <FixForm key={option.start} meeting={meeting} option={option} onDone={onClose} />}
    </Sheet>
  );
}

function FixForm({
  meeting,
  option,
  onDone,
}: {
  meeting: Meeting;
  option: BestOption;
  onDone: () => void;
}) {
  const navigate = useNavigate();
  const tz = meeting.timezone;
  const places = [...meeting.places].sort((a, b) => b.votes.length - a.votes.length);
  const [start, setStart] = useState(option.start);
  const [placeId, setPlaceId] = useState<string | undefined>(places[0]?.id);
  const fix = useMeetingMutation((repo, v: { start: string; placeId?: string }) =>
    repo.fix(meeting.id, v.start, v.placeId),
  );
  const endMs = Date.parse(start) + meeting.durationMin * 60_000;

  return (
    <form
      className={s.form}
      onSubmit={(e) => {
        e.preventDefault();
        fix.mutate(
          { start, placeId },
          {
            onSuccess: () => {
              onDone();
              navigate(`/m/${meeting.id}/final`);
            },
          },
        );
      }}
    >
      <div className={s.summary}>
        <span className={s.big}>{formatDayShort(option.date)}</span>
        <span className={s.big}>
          {timeInTz(start, tz)}–{timeInTz(endMs, tz)}
        </span>
      </div>

      {option.starts.length > 1 && (
        <fieldset className={s.group}>
          <legend className={s.legend}>Во сколько начинаем?</legend>
          <div className={s.chips}>
            {option.starts.map((st) => (
              <Chip key={st} selected={st === start} onClick={() => setStart(st)}>
                {timeInTz(st, tz)}
              </Chip>
            ))}
          </div>
        </fieldset>
      )}

      <fieldset className={s.group}>
        <legend className={s.legend}>Где?</legend>
        {places.length === 0 && (
          <p className={s.muted}>Мест пока нет — можно зафиксировать только время.</p>
        )}
        <div className={s.places}>
          {places.map((p) => (
            <label key={p.id} className={`${s.place} ${placeId === p.id ? s.placeOn : ''}`}>
              <input
                type="radio"
                name="place"
                checked={placeId === p.id}
                onChange={() => setPlaceId(p.id)}
              />
              <span className={s.placeName}>
                {p.name}
                {p.address && <span className={s.muted}> · {p.address}</span>}
              </span>
              <span className={s.votes}>♥ {p.votes.length}</span>
            </label>
          ))}
          {places.length > 0 && (
            <label className={`${s.place} ${placeId === undefined ? s.placeOn : ''}`}>
              <input
                type="radio"
                name="place"
                checked={placeId === undefined}
                onChange={() => setPlaceId(undefined)}
              />
              <span className={s.placeName}>Без места</span>
            </label>
          )}
        </div>
      </fieldset>

      <Button type="submit" variant="primary" block disabled={fix.isPending}>
        Зафиксировать
      </Button>
    </form>
  );
}
