import { describe, expect, it } from 'vitest';
import { findBestSlots, scoreOf, statusForInterval } from '../src/domain/findBestSlots';
import { timeInTz } from '../src/domain/slots';
import { key, makeMeeting, person, range } from './helpers';

const D1 = '2026-11-14';
const D2 = '2026-11-15';
const t = (iso: string, tz = 'Europe/Moscow') => timeInTz(iso, tz);

describe('findBestSlots — обязательные случаи из ТЗ', () => {
  it('никто не отметился — пустой результат', () => {
    const m = makeMeeting({ participants: [person('a'), person('b')] });
    expect(findBestSlots(m)).toEqual([]);
  });

  it('нет участников — пустой результат', () => {
    expect(findBestSlots(makeMeeting())).toEqual([]);
  });

  it('один участник — его интервал', () => {
    const m = makeMeeting({
      participants: [person('a')],
      availability: { a: range(D1, '19:00', '21:00') },
    });
    const [top, ...rest] = findBestSlots(m);
    expect(rest).toHaveLength(0);
    expect(top.date).toBe(D1);
    expect(t(top.start)).toBe('19:00');
    expect(t(top.end)).toBe('21:00');
    expect(top.yes).toEqual(['a']);
    expect(top.score).toBe(scoreOf(1, 0));
  });

  it('нет общего времени — приходят лучшие частичные варианты', () => {
    const m = makeMeeting({
      participants: [person('a'), person('b'), person('c')],
      availability: {
        a: { ...range(D1, '10:00', '12:00'), ...range(D2, '18:00', '20:00') },
        b: range(D1, '10:00', '12:00'),
        c: range(D2, '14:00', '16:00'),
      },
    });
    const res = findBestSlots(m);
    expect(res.length).toBeGreaterThan(0);
    expect(res[0].yes).toEqual(['a', 'b']);
    expect(res[0].no).toEqual(['c']);
    expect(t(res[0].start)).toBe('10:00');
    // Остальные варианты — по одному человеку, в хронологическом порядке.
    expect(res[1].yes).toHaveLength(1);
    expect(Date.parse(res[1].start)).toBeLessThan(Date.parse(res[2].start));
  });

  it('обязательный участник не может никогда — пустой результат', () => {
    const m = makeMeeting({
      participants: [person('a'), person('b'), person('boss', 'Босс', true)],
      availability: {
        a: range(D1, '18:00', '22:00'),
        b: range(D1, '18:00', '22:00'),
        boss: range(D2, '10:00', '11:00'), // отметился, но 2 часа подряд нигде нет
      },
    });
    expect(findBestSlots(m)).toEqual([]);
  });

  it('обязательный, который ещё не отметился, не блокирует варианты', () => {
    const m = makeMeeting({
      participants: [person('a'), person('boss', 'Босс', true)],
      availability: { a: range(D1, '18:00', '20:00') },
    });
    const [top] = findBestSlots(m);
    expect(top.yes).toEqual(['a']);
    expect(top.noResponse).toEqual(['boss']);
  });

  it('длительность длиннее дня — пустой результат', () => {
    const m = makeMeeting({
      dayStartMin: 600,
      dayEndMin: 720,
      durationMin: 180,
      participants: [person('a')],
      availability: { a: range(D1, '10:00', '12:00') },
    });
    expect(findBestSlots(m)).toEqual([]);
  });

  it('окно не переходит через границу дня', () => {
    const m = makeMeeting({
      dayStartMin: 1320,
      dayEndMin: 1440,
      durationMin: 120,
      participants: [person('a')],
      availability: { a: { ...range(D1, '23:00', '24:00'), ...range(D2, '22:00', '23:00') } },
    });
    expect(findBestSlots(m)).toEqual([]);
  });

  it('склейка соседних окон с одинаковым составом', () => {
    const m = makeMeeting({
      participants: [person('a'), person('b')],
      availability: {
        a: range(D1, '18:00', '22:00'),
        b: range(D1, '18:00', '22:00'),
      },
    });
    const res = findBestSlots(m);
    expect(res).toHaveLength(1);
    const [top] = res;
    expect(t(top.start)).toBe('18:00');
    expect(t(top.latestStart)).toBe('20:00');
    expect(t(top.end)).toBe('22:00');
    expect(top.starts.map((s) => t(s))).toEqual(['18:00', '18:30', '19:00', '19:30', '20:00']);
  });

  it('топ-3 не состоит из одного вечера со сдвигом на 30 минут', () => {
    const m = makeMeeting({
      participants: [person('a'), person('b'), person('c')],
      availability: {
        a: { ...range(D1, '18:00', '23:00'), ...range(D2, '12:00', '14:00') },
        b: { ...range(D1, '18:00', '23:00'), ...range(D2, '12:00', '14:00') },
        c: range(D1, '20:00', '23:00'),
      },
    });
    const res = findBestSlots(m);
    // Сб 20:00–23:00 (все трое), затем Вс 12:00–14:00 (двое).
    // Сб 18:00–21:00 (двое) поглощён первым вариантом: те же люди могут и в 20:00.
    expect(res).toHaveLength(2);
    expect(res[0].yes).toEqual(['a', 'b', 'c']);
    expect(t(res[0].start)).toBe('20:00');
    expect(t(res[0].latestStart)).toBe('21:00');
    expect(res[1].date).toBe(D2);
    expect(t(res[1].start)).toBe('12:00');
  });

  it('пересекающийся вариант с подмножеством людей не занимает место в топе', () => {
    const m = makeMeeting({
      participants: [person('a'), person('b'), person('c')],
      availability: {
        a: { ...range(D1, '14:00', '17:00'), ...range(D2, '19:00', '21:00') },
        b: range(D1, '14:30', '17:00'),
        c: range(D1, '14:30', '16:30'),
      },
    });
    const res = findBestSlots(m);
    // Сб 14:30–16:30 (трое) поглощает Сб 14:00–16:00 и 15:00–17:00 (те же или меньше людей).
    expect(res[0].yes).toEqual(['a', 'b', 'c']);
    expect(t(res[0].start)).toBe('14:30');
    expect(res[1].date).toBe(D2);
    expect(res).toHaveLength(2);
  });

  it('«может» важнее «скорее может» только при равном числе людей', () => {
    const m = makeMeeting({
      participants: [person('a'), person('b'), person('c')],
      availability: {
        a: { ...range(D1, '10:00', '12:00', 'maybe'), ...range(D2, '10:00', '12:00') },
        b: { ...range(D1, '10:00', '12:00', 'maybe'), ...range(D2, '10:00', '12:00') },
        c: range(D1, '10:00', '12:00', 'maybe'),
      },
    });
    const res = findBestSlots(m);
    // Три человека «если нужно» лучше, чем два «могу».
    expect(res[0].date).toBe(D1);
    expect(res[0].maybe).toEqual(['a', 'b', 'c']);
    expect(res[0].score).toBe(300);
    expect(res[1].score).toBe(202);
  });

  it('частично «если нужно» в окне — участник «скорее может»', () => {
    const m = makeMeeting({
      participants: [person('a')],
      availability: {
        a: { ...range(D1, '10:00', '11:00'), ...range(D1, '11:00', '12:00', 'maybe') },
      },
    });
    const [top] = findBestSlots(m);
    expect(top.maybe).toEqual(['a']);
    expect(statusForInterval(m.availability.a, key(D1, '10:00'), 60)).toBe('yes');
    expect(statusForInterval(m.availability.a, key(D1, '10:30'), 60)).toBe('maybe');
    expect(statusForInterval(m.availability.a, key(D1, '11:30'), 60)).toBe('no');
  });

  it('при равной оценке выигрывает более раннее окно', () => {
    const m = makeMeeting({
      participants: [person('a')],
      availability: { a: { ...range(D2, '10:00', '12:00'), ...range(D1, '20:00', '22:00') } },
    });
    const res = findBestSlots(m);
    expect(res[0].date).toBe(D1);
    expect(res[1].date).toBe(D2);
  });
});

