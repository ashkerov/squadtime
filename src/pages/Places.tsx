import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ParticipantPicker } from '../components/ParticipantPicker';
import { Sheet } from '../components/Sheet';
import { showToast } from '../components/toastBus';
import { Button, Field } from '../components/ui';
import { inputClass } from '../components/styles';
import { mapLink } from '../domain/final';
import { weightedIndex } from '../domain/random';
import type { Place } from '../domain/schemas';
import { useActiveParticipant, useMeetingMutation } from '../hooks/meetings';
import type { PlaceSnapshot } from '../storage/MeetingRepository';
import { useMeetingContext } from './meetingContext';
import p from './Page.module.css';
import s from './Places.module.css';

export function Places() {
  const { meeting } = useMeetingContext();
  const { active, setActive } = useActiveParticipant(meeting);
  const [adding, setAdding] = useState(false);

  const vote = useMeetingMutation((repo, v: { placeId: string; participantId: string }) =>
    repo.toggleVote(meeting.id, v.placeId, v.participantId),
  );
  const restore = useMeetingMutation((repo, snap: PlaceSnapshot) =>
    repo.restorePlace(meeting.id, snap),
  );
  const remove = useMeetingMutation((repo, id: string) => repo.removePlace(meeting.id, id));

  const places = [...meeting.places].sort((a, b) => b.votes.length - a.votes.length);
  const authorName = (pl: Place) =>
    meeting.participants.find((x) => x.id === pl.addedBy)?.name ?? 'бывший участник';

  // «Пусть решит случай»: подсветка бегает по списку и останавливается на случайном месте.
  // Шанс места пропорционален лайкам + 1, чтобы и без лайков у всех был шанс.
  const [spin, setSpin] = useState<{ id: string; done: boolean } | null>(null);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const roll = () => {
    if (places.length < 2) return;
    window.clearTimeout(timer.current);
    const win = weightedIndex(places.map((x) => x.votes.length + 1));
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const steps = reduce ? 0 : places.length * 3 + win;
    let i = reduce ? win : 0;
    const tick = () => {
      const done = i >= steps;
      const place = places[i % places.length];
      setSpin({ id: place.id, done });
      if (done) {
        const liked = active ? place.votes.includes(active.id) : true;
        showToast({
          message: `🎲 Выпало: ${place.name}`,
          ...(active && !liked
            ? {
                actionLabel: 'Лайкнуть',
                onAction: () => vote.mutate({ placeId: place.id, participantId: active.id }),
              }
            : {}),
        });
        return;
      }
      i++;
      const progress = i / steps;
      timer.current = window.setTimeout(tick, 50 + progress * progress * 320);
    };
    tick();
  };

  const onRemove = (pl: Place) =>
    remove.mutate(pl.id, {
      onSuccess: (res) =>
        showToast({
          message: `Удалено: ${pl.name}`,
          actionLabel: 'Вернуть',
          onAction: () => restore.mutate(res.snapshot),
        }),
    });

  return (
    <div className={p.stack}>
      <div className={p.spread}>
        {meeting.participants.length > 0 && (
          <ParticipantPicker
            meeting={meeting}
            active={active}
            onSelect={setActive}
            prefix="Голосую как"
          />
        )}
        <Button variant="primary" onClick={() => setAdding(true)} disabled={!active}>
          + Предложить место
        </Button>
      </div>

      {!active && <p className={p.muted}>Чтобы предлагать места и ставить лайки, выберите себя.</p>}

      {places.length === 0 ? (
        <div className={p.empty}>
          <svg width="72" height="72" viewBox="0 0 72 72" aria-hidden="true">
            <circle cx="36" cy="36" r="34" fill="var(--surface-2)" />
            <path
              d="M36 18c-7 0-12 5-12 12 0 9 12 22 12 22s12-13 12-22c0-7-5-12-12-12z"
              fill="var(--accent)"
            />
            <circle cx="36" cy="30" r="4.5" fill="var(--surface)" />
          </svg>
          <p>Мест пока нет. Предложите кафе, бар или парк — остальные проголосуют лайками.</p>
        </div>
      ) : (
        <ul className={s.list}>
          {places.map((pl) => {
            const liked = active ? pl.votes.includes(active.id) : false;
            const link = mapLink(pl);
            const isFinal = meeting.final?.placeId === pl.id;
            return (
              <li
                key={pl.id}
                className={[
                  s.place,
                  isFinal && s.final,
                  spin?.id === pl.id && (spin.done ? s.winner : s.spinning),
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                <div className={s.info}>
                  <p className={s.name}>
                    {pl.name}
                    {isFinal && <span className={s.finalTag}> · выбрано</span>}
                  </p>
                  {pl.address && <p className={s.meta}>{pl.address}</p>}
                  <p className={s.meta}>
                    Предложение: {authorName(pl)}
                    {link && (
                      <>
                        {' · '}
                        <a href={link} target="_blank" rel="noopener noreferrer">
                          на карте
                        </a>
                      </>
                    )}
                  </p>
                </div>
                <button
                  type="button"
                  className={`${s.like} ${liked ? s.liked : ''}`}
                  aria-pressed={liked}
                  aria-label={`${liked ? 'Убрать лайк' : 'Лайк'}: ${pl.name}, сейчас ${pl.votes.length}`}
                  disabled={!active}
                  onClick={() =>
                    active && vote.mutate({ placeId: pl.id, participantId: active.id })
                  }
                >
                  <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
                    <path
                      d="M10 17s-6.5-4-6.5-8.5A3.5 3.5 0 0 1 10 6a3.5 3.5 0 0 1 6.5 2.5C16.5 13 10 17 10 17z"
                      fill={liked ? 'currentColor' : 'none'}
                      stroke="currentColor"
                      strokeWidth="1.6"
                    />
                  </svg>
                  <span>{pl.votes.length}</span>
                </button>
                <button
                  type="button"
                  className={s.remove}
                  aria-label={`Удалить ${pl.name}`}
                  title="Удалить"
                  onClick={() => onRemove(pl)}
                >
                  ×
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {places.length >= 2 && (
        <div className={s.dice}>
          <Button variant="ghost" onClick={roll} disabled={spin !== null && !spin.done}>
            🎲 Не можем выбрать — пусть решит случай
          </Button>
        </div>
      )}

      <Sheet open={adding} onClose={() => setAdding(false)} title="Предложить место">
        {active && (
          <AddPlaceForm
            meetingId={meeting.id}
            participantId={active.id}
            onDone={() => setAdding(false)}
          />
        )}
      </Sheet>
    </div>
  );
}

function AddPlaceForm({
  meetingId,
  participantId,
  onDone,
}: {
  meetingId: string;
  participantId: string;
  onDone: () => void;
}) {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [url, setUrl] = useState('');
  const [error, setError] = useState<string>();
  const add = useMeetingMutation((repo, v: { name: string; address: string; mapUrl: string }) =>
    repo.addPlace(meetingId, { ...v, addedBy: participantId }),
  );

  const submit = (e: FormEvent) => {
    e.preventDefault();
    let mapUrl = url.trim();
    if (mapUrl && !/^[a-z]+:\/\//i.test(mapUrl)) mapUrl = `https://${mapUrl}`;
    if (mapUrl && !mapUrl.startsWith('https://')) {
      setError('Ссылка должна начинаться с https://');
      return;
    }
    add.mutate(
      { name, address, mapUrl },
      { onSuccess: onDone, onError: (err) => setError((err as Error).message) },
    );
  };

  return (
    <form className={s.form} onSubmit={submit}>
      <Field label="Название" htmlFor="pl-name">
        <input
          id="pl-name"
          className={inputClass}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Например, бар «Луна»"
          maxLength={80}
          required
        />
      </Field>
      <Field label="Адрес" htmlFor="pl-address">
        <input
          id="pl-address"
          className={inputClass}
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Необязательно"
          maxLength={200}
        />
      </Field>
      <Field
        label="Ссылка на карту"
        htmlFor="pl-url"
        hint="Скопируйте ссылку «Поделиться» в Яндекс Картах или 2ГИС"
        error={error}
      >
        <input
          id="pl-url"
          className={inputClass}
          type="url"
          inputMode="url"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            setError(undefined);
          }}
          placeholder="https://yandex.ru/maps/…"
        />
      </Field>
      <Button type="submit" variant="primary" block disabled={!name.trim() || add.isPending}>
        Добавить
      </Button>
    </form>
  );
}
