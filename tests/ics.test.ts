import { describe, expect, it } from 'vitest';
import { chatText } from '../src/domain/final';
import { foldLine, generateIcs, googleCalendarUrl, safeFileName } from '../src/domain/ics';
import { makeMeeting, person, range } from './helpers';

const D1 = '2026-11-14';

const meeting = makeMeeting({
  title: 'Боулинг; с друзьями, в субботу',
  participants: [person('a', 'Аня'), person('b', 'Борис'), person('c', 'Макс')],
  availability: {
    a: range(D1, '19:00', '21:00'),
    b: range(D1, '19:00', '21:00', 'maybe'),
    c: range(D1, '10:00', '12:00'),
  },
  places: [
    {
      id: 'p1',
      name: 'Страйк',
      address: 'ул. Примерная, 12',
      mapUrl: 'https://yandex.ru/maps/-/abc',
      addedBy: 'a',
      votes: ['a'],
    },
  ],
  final: { start: '2026-11-14T16:00:00.000Z', placeId: 'p1', fixedAt: '2026-11-10T10:00:00.000Z' },
});

describe('generateIcs', () => {
  const ics = generateIcs(meeting, new Date('2026-11-10T12:00:00.000Z'));
  const unfolded = ics.replace(/\r\n /g, '');

  it('содержит событие с правильным временем в UTC', () => {
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
    expect(unfolded).toContain('DTSTART:20261114T160000Z');
    expect(unfolded).toContain('DTEND:20261114T180000Z');
    expect(unfolded).toContain('UID:m1@squadtime.app');
  });

  it('содержит два напоминания: за 24 ч и за 2 ч', () => {
    expect(unfolded.match(/BEGIN:VALARM/g)).toHaveLength(2);
    expect(unfolded).toContain('TRIGGER:-PT24H');
    expect(unfolded).toContain('TRIGGER:-PT2H');
  });

  it('экранирует спецсимволы и указывает место', () => {
    expect(unfolded).toContain('SUMMARY:Боулинг\\; с друзьями\\, в субботу');
    expect(unfolded).toContain('LOCATION:Страйк\\, ул. Примерная\\, 12');
    expect(unfolded).toContain('Идут: Аня\\, Борис');
  });

  it('все строки не длиннее 75 октетов', () => {
    const enc = new TextEncoder();
    for (const line of ics.split('\r\n')) expect(enc.encode(line).length).toBeLessThanOrEqual(75);
  });

  it('без фиксации — ошибка', () => {
    expect(() => generateIcs({ ...meeting, final: undefined })).toThrow();
  });
});

describe('foldLine', () => {
  it('не разрывает кириллицу посередине символа', () => {
    const line = 'DESCRIPTION:' + 'Ж'.repeat(100);
    const folded = foldLine(line);
    expect(folded.replace(/\r\n /g, '')).toBe(line);
  });
});

describe('googleCalendarUrl и текст для чата', () => {
  it('ссылка Google Календаря', () => {
    const url = new URL(googleCalendarUrl(meeting));
    expect(url.hostname).toBe('calendar.google.com');
    expect(url.searchParams.get('dates')).toBe('20261114T160000Z/20261114T180000Z');
    expect(url.searchParams.get('location')).toBe('Страйк, ул. Примерная, 12');
  });

  it('текст для чата: дата, время, место и кто идёт', () => {
    const text = chatText(meeting);
    expect(text).toContain('Суббота, 14 ноября, 19:00–21:00');
    expect(text).toContain('Страйк, ул. Примерная, 12');
    expect(text).toContain('Идут: Аня, Борис');
    expect(text).toContain('Не смогут: Макс');
  });

  it('безопасное имя файла', () => {
    expect(safeFileName('Кино: "пятница"/вечер')).toBe('Кино пятница вечер');
  });
});
