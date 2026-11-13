import { getFinalInfo, mapLink } from './final';
import type { Meeting } from './schemas';

/**
 * Генерация .ics (RFC 5545) с двумя напоминаниями — за 24 ч и за 2 ч (F11),
 * и ссылки «Добавить в Google Календарь».
 */

export const REMINDERS = ['-PT24H', '-PT2H'] as const;

/** 2026-11-16T16:00:00.000Z → 20261116T160000Z */
export function toIcsDate(iso: string): string {
  return new Date(iso)
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
}

export function escapeIcsText(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

const encoder = new TextEncoder();

/** Перенос строк длиннее 75 октетов, не разрывая многобайтовые символы UTF-8. */
export function foldLine(line: string): string {
  if (encoder.encode(line).length <= 75) return line;
  const parts: string[] = [];
  let current = '';
  let bytes = 0;
  let limit = 75;
  for (const ch of line) {
    const len = encoder.encode(ch).length;
    if (bytes + len > limit) {
      parts.push(current);
      current = '';
      bytes = 0;
      limit = 74; // продолжение начинается с пробела
    }
    current += ch;
    bytes += len;
  }
  parts.push(current);
  return parts.join('\r\n ');
}

export function generateIcs(meeting: Meeting, now: Date = new Date()): string {
  const info = getFinalInfo(meeting);
  if (!info || !meeting.final) throw new Error('Встреча не зафиксирована');

  const description: string[] = [];
  if (info.going.length) description.push(`Идут: ${info.going.map((p) => p.name).join(', ')}`);
  const link = mapLink(info.place);
  if (link) description.push(`Карта: ${link}`);
  description.push('Создано в SquadTime');

  const location = info.place
    ? [info.place.name, info.place.address].filter(Boolean).join(', ')
    : undefined;

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//SquadTime//Meeting Planner//RU',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${meeting.id}@squadtime.app`,
    `DTSTAMP:${toIcsDate(now.toISOString())}`,
    `SEQUENCE:${Math.floor(Date.parse(meeting.final.fixedAt) / 1000)}`,
    `DTSTART:${toIcsDate(info.start)}`,
    `DTEND:${toIcsDate(info.end)}`,
    `SUMMARY:${escapeIcsText(meeting.title)}`,
    ...(location ? [`LOCATION:${escapeIcsText(location)}`] : []),
    `DESCRIPTION:${escapeIcsText(description.join('\n'))}`,
    ...(info.place?.mapUrl ? [`URL:${info.place.mapUrl}`] : []),
    'STATUS:CONFIRMED',
    ...REMINDERS.flatMap((trigger) => [
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${escapeIcsText(`${meeting.title} — ${trigger === '-PT24H' ? 'завтра' : 'через 2 часа'}`)}`,
      `TRIGGER:${trigger}`,
      'END:VALARM',
    ]),
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return lines.map(foldLine).join('\r\n') + '\r\n';
}

export function googleCalendarUrl(meeting: Meeting): string {
  const info = getFinalInfo(meeting);
  if (!info) throw new Error('Встреча не зафиксирована');
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: meeting.title,
    dates: `${toIcsDate(info.start)}/${toIcsDate(info.end)}`,
    ctz: meeting.timezone,
  });
  const details: string[] = [];
  if (info.going.length) details.push(`Идут: ${info.going.map((p) => p.name).join(', ')}`);
  const link = mapLink(info.place);
  if (link) details.push(link);
  if (details.length) params.set('details', details.join('\n'));
  if (info.place) {
    params.set('location', [info.place.name, info.place.address].filter(Boolean).join(', '));
  }
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/** Имя файла без символов, запрещённых в Windows/macOS. */
export function safeFileName(title: string): string {
  return (
    title
      .replace(/[\\/:*?"<>|]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 60) || 'Встреча'
  );
}
