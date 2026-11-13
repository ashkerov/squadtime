import { Link, useNavigate } from 'react-router-dom';
import { AvatarStack } from '../components/Avatar';
import { ImportButton } from '../components/ImportButton';
import { MeetingMenu } from '../components/MeetingMenu';
import { ThemeToggle } from '../components/ThemeToggle';
import { TopBar } from '../components/TopBar';
import { Badge, Button, ButtonLink } from '../components/ui';
import { getFinalInfo, whenLabel } from '../domain/final';
import { meetingStatus, STATUS_LABEL, type MeetingStatus } from '../domain/meetings';
import type { Meeting } from '../domain/schemas';
import { formatDateRange, formatDayShort } from '../domain/slots';
import { useCreateDemo, useMeetings } from '../hooks/meetings';
import p from './Page.module.css';
import s from './Home.module.css';

const TONE: Record<MeetingStatus, 'accent' | 'success' | 'muted'> = {
  collecting: 'accent',
  fixed: 'success',
  past: 'muted',
};

export function Home() {
  const { data: meetings = [], isLoading } = useMeetings();
  const navigate = useNavigate();
  const demo = useCreateDemo();
  const now = new Date();

  const sorted = [...meetings].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const active = sorted.filter((m) => meetingStatus(m, now) !== 'past');
  const past = sorted.filter((m) => meetingStatus(m, now) === 'past');

  const createDemo = () =>
    demo.mutate(undefined, { onSuccess: (m) => navigate(`/m/${m.id}/results`) });

  return (
    <main className={`${p.page} ${p.wide}`}>
      <TopBar
        title={
          <span className={s.logo}>
            <LogoMark /> SquadTime
          </span>
        }
        actions={
          <>
            <ThemeToggle />
            <ImportButton variant="ghost" />
          </>
        }
      />

      {isLoading ? null : meetings.length === 0 ? (
        <div className={p.empty}>
          <EmptyIllustration />
          <h2 className={s.emptyTitle}>Создайте первую встречу</h2>
          <p>
            Отметьте, когда всем удобно, — сайт сам найдёт лучшее время. Всё хранится только в этом
            браузере.
          </p>
          <div className={s.emptyActions}>
            <ButtonLink to="/new" variant="primary">
              + Новая встреча
            </ButtonLink>
            <Button variant="ghost" onClick={createDemo} disabled={demo.isPending}>
              Посмотреть пример
            </Button>
          </div>
        </div>
      ) : (
        <div className={p.stack}>
          <div className={p.row}>
            <ButtonLink to="/new" variant="primary">
              + Новая встреча
            </ButtonLink>
          </div>
          {active.length > 0 && (
            <section className={p.stack} aria-label="Активные встречи">
              <h2 className={p.sectionTitle}>Активные</h2>
              <div className={s.cards}>
                {active.map((m) => (
                  <MeetingCard key={m.id} meeting={m} now={now} />
                ))}
              </div>
            </section>
          )}
          {past.length > 0 && (
            <section className={p.stack} aria-label="Прошедшие встречи">
              <h2 className={p.sectionTitle}>Прошедшие</h2>
              <div className={s.cards}>
                {past.map((m) => (
                  <MeetingCard key={m.id} meeting={m} now={now} />
                ))}
              </div>
            </section>
          )}
          <div className={s.footer}>
            <Button variant="ghost" small onClick={createDemo} disabled={demo.isPending}>
              Создать пример
            </Button>
          </div>
        </div>
      )}
    </main>
  );
}

function MeetingCard({ meeting, now }: { meeting: Meeting; now: Date }) {
  const status = meetingStatus(meeting, now);
  const info = getFinalInfo(meeting);
  const to = meeting.final ? `/m/${meeting.id}/final` : `/m/${meeting.id}`;
  return (
    <article className={s.card}>
      <Link to={to} className={s.cardLink}>
        <div className={s.cardHead}>
          <h3 className={s.cardTitle}>{meeting.title}</h3>
          <Badge tone={TONE[status]}>{STATUS_LABEL[status]}</Badge>
        </div>
        <p className={s.cardMeta}>
          {info
            ? `${formatDayShort(info.date)} · ${info.timeRange}${info.place ? ` · ${info.place.name}` : ''}`
            : formatDateRange(meeting.dates)}
        </p>
        {meeting.participants.length > 0 ? (
          <div className={s.cardFoot}>
            <AvatarStack names={meeting.participants.map((x) => x.name)} />
            {status === 'fixed' ? (
              <span className={s.when}>{whenLabel(meeting, now)}</span>
            ) : status === 'collecting' ? (
              <Progress
                done={
                  meeting.participants.filter(
                    (x) => Object.keys(meeting.availability[x.id] ?? {}).length > 0,
                  ).length
                }
                total={meeting.participants.length}
              />
            ) : null}
          </div>
        ) : (
          <p className={s.cardMeta}>Пока без участников</p>
        )}
      </Link>
      <div className={s.cardMenu}>
        <MeetingMenu meeting={meeting} />
      </div>
    </article>
  );
}

function Progress({ done, total }: { done: number; total: number }) {
  return (
    <span className={s.progress} title={`Отметились ${done} из ${total}`}>
      <span className={s.progressBar} aria-hidden="true">
        <span style={{ width: `${(done / total) * 100}%` }} />
      </span>
      <span className={s.progressText}>
        {done} из {total}
      </span>
    </span>
  );
}

function LogoMark() {
  return (
    <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true">
      <rect x="1" y="1" width="24" height="24" rx="7" fill="var(--accent)" />
      <rect x="6" y="7" width="4" height="4" rx="1.2" fill="var(--accent-contrast)" />
      <rect
        x="11"
        y="7"
        width="4"
        height="4"
        rx="1.2"
        fill="var(--accent-contrast)"
        opacity=".55"
      />
      <rect x="16" y="7" width="4" height="4" rx="1.2" fill="var(--accent-contrast)" />
      <rect
        x="6"
        y="12"
        width="4"
        height="4"
        rx="1.2"
        fill="var(--accent-contrast)"
        opacity=".55"
      />
      <rect x="11" y="12" width="4" height="4" rx="1.2" fill="var(--accent-contrast)" />
      <rect x="16" y="12" width="4" height="4" rx="1.2" fill="var(--accent-contrast)" />
      <rect
        x="11"
        y="17"
        width="4"
        height="4"
        rx="1.2"
        fill="var(--accent-contrast)"
        opacity=".55"
      />
    </svg>
  );
}

function EmptyIllustration() {
  const cells = [
    [0, 1, 1, 0, 0],
    [1, 2, 2, 1, 0],
    [0, 2, 2, 2, 1],
    [0, 1, 2, 1, 0],
  ];
  return (
    <svg
      width="200"
      height="150"
      viewBox="0 0 200 150"
      aria-hidden="true"
      className={s.illustration}
    >
      <rect
        x="10"
        y="6"
        width="180"
        height="138"
        rx="18"
        fill="var(--surface)"
        stroke="var(--border)"
      />
      {cells.map((row, r) =>
        row.map((v, c) => (
          <rect
            key={`${r}-${c}`}
            x={26 + c * 31}
            y={26 + r * 28}
            width="27"
            height="22"
            rx="6"
            fill={v === 0 ? 'var(--surface-2)' : 'var(--accent)'}
            opacity={v === 1 ? 0.45 : 1}
          />
        )),
      )}
      <rect
        x="54"
        y="52"
        width="89"
        height="72"
        rx="8"
        fill="none"
        stroke="var(--text)"
        strokeWidth="2.5"
      />
    </svg>
  );
}
