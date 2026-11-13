import { useState } from 'react';
import { applyTheme, loadTheme, saveTheme, type ThemeChoice } from '../storage/preferences';
import s from './ThemeToggle.module.css';

const NEXT: Record<ThemeChoice, ThemeChoice> = { system: 'light', light: 'dark', dark: 'system' };
const LABEL: Record<ThemeChoice, string> = {
  system: 'Тема как в системе',
  light: 'Светлая тема',
  dark: 'Тёмная тема',
};

/** Переключатель темы: как в системе → светлая → тёмная. */
export function ThemeToggle() {
  const [choice, setChoice] = useState<ThemeChoice>(loadTheme);
  const next = NEXT[choice];
  return (
    <button
      type="button"
      className={s.btn}
      onClick={() => {
        setChoice(next);
        applyTheme(next);
        saveTheme(next);
      }}
      aria-label={`${LABEL[choice]}. Нажмите: ${LABEL[next].toLowerCase()}`}
      title={LABEL[choice]}
    >
      {choice === 'light' ? <Sun /> : choice === 'dark' ? <Moon /> : <Auto />}
    </button>
  );
}

const svg = { width: 20, height: 20, viewBox: '0 0 20 20', 'aria-hidden': true } as const;

function Sun() {
  return (
    <svg {...svg}>
      <circle cx="10" cy="10" r="3.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M10 2v2M10 16v2M2 10h2M16 10h2M4.3 4.3l1.4 1.4M14.3 14.3l1.4 1.4M4.3 15.7l1.4-1.4M14.3 5.7l1.4-1.4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function Moon() {
  return (
    <svg {...svg}>
      <path
        d="M16 12.5A6.5 6.5 0 0 1 7.5 4a6.5 6.5 0 1 0 8.5 8.5z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Auto() {
  return (
    <svg {...svg}>
      <circle cx="10" cy="10" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M10 3.5a6.5 6.5 0 0 1 0 13z" fill="currentColor" />
    </svg>
  );
}
