import type { Meeting, SlotStatus } from '../src/domain/schemas';
import { zonedToUtcMs, slotKey } from '../src/domain/slots';

let counter = 0;
export const seqId = () => `id-${++counter}`;

export function makeMeeting(overrides: Partial<Meeting> = {}): Meeting {
  return {
    id: 'm1',
    title: 'Тест',
    timezone: 'Europe/Moscow',
    dates: ['2026-11-14', '2026-11-15'],
    dayStartMin: 600,
    dayEndMin: 1380,
    durationMin: 120,
    participants: [],
    availability: {},
    places: [],
    createdAt: '2026-11-01T00:00:00.000Z',
    updatedAt: '2026-11-01T00:00:00.000Z',
    settingsUpdatedAt: '2026-11-01T00:00:00.000Z',
    ...overrides,
  };
}

export function person(id: string, name = id, isRequired = false) {
  return { id, name, isRequired, updatedAt: '2026-11-01T00:00:00.000Z' };
}

/** Ключ слота по настенному времени: key('2026-11-14', '19:00') */
export function key(date: string, time: string, tz = 'Europe/Moscow'): string {
  const [h, m] = time.split(':').map(Number);
  const ms = zonedToUtcMs(date, h * 60 + m, tz);
  if (ms === null) throw new Error(`no such time ${date} ${time} ${tz}`);
  return slotKey(ms);
}

/** Отметки на интервал [from, to) с шагом 30 минут. */
export function range(
  date: string,
  from: string,
  to: string,
  status: SlotStatus = 'yes',
  tz = 'Europe/Moscow',
): Record<string, SlotStatus> {
  const toMin = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };
  const res: Record<string, SlotStatus> = {};
  for (let min = toMin(from); min < toMin(to); min += 30) {
    const ms = zonedToUtcMs(date, min, tz);
    if (ms !== null) res[slotKey(ms)] = status;
  }
  return res;
}