describe('findBestSlots — переход на летнее/зимнее время', () => {
  const BER = 'Europe/Berlin';

  it('весной (29 марта 2026, 02:00 → 03:00) окно через «дыру» длится реальные 2 часа', () => {
    const date = '2026-03-29';
    const m = makeMeeting({
      timezone: BER,
      dates: [date],
      dayStartMin: 0,
      dayEndMin: 360,
      durationMin: 120,
      participants: [person('a')],
      availability: { a: range(date, '01:00', '04:00', 'yes', BER) },
    });
    const [top] = findBestSlots(m);
    expect(t(top.start, BER)).toBe('01:00');
    // 01:00 + 2 реальных часа = 04:00 по местному времени
    expect(t(top.end, BER)).toBe('04:00');
    expect(Date.parse(top.end) - Date.parse(top.latestStart)).toBe(2 * 3600_000);
  });

  it('осенью (25 октября 2026, 03:00 → 02:00) окно не перескакивает через повтор часа', () => {
    const date = '2026-10-25';
    const m = makeMeeting({
      timezone: BER,
      dates: [date],
      dayStartMin: 0,
      dayEndMin: 360,
      durationMin: 120,
      participants: [person('a')],
      availability: { a: range(date, '00:00', '06:00', 'yes', BER) },
    });
    const res = findBestSlots(m);
    for (const opt of res) {
      for (const s of opt.starts) {
        // Каждый старт: реальная длительность окна ровно 2 часа и все слоты отмечены.
        expect(statusForInterval(m.availability.a, s, 120)).toBe('yes');
      }
    }
    expect(res.length).toBeGreaterThan(0);
  });

  it('Москва без перехода: слоты идут ровно через 30 минут', () => {
    const m = makeMeeting({
      participants: [person('a')],
      availability: { a: range(D1, '10:00', '23:00') },
      durationMin: 60,
    });
    const [top] = findBestSlots(m);
    expect(t(top.start)).toBe('10:00');
    expect(t(top.latestStart)).toBe('22:00');
  });
});

