import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import s from './TopBar.module.css';

export function TopBar({
  title,
  back,
  actions,
  subtitle,
}: {
  title: ReactNode;
  back?: string;
  actions?: ReactNode;
  subtitle?: ReactNode;
}) {
  return (
    <header className={s.bar}>
      {back && (
        <Link to={back} className={s.back} aria-label="Назад">
          <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
            <path
              d="M14 4l-7 7 7 7"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </Link>
      )}
      <div className={s.titles}>
        <h1 className={s.title}>{title}</h1>
        {subtitle && <p className={s.subtitle}>{subtitle}</p>}
      </div>
      {actions && <div className={s.actions}>{actions}</div>}
    </header>
  );
}
