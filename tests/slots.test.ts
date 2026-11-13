import { describe, expect, it } from 'vitest';
import { nextWeekDates, weekendDates } from '../src/domain/meetings';
import {
  addDays,
  buildGrid,
  formatDateRange,
  formatDayShort,
  plural,
  timeInTz,
  zonedToUtcMs,
} from '../src/domain/slots';

describe('slots', () => {
  it('строит сетку с шагом 30 минут в часовом поясе встречи', () => {
    const grid = buildGrid({
      dates: ['2026-11-15', '2026-11-14'],
      dayStartMin: 600,
      dayEndMin: 1380,
      timezone: 'Europe/Moscow',
    });
    expect(grid.rows).toHaveLength(26);
    expect(grid.days.map((d) => d.date)).toEqual(['2026-11-14', '2026-11-15']);
    const first = grid.days[0].cells[0]!;
    expect(first.key).toBe('2026-11-14T07:00:00.000Z'); // 10:00 МСК = 07:00 UTC
  });

  it('несуществующее время при переходе на летнее время — пустая ячейка', () => {
    expect(zonedToUtcMs('2026-03-29', 150, 'Europe/Berlin')).toBeNull(); // 02:30
    const grid = buildGrid({
      dates: ['2026-03-29'],
      dayStartMin: 60,
      dayEndMin: 240,
      timezone: 'Europe/Berlin',
    });
    expect(grid.days[0].cells.map((c) => (c ? timeInTz(c.key, 'Europe/Berlin') : null))).toEqual([
      '01:00',
      '01:30',
      null,
      null,
      '03:00',
      '03:30',
    ]);
  });

  it('полночь в конце дня (24:00) переходит на следующий день', () => {
    expect(zonedToUtcMs('2026-11-14', 1440, 'Europe/Moscow')).toBe(
      Date.parse('2026-11-14T21:00:00.000Z'),
    );
  });

  it('подписи дат по-русски', () => {
    expect(formatDayShort('2026-11-14')).toBe('Сб, 14 ноя');
    expect(formatDateRange(['2026-11-15', '2026-11-21'])).toBe('15–21 ноя');
    expect(formatDateRange(['2026-11-30', '2026-12-03'])).toBe('30 ноя – 3 дек');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('склонения', () => {
    expect(plural(1, ['место', 'места', 'мест'])).toBe('место');
    expect(plural(3, ['место', 'места', 'мест'])).toBe('места');
    expect(plural(11, ['место', 'места', 'мест'])).toBe('мест');
    expect(plural(22, ['место', 'места', 'мест'])).toBe('места');
  });

  it('чипы дат: ближайшая неделя и выходные', () => {
    expect(nextWeekDates('2026-11-13')).toHaveLength(7);
    expect(weekendDates('2026-11-13')).toEqual(['2026-11-14', '2026-11-15']); // пятница
    expect(weekendDates('2026-11-14')).toEqual(['2026-11-14', '2026-11-15']); // суббота
    expect(weekendDates('2026-11-15')).toEqual(['2026-11-15']); // воскресенье
  });
});