describe('findBestSlots — 5 подготовленных наборов (ручная проверка)', () => {
  it('набор 1: кино в пятницу — все свободны вечером', () => {
    const d = '2026-11-20';
    const m = makeMeeting({
      dates: [d],
      participants: ['a', 'b', 'c', 'd'].map((id) => person(id)),
      availability: Object.fromEntries(
        ['a', 'b', 'c', 'd'].map((id) => [id, range(d, '19:00', '23:00')]),
      ),
    });
    const res = findBestSlots(m);
    expect(res).toHaveLength(1);
    expect(t(res[0].start)).toBe('19:00');
    expect(t(res[0].end)).toBe('23:00');
    expect(res[0].yes).toHaveLength(4);
  });

  it('набор 2: один всегда занят — лучшие 3 из 4, «не сможет» подписан', () => {
    const m = makeMeeting({
      participants: ['a', 'b', 'c', 'max'].map((id) => person(id)),
      availability: {
        a: range(D1, '18:00', '20:00'),
        b: range(D1, '18:00', '20:00'),
        c: range(D1, '18:00', '20:00'),
        max: range(D2, '10:00', '12:00'),
      },
    });
    const [top, second] = findBestSlots(m);
    expect(top.yes).toEqual(['a', 'b', 'c']);
    expect(top.no).toEqual(['max']);
    expect(second.yes).toEqual(['max']);
  });

  it('набор 3: обязательный участник решает', () => {
    const m = makeMeeting({
      participants: [person('a'), person('b'), person('c'), person('boss', 'Босс', true)],
      availability: {
        a: { ...range(D1, '12:00', '14:00'), ...range(D2, '15:00', '17:00') },
        b: range(D1, '12:00', '14:00'),
        c: range(D1, '12:00', '14:00'),
        boss: range(D2, '15:00', '17:00'),
      },
    });
    const res = findBestSlots(m);
    expect(res).toHaveLength(1);
    expect(res[0].date).toBe(D2);
    expect(res[0].yes).toEqual(['a', 'boss']);
  });

  it('набор 4: «если нужно» добирает людей', () => {
    const m = makeMeeting({
      participants: ['a', 'b', 'c'].map((id) => person(id)),
      availability: {
        a: { ...range(D1, '10:00', '12:00'), ...range(D2, '10:00', '12:00') },
        b: { ...range(D1, '10:00', '12:00'), ...range(D2, '10:00', '12:00', 'maybe') },
        c: range(D2, '10:00', '12:00', 'maybe'),
      },
    });
    const [top, second] = findBestSlots(m);
    expect(top.date).toBe(D2);
    expect(top.yes).toEqual(['a']);
    expect(top.maybe).toEqual(['b', 'c']);
    expect(second.date).toBe(D1);
  });

  it('набор 5: длительность 3 часа отсекает короткие окна', () => {
    const m = makeMeeting({
      durationMin: 180,
      participants: ['a', 'b'].map((id) => person(id)),
      availability: {
        a: { ...range(D1, '10:00', '12:30'), ...range(D2, '17:00', '20:00') },
        b: { ...range(D1, '10:00', '12:30'), ...range(D2, '16:00', '21:00') },
      },
    });
    const res = findBestSlots(m);
    expect(res[0].date).toBe(D2);
    expect(t(res[0].start)).toBe('17:00');
    expect(t(res[0].end)).toBe('20:00');
    expect(res[0].yes).toEqual(['a', 'b']);
    expect(res.every((o) => o.date === D2)).toBe(true);
  });
});
