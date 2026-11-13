import { formatMinutes } from '../domain/slots';
import s from './DualRange.module.css';

/** Двойной слайдер часов: шаг 30 минут, минимум 1 час между ползунками. */
export function DualRange({
  start,
  end,
  onChange,
  min = 0,
  max = 1440,
  step = 30,
  minGap = 60,
}: {
  start: number;
  end: number;
  onChange: (start: number, end: number) => void;
  min?: number;
  max?: number;
  step?: number;
  minGap?: number;
}) {
  const pct = (v: number) => ((v - min) / (max - min)) * 100;
  return (
    <div className={s.root}>
      <div className={s.values} aria-hidden="true">
        <span>{formatMinutes(start)}</span>
        <span className={s.dash}>—</span>
        <span>{formatMinutes(end)}</span>
      </div>
      <div className={s.track}>
        <div
          className={s.fill}
          style={{
            left: `calc(14px + (100% - 28px) * ${pct(start) / 100})`,
            right: `calc(14px + (100% - 28px) * ${1 - pct(end) / 100})`,
          }}
          aria-hidden="true"
        />
        <input
          type="range"
          className={s.input}
          min={min}
          max={max}
          step={step}
          value={start}
          aria-label="Начало дня"
          aria-valuetext={formatMinutes(start)}
          onChange={(e) => onChange(Math.min(Number(e.target.value), end - minGap), end)}
        />
        <input
          type="range"
          className={s.input}
          min={min}
          max={max}
          step={step}
          value={end}
          aria-label="Конец дня"
          aria-valuetext={formatMinutes(end)}
          onChange={(e) => onChange(start, Math.max(Number(e.target.value), start + minGap))}
        />
      </div>
      <div className={s.scale} aria-hidden="true">
        <span>00:00</span>
        <span>06:00</span>
        <span>12:00</span>
        <span>18:00</span>
        <span>24:00</span>
      </div>
    </div>
  );
}
