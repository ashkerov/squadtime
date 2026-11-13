import { describe, expect, it } from 'vitest';
import { whenLabel } from '../src/domain/final';
import { copyDayToAll, isPastSlot, othersCount } from '../src/domain/marks';
import { buildGrid } from '../src/domain/slots';
import { key, makeMeeting, range } from './helpers';

const D1 = '2026-11-14';
const D2 = '2026-11-15';
const D3 = '2026-11-16';

describe('инструменты отметок', () => {
  const grid = buildGrid({
    dates: [D1, D2, D3],
    dayStartMin: 600,
    dayEndMin: 720,
    timezone: 'Europe/Moscow',
  });

  it('копирует день на все дни по настенному времени', () => {
    const marks = { ...range(D1, '10:00', '11:00'), ...range(D2, '11:00', '12:00', 'maybe') };
    const next = copyDayToAll(grid, marks, 0);
    expect(next).toEqual({
      ...range(D1, '10:00', '11:00'),
      ...range(D2, '10:00', '11:00'),
      ...range(D3, '10:00', '11:00'),
    });
  });

  it('не трогает прошедшие слоты', () => {
    const marks = range(D2, '10:00', '12:00');
    const now = Date.parse(key(D1, '11:00'));
    // Копируем Вс на остальные: прошедшие 10:00–10:30 субботы остаются пустыми.
    const next = copyDayToAll(grid, marks, 1, now);
    expect(next[key(D1, '10:00')]).toBeUndefined();
    expect(next[key(D1, '11:00')]).toBe('yes');
    expect(isPastSlot({ ms: Date.parse(key(D1, '10:30')) }, now)).toBe(true);
    expect(isPastSlot({ ms: Date.parse(key(D1, '11:00')) }, now)).toBe(false);
  });

  it('считает чужие отметки, не считая свои', () => {
    const counts = othersCount(
      {
        me: range(D1, '10:00', '11:00'),
        a: range(D1, '10:00', '10:30'),
        b: range(D1, '10:00', '10:30', 'maybe'),
      },
      'me',
    );
    expect(counts).toEqual({ [key(D1, '10:00')]: 2 });
  });
});

describe('whenLabel', () => {
  const m = makeMeeting({
    final: { start: key(D1, '19:00'), fixedAt: '2026-11-10T00:00:00.000Z' },
  });
  const at = (date: string, time: string) => new Date(key(date, time));

  it('подписи до встречи и во время', () => {
    expect(whenLabel(m, at('2026-11-10', '12:00'))).toBe('Через 4 дня');
    expect(whenLabel(m, at('2026-11-12', '12:00'))).toBe('Послезавтра');
    expect(whenLabel(m, at('2026-11-13', '23:30'))).toBe('Завтра');
    expect(whenLabel(m, at(D1, '14:00'))).toBe('Сегодня, через 5 часов');
    expect(whenLabel(m, at(D1, '18:30'))).toBe('Меньше чем через час');
    expect(whenLabel(m, at(D1, '20:00'))).toBe('Идёт прямо сейчас');
    expect(whenLabel(m, at(D1, '21:00'))).toBe('Встреча прошла');
  });
});

describe('weightedIndex', () => {
  it('выбирает пропорционально весам', async () => {
    const { weightedIndex } = await import('../src/domain/random');
    expect(weightedIndex([1, 3], () => 0)).toBe(0);
    expect(weightedIndex([1, 3], () => 0.24)).toBe(0);
    expect(weightedIndex([1, 3], () => 0.26)).toBe(1);
    expect(weightedIndex([1, 3], () => 0.999)).toBe(1);
    expect(weightedIndex([0, 0], () => 0.6)).toBe(1);
  });
});
