import { NavLink, Outlet, useMatch, useNavigate, useParams } from 'react-router-dom';
import { MeetingMenu } from '../components/MeetingMenu';
import { ThemeToggle } from '../components/ThemeToggle';
import { TopBar } from '../components/TopBar';
import { deviceTimezone, formatDateRange } from '../domain/slots';
import { useMeeting } from '../hooks/meetings';
import type { MeetingCtx as Ctx } from './meetingContext';
import { NotFound } from './NotFound';
import p from './Page.module.css';
import s from './MeetingLayout.module.css';

/** Общая обёртка экранов встречи: шапка с меню «⋯» и вкладки. */
export function MeetingLayout() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { data: meeting, isLoading } = useMeeting(id);
  const isEdit = useMatch('/m/:id/edit');

  if (isLoading) return <main className={p.page} aria-busy="true" />;
  if (!meeting) return <NotFound />;
  if (isEdit) return <Outlet context={{ meeting } satisfies Ctx} />;

  const tzNote = meeting.timezone !== deviceTimezone() ? ` · время: ${meeting.timezone}` : '';

  return (
    <main className={`${p.page} ${p.wide}`}>
      <TopBar
        back="/"
        title={meeting.title}
        subtitle={`${formatDateRange(meeting.dates)}${tzNote}`}
        actions={
          <>
            <ThemeToggle />
            <MeetingMenu meeting={meeting} afterDelete={() => navigate('/')} />
          </>
        }
      />
      <nav className={s.tabs} aria-label="Разделы встречи">
        <NavLink end to={`/m/${meeting.id}`} className={tabClass}>
          Отметки
        </NavLink>
        <NavLink to={`/m/${meeting.id}/results`} className={tabClass}>
          Результаты
        </NavLink>
        <NavLink to={`/m/${meeting.id}/places`} className={tabClass}>
          Места
          {meeting.places.length > 0 && <span className={s.count}>{meeting.places.length}</span>}
        </NavLink>
        <NavLink to={`/m/${meeting.id}/final`} className={tabClass}>
          Итог{meeting.final && <span className={s.dot} aria-label="зафиксирована" />}
        </NavLink>
      </nav>
      <Outlet context={{ meeting } satisfies Ctx} />
    </main>
  );
}

function tabClass({ isActive }: { isActive: boolean }) {
  return `${s.tab} ${isActive ? s.active : ''}`;
}
