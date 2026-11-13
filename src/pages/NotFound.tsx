import { TopBar } from '../components/TopBar';
import { ButtonLink } from '../components/ui';
import p from './Page.module.css';

export function NotFound() {
  return (
    <main className={p.page}>
      <TopBar back="/" title="Встреча не найдена" />
      <div className={p.empty}>
        <svg width="96" height="96" viewBox="0 0 96 96" aria-hidden="true">
          <circle cx="48" cy="48" r="40" fill="var(--surface-2)" />
          <path
            d="M36 40h.01M60 40h.01M34 64c4-6 9-8 14-8s10 2 14 8"
            stroke="var(--text-muted)"
            strokeWidth="5"
            strokeLinecap="round"
            fill="none"
          />
        </svg>
        <p>
          Такой встречи нет на этом устройстве. Возможно, её удалили или она хранится в другом
          браузере — попросите файл .meet.json и сделайте импорт.
        </p>
        <ButtonLink to="/" variant="primary">
          На главную
        </ButtonLink>
      </div>
    </main>
  );
}
