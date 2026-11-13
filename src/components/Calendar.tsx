import { useState } from 'react';
import { MAX_DAYS } from '../domain/schemas';
import { addDays, formatDayShort, MONTHS_NOM, pad2, WEEKDAYS_MON_FIRST } from '../domain/slots';
import s from './Calendar.module.css';

/** Календарь с выбором отдельных дней (до 14). */
export function Calendar({
  selected,
  onChange,
  today,
}: {
  selected: string[];
  onChange: (dates: string[]) => void;
  today: string;
}) {
  const first = [...selected].sort()[0] ?? today;
  const [month, setMonth] = useState(() => first.slice(0, 7)); // YYYY-MM
  const [y, m] = month.split('-').map(Number);

  const shift = (delta: number) => {
    const d = new Date(Date.UTC(y, m - 1 + delta, 1));
    setMonth(`${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}`);
  };

  const firstDay = `${month}-01`;
  const offset = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7; // понедельник — первый
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const cells: (string | null)[] = [
    ...Array.from({ length: offset }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => addDays(firstDay, i)),
  ];
  const set = new Set(selected);
  const full = selected.length >= MAX_DAYS;

  const toggle = (date: string) => {
    if (set.has(date)) onChange(selected.filter((d) => d !== date));
    else if (!full) onChange([...selected, date].sort());
  };

  return (
    <div className={s.root}>
      <div className={s.head}>
        <button
          type="button"
          className={s.nav}
          onClick={() => shift(-1)}
          aria-label="Предыдущий месяц"
          disabled={month <= (first < today ? first : today).slice(0, 7)}
        >
          ‹
        </button>
        <span className={s.title} aria-live="polite">
          {MONTHS_NOM[m - 1]} {y}
        </span>
        <button
          type="button"
          className={s.nav}
          onClick={() => shift(1)}
          aria-label="Следующий месяц"
        >
          ›
        </button>
      </div>
      <div className={s.grid} role="group" aria-label="Дни месяца">
        {WEEKDAYS_MON_FIRST.map((w) => (
          <span key={w} className={s.wd} aria-hidden="true">
            {w}
          </span>
        ))}
        {cells.map((date, i) => {
          if (!date) return <span key={`e${i}`} />;
          const past = date < today && !set.has(date);
          const on = set.has(date);
          return (
            <button
              key={date}
              type="button"
              className={`${s.day} ${on ? s.on : ''} ${date === today ? s.today : ''}`}
              aria-pressed={on}
              aria-label={formatDayShort(date)}
              disabled={past || (!on && full)}
              onClick={() => toggle(date)}
            >
              {Number(date.slice(8))}
            </button>
          );
        })}
      </div>
      <p className={s.note}>
        Выбрано {selected.length} из {MAX_DAYS} дней
      </p>
    </div>
  );
}
