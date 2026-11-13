import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Avatar } from '../components/Avatar';
import { Confetti } from '../components/Confetti';
import { showToast } from '../components/toastBus';
import { Button, ButtonLink, ExternalButton } from '../components/ui';
import {
  capitalize,
  chatText,
  getFinalInfo,
  mapLink,
  participantStatusAtFinal,
  whenLabel,
} from '../domain/final';
import { generateIcs, googleCalendarUrl, safeFileName } from '../domain/ics';
import type { Meeting, Participant } from '../domain/schemas';
import { formatDayLong } from '../domain/slots';
import { useMeetingMutation } from '../hooks/meetings';
import { useNow } from '../hooks/useNow';
import { copyText, downloadText } from '../lib/browser';
import { useMeetingContext } from './meetingContext';
import p from './Page.module.css';
import s from './Final.module.css';

export function Final() {
  const { meeting } = useMeetingContext();
  const info = getFinalInfo(meeting);
  const unfix = useMeetingMutation((repo) => repo.unfix(meeting.id));
  const restore = useMeetingMutation((repo, final: Meeting['final']) =>
    repo.restoreFinal(meeting.id, final),
  );
  const nowMs = useNow();
  const location = useLocation();
  const navigate = useNavigate();
  // Конфетти — только сразу после фиксации, не при каждом открытии и не после перезагрузки.
  const [celebrate] = useState(() =>
    Boolean((location.state as { celebrate?: boolean } | null)?.celebrate),
  );
  useEffect(() => {
    if (celebrate) navigate(location.pathname, { replace: true, state: null });
  }, [celebrate, navigate, location.pathname]);

  if (!info) {
    return (
      <div className={p.empty}>
        <svg width="72" height="72" viewBox="0 0 72 72" aria-hidden="true">
          <circle cx="36" cy="36" r="34" fill="var(--surface-2)" />
          <rect
            x="20"
            y="22"
            width="32"
            height="30"
            rx="5"
            fill="none"
            stroke="var(--accent)"
            strokeWidth="3"
          />
          <path
            d="M20 31h32M28 18v8M44 18v8"
            stroke="var(--accent)"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </svg>
        <p>Время ещё не выбрано. Откройте результаты и нажмите «Выбрать» у подходящего варианта.</p>
        <ButtonLink to={`/m/${meeting.id}/results`} variant="primary">
          К результатам
        </ButtonLink>
      </div>
    );
  }

  const link = mapLink(info.place);

  const downloadIcs = () => {
    downloadText(`${safeFileName(meeting.title)}.ics`, generateIcs(meeting), 'text/calendar');
    showToast('Откройте файл — встреча и напоминания за 24 и 2 часа добавятся в календарь');
  };

  const copy = async () => {
    const ok = await copyText(chatText(meeting));
    showToast(ok ? 'Текст скопирован — вставьте его в чат' : 'Не удалось скопировать');
  };

  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  const share = async () => {
    const data: ShareData = { title: meeting.title, text: chatText(meeting) };
    const file = new File([generateIcs(meeting)], `${safeFileName(meeting.title)}.ics`, {
      type: 'text/calendar',
    });
    if (navigator.canShare?.({ files: [file] })) data.files = [file];
    try {
      await navigator.share(data);
    } catch (e) {
      if ((e as Error).name !== 'AbortError') await copy();
    }
  };

  const when = whenLabel(meeting, new Date(nowMs));

  const cancel = () => {
    const prev = meeting.final;
    unfix.mutate(undefined, {
      onSuccess: () =>
        showToast({
          message: 'Фиксация отменена',
          actionLabel: 'Вернуть',
          onAction: () => restore.mutate(prev),
        }),
    });
  };

  return (
    <div className={s.layout}>
      {celebrate && <Confetti />}
      <div className={s.mainCol}>
        <section className={s.hero} aria-label="Итог встречи">
          <p className={s.kicker}>
            Встреча зафиксирована
            {when && <span className={s.when}>{when}</span>}
          </p>
          <p className={s.date}>{capitalize(formatDayLong(info.date))}</p>
          <p className={s.time}>{info.timeRange}</p>
          {info.place ? (
            <p className={s.place}>
              📍 {info.place.name}
              {info.place.address && <span className={s.address}>{info.place.address}</span>}
            </p>
          ) : (
            <p className={s.address}>Место не выбрано</p>
          )}
        </section>

        <div className={s.actions}>
          {canShare && (
            <Button variant="primary" onClick={() => void share()} className={s.wide}>
              Поделиться с друзьями
            </Button>
          )}
          <Button variant={canShare ? 'secondary' : 'primary'} onClick={downloadIcs}>
            Скачать .ics
          </Button>
          <ExternalButton href={googleCalendarUrl(meeting)}>В Google Календарь</ExternalButton>
          <Button onClick={() => void copy()}>Скопировать текст для чата</Button>
          {link ? (
            <ExternalButton href={link}>Открыть на карте</ExternalButton>
          ) : (
            <ButtonLink to={`/m/${meeting.id}/places`}>Выбрать место</ButtonLink>
          )}
        </div>
      </div>

      <div className={s.sideCol}>
        <section className={p.stack} aria-labelledby="rsvp-title">
          <h2 id="rsvp-title" className={p.sectionTitle}>
            Кто идёт · {info.going.length} из {meeting.participants.length}
          </h2>
          <ul className={s.people}>
            {meeting.participants.map((x) => (
              <RsvpRow key={x.id} meeting={meeting} participant={x} />
            ))}
          </ul>
          <p className={p.muted}>
            По умолчанию «идёт» — тот, у кого это время отмечено. Можно поправить вручную.
          </p>
        </section>

        <div className={s.danger}>
          <Button variant="danger" onClick={cancel} disabled={unfix.isPending}>
            Отменить фиксацию
          </Button>
        </div>
      </div>
    </div>
  );
}

function RsvpRow({ meeting, participant }: { meeting: Meeting; participant: Participant }) {
  const status = participantStatusAtFinal(meeting, participant);
  const set = useMeetingMutation((repo, v: { rsvp?: 'going' | 'not_going'; clear?: boolean }) =>
    repo.updateParticipant(meeting.id, participant.id, { rsvp: v.rsvp, clearRsvp: v.clear }),
  );
  const choose = (rsvp: 'going' | 'not_going') => {
    if (participant.rsvp === rsvp) set.mutate({ clear: true });
    else set.mutate({ rsvp });
  };
  return (
    <li className={s.person}>
      <Avatar name={participant.name} size={32} />
      <span className={s.personName}>
        {participant.name}
        {!participant.rsvp && status !== 'unknown' && (
          <span className={s.auto}> · по отметкам</span>
        )}
      </span>
      <div className={s.rsvp} role="group" aria-label={`Статус: ${participant.name}`}>
        <button
          type="button"
          aria-pressed={status === 'going'}
          className={`${s.rsvpBtn} ${status === 'going' ? s.going : ''}`}
          onClick={() => choose('going')}
        >
          Иду
        </button>
        <button
          type="button"
          aria-pressed={status === 'not_going'}
          className={`${s.rsvpBtn} ${status === 'not_going' ? s.notGoing : ''}`}
          onClick={() => choose('not_going')}
        >
          Не иду
        </button>
      </div>
    </li>
  );
}
