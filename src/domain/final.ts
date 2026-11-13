import { statusForInterval } from './findBestSlots';
import type { Id, Meeting, Participant, Place } from './schemas';
import { dayInTz, daysBetween, formatDayLong, plural, timeInTz, todayIn } from './slots';

/** Итог встречи: кто идёт, текст для чата, ссылка на карту. */

export interface FinalInfo {
  start: string;
  end: string;
  date: string;
  timeRange: string;
  place?: Place;
  going: Participant[];
  notGoing: Participant[];
  /** Не ответили и по отметкам не понятно. */
  unknown: Participant[];
}

export function finalEnd(meeting: Pick<Meeting, 'durationMin'>, start: string): string {
  return new Date(Date.parse(start) + meeting.durationMin * 60_000).toISOString();
}

export function participantStatusAtFinal(
  meeting: Meeting,
  p: Participant,
): 'going' | 'not_going' | 'unknown' {
  if (p.rsvp) return p.rsvp;
  if (!meeting.final) return 'unknown';
  const st = statusForInterval(
    meeting.availability[p.id],
    meeting.final.start,
    meeting.durationMin,
  );
  if (st === 'yes' || st === 'maybe') return 'going';
  if (st === 'no') return 'not_going';
  return 'unknown';
}

export function getFinalInfo(meeting: Meeting): FinalInfo | undefined {
  const final = meeting.final;
  if (!final) return undefined;
  const end = finalEnd(meeting, final.start);
  const tz = meeting.timezone;
  const going: Participant[] = [];
  const notGoing: Participant[] = [];
  const unknown: Participant[] = [];
  for (const p of meeting.participants) {
    const st = participantStatusAtFinal(meeting, p);
    (st === 'going' ? going : st === 'not_going' ? notGoing : unknown).push(p);
  }
  return {
    start: final.start,
    end,
    date: dayInTz(final.start, tz),
    timeRange: `${timeInTz(final.start, tz)}–${timeInTz(end, tz)}`,
    place: meeting.places.find((p) => p.id === final.placeId),
    going,
    notGoing,
    unknown,
  };
}

/** «Завтра», «Через 3 дня», «Сегодня, через 2 часа», «Идёт прямо сейчас». */
export function whenLabel(meeting: Meeting, now: Date = new Date()): string | undefined {
  if (!meeting.final) return undefined;
  const start = Date.parse(meeting.final.start);
  const end = Date.parse(finalEnd(meeting, meeting.final.start));
  const t = now.getTime();
  if (t >= end) return 'Встреча прошла';
  if (t >= start) return 'Идёт прямо сейчас';
  const days = daysBetween(todayIn(meeting.timezone, now), dayInTz(start, meeting.timezone));
  if (days === 0) {
    const hours = Math.ceil((start - t) / 3_600_000);
    if (hours <= 1) return 'Меньше чем через час';
    return `Сегодня, через ${hours} ${plural(hours, ['час', 'часа', 'часов'])}`;
  }
  if (days === 1) return 'Завтра';
  if (days === 2) return 'Послезавтра';
  return `Через ${days} ${plural(days, ['день', 'дня', 'дней'])}`;
}

export function mapLink(place: Place | undefined): string | undefined {
  if (!place) return undefined;
  if (place.mapUrl) return place.mapUrl;
  const q = [place.name, place.address].filter(Boolean).join(', ');
  return `https://yandex.ru/maps/?text=${encodeURIComponent(q)}`;
}

/** Готовое сообщение для мессенджера (F12). */
export function chatText(meeting: Meeting): string {
  const info = getFinalInfo(meeting);
  if (!info) return '';
  const lines = [
    `📅 ${meeting.title}`,
    `🗓 ${capitalize(formatDayLong(info.date))}, ${info.timeRange}`,
  ];
  if (info.place) {
    lines.push(`📍 ${info.place.name}${info.place.address ? `, ${info.place.address}` : ''}`);
    const link = mapLink(info.place);
    if (link) lines.push(link);
  }
  if (info.going.length) lines.push(`✅ Идут: ${info.going.map((p) => p.name).join(', ')}`);
  if (info.notGoing.length)
    lines.push(`❌ Не смогут: ${info.notGoing.map((p) => p.name).join(', ')}`);
  return lines.join('\n');
}

export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function namesOf(meeting: Pick<Meeting, 'participants'>, ids: Id[]): string[] {
  const byId = new Map(meeting.participants.map((p) => [p.id, p.name]));
  return ids.map((id) => byId.get(id) ?? '?');
}
