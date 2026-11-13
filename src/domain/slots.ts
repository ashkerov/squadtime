import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import { SLOT_MIN, type Meeting } from './schemas';

/**
 * Слоты и часовые пояса. Все отметки хранятся по ключу «начало слота в UTC» (ISO-строка),
 * а сетка строится по «настенному» времени в часовом поясе встречи.
 */

export interface Slot {
  /** Начало слота в UTC, ISO-строка — ключ в availability. */
  key: string;
  /** То же в миллисекундах. */
  ms: number;
  /** День встречи (YYYY-MM-DD, в часовом поясе встречи). */
  date: string;
  /** Минуты от полуночи по настенным часам. */
  minute: number;
}

export interface GridDay {
  date: string;
  /** Ячейки по строкам сетки; null — такого времени нет (переход на летнее время). */
  cells: (Slot | null)[];
}

export interface Grid {
  /** Минуты начала каждой строки. */
  rows: number[];
  days: GridDay[];
}

export type GridSource = Pick<Meeting, 'dates' | 'dayStartMin' | 'dayEndMin' | 'timezone'>;

export const SLOT_MS = SLOT_MIN * 60_000;

export function slotKey(ms: number): string {
  return new Date(ms).toISOString();
}

export function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function formatMinutes(min: number): string {
  return `${pad2(Math.floor(min / 60))}:${pad2(min % 60)}`;
}

/** Переводит настенное время в часовом поясе в момент UTC. null — такого времени не существует. */
export function zonedToUtcMs(date: string, minute: number, timezone: string): number | null {
  if (minute >= 1440) {
    return zonedToUtcMs(addDays(date, 1), minute - 1440, timezone);
  }
  const local = `${date}T${formatMinutes(minute)}:00`;
  const ms = fromZonedTime(local, timezone).getTime();
  // Проверка обратным преобразованием: в «дыре» перехода на летнее время время не совпадёт.
  const back = formatInTimeZone(ms, timezone, "yyyy-MM-dd'T'HH:mm:ss");
  return back === local ? ms : null;
}

export function buildGrid(m: GridSource): Grid {
  const rows: number[] = [];
  for (let min = m.dayStartMin; min < m.dayEndMin; min += SLOT_MIN) rows.push(min);
  const dates = [...m.dates].sort();
  const days = dates.map((date) => ({
    date,
    cells: rows.map((minute) => {
      const ms = zonedToUtcMs(date, minute, m.timezone);
      return ms === null ? null : { key: slotKey(ms), ms, date, minute };
    }),
  }));
  return { rows, days };
}

/** Все существующие слоты встречи в хронологическом порядке. */
export function allSlots(grid: Grid): Slot[] {
  return grid.days.flatMap((d) => d.cells.filter((c): c is Slot => c !== null));
}

// ——— Даты как строки YYYY-MM-DD (без привязки к часовому поясу устройства) ———

function parseDay(date: string): [number, number, number] {
  const [y, m, d] = date.split('-').map(Number);
  return [y, m, d];
}

export function addDays(date: string, n: number): string {
  const [y, m, d] = parseDay(date);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}`;
}

/** Число дней от a до b (YYYY-MM-DD). */
export function daysBetween(a: string, b: string): number {
  const [y1, m1, d1] = parseDay(a);
  const [y2, m2, d2] = parseDay(b);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000);
}

/** 0 — воскресенье … 6 — суббота. */
export function weekday(date: string): number {
  const [y, m, d] = parseDay(date);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function todayIn(timezone: string, now: Date = new Date()): string {
  return formatInTimeZone(now, timezone, 'yyyy-MM-dd');
}

export function deviceTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Moscow';
}

export function dayInTz(iso: string | number, timezone: string): string {
  return formatInTimeZone(new Date(iso), timezone, 'yyyy-MM-dd');
}

export function timeInTz(iso: string | number, timezone: string): string {
  return formatInTimeZone(new Date(iso), timezone, 'HH:mm');
}

// ——— Русские подписи ———

const WEEKDAYS_SHORT = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
const WEEKDAYS_LONG = [
  'воскресенье',
  'понедельник',
  'вторник',
  'среда',
  'четверг',
  'пятница',
  'суббота',
];
const MONTHS_SHORT = [
  'янв',
  'фев',
  'мар',
  'апр',
  'мая',
  'июн',
  'июл',
  'авг',
  'сен',
  'окт',
  'ноя',
  'дек',
];
const MONTHS_GEN = [
  'января',
  'февраля',
  'марта',
  'апреля',
  'мая',
  'июня',
  'июля',
  'августа',
  'сентября',
  'октября',
  'ноября',
  'декабря',
];
export const MONTHS_NOM = [
  'Январь',
  'Февраль',
  'Март',
  'Апрель',
  'Май',
  'Июнь',
  'Июль',
  'Август',
  'Сентябрь',
  'Октябрь',
  'Ноябрь',
  'Декабрь',
];
export const WEEKDAYS_MON_FIRST = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

export function weekdayShort(date: string): string {
  return WEEKDAYS_SHORT[weekday(date)];
}

/** «Сб, 16 ноя» */
export function formatDayShort(date: string): string {
  const [, m, d] = parseDay(date);
  return `${weekdayShort(date)}, ${d} ${MONTHS_SHORT[m - 1]}`;
}

/** «суббота, 16 ноября» */
export function formatDayLong(date: string): string {
  const [, m, d] = parseDay(date);
  return `${WEEKDAYS_LONG[weekday(date)]}, ${d} ${MONTHS_GEN[m - 1]}`;
}

/** «15–21 ноя», «30 ноя – 3 дек», «16 ноя» */
export function formatDateRange(dates: string[]): string {
  if (dates.length === 0) return '';
  const sorted = [...dates].sort();
  const [, m1, d1] = parseDay(sorted[0]);
  const [, m2, d2] = parseDay(sorted[sorted.length - 1]);
  if (sorted.length === 1) return `${d1} ${MONTHS_SHORT[m1 - 1]}`;
  if (m1 === m2) return `${d1}–${d2} ${MONTHS_SHORT[m1 - 1]}`;
  return `${d1} ${MONTHS_SHORT[m1 - 1]} – ${d2} ${MONTHS_SHORT[m2 - 1]}`;
}

/** Число в правильной форме: plural(5, ['участник', 'участника', 'участников']) */
export function plural(n: number, forms: [string, string, string]): string {
  const n10 = n % 10;
  const n100 = n % 100;
  if (n10 === 1 && n100 !== 11) return forms[0];
  if (n10 >= 2 && n10 <= 4 && (n100 < 12 || n100 > 14)) return forms[1];
  return forms[2];
}
