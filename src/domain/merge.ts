import type { Id, Meeting, Participant, Place } from './schemas';
import { plural } from './slots';

/**
 * Слияние встречи при импорте файла (раздел 7 ТЗ):
 * - участники объединяются по id; отметки каждого берутся целиком из версии
 *   с более поздним participant.updatedAt;
 * - места объединяются по id, лайки — объединением множеств;
 * - настройки встречи и фиксация — из версии с более поздним settingsUpdatedAt.
 */

export interface ImportSummary {
  meetingId: Id;
  title: string;
  /** Встречи с таким id ещё не было — добавится целиком. */
  isNew: boolean;
  newParticipants: string[];
  /** Участники, чьи отметки или данные обновятся. */
  updatedParticipants: string[];
  newPlaces: number;
  newVotes: number;
  settingsChanged: boolean;
  finalChanged: boolean;
  /** Ничего не изменится. */
  isNoop: boolean;
}

export function settingsTime(m: Meeting): number {
  return Date.parse(m.settingsUpdatedAt ?? m.createdAt);
}

export function mergeMeetings(
  local: Meeting,
  incoming: Meeting,
): { meeting: Meeting; summary: ImportSummary } {
  const participants: Participant[] = [];
  const availability: Meeting['availability'] = {};
  const newParticipants: string[] = [];
  const updatedParticipants: string[] = [];

  const incomingById = new Map(incoming.participants.map((p) => [p.id, p]));
  const localIds = new Set(local.participants.map((p) => p.id));

  for (const lp of local.participants) {
    const ip = incomingById.get(lp.id);
    const takeIncoming = ip !== undefined && Date.parse(ip.updatedAt) > Date.parse(lp.updatedAt);
    if (takeIncoming) {
      participants.push(ip);
      availability[ip.id] = { ...(incoming.availability[ip.id] ?? {}) };
      if (
        JSON.stringify(ip) !== JSON.stringify(lp) ||
        !sameMarks(local.availability[lp.id], incoming.availability[ip.id])
      ) {
        updatedParticipants.push(ip.name);
      }
    } else {
      participants.push(lp);
      if (local.availability[lp.id]) availability[lp.id] = { ...local.availability[lp.id] };
    }
  }
  for (const ip of incoming.participants) {
    if (localIds.has(ip.id)) continue;
    participants.push(ip);
    if (incoming.availability[ip.id]) availability[ip.id] = { ...incoming.availability[ip.id] };
    newParticipants.push(ip.name);
  }

  const places: Place[] = [];
  let newPlaces = 0;
  let newVotes = 0;
  const incomingPlaces = new Map(incoming.places.map((p) => [p.id, p]));
  const localPlaceIds = new Set(local.places.map((p) => p.id));
  for (const lp of local.places) {
    const ip = incomingPlaces.get(lp.id);
    const votes = new Set(lp.votes);
    for (const v of ip?.votes ?? []) {
      if (!votes.has(v)) {
        votes.add(v);
        newVotes++;
      }
    }
    places.push({ ...lp, votes: [...votes] });
  }
  for (const ip of incoming.places) {
    if (localPlaceIds.has(ip.id)) continue;
    places.push({ ...ip, votes: [...new Set(ip.votes)] });
    newPlaces++;
  }

  const incomingSettingsNewer = settingsTime(incoming) > settingsTime(local);
  const settingsSource = incomingSettingsNewer ? incoming : local;
  const settingsChanged =
    incomingSettingsNewer &&
    (incoming.title !== local.title ||
      incoming.timezone !== local.timezone ||
      incoming.dayStartMin !== local.dayStartMin ||
      incoming.dayEndMin !== local.dayEndMin ||
      incoming.durationMin !== local.durationMin ||
      incoming.dates.join() !== local.dates.join());
  const finalChanged =
    incomingSettingsNewer && JSON.stringify(incoming.final) !== JSON.stringify(local.final);

  const isNoop =
    newParticipants.length === 0 &&
    updatedParticipants.length === 0 &&
    newPlaces === 0 &&
    newVotes === 0 &&
    !settingsChanged &&
    !finalChanged;

  const updatedAt =
    Date.parse(incoming.updatedAt) > Date.parse(local.updatedAt)
      ? incoming.updatedAt
      : local.updatedAt;

  const meeting: Meeting = {
    id: local.id,
    title: settingsSource.title,
    timezone: settingsSource.timezone,
    dates: [...settingsSource.dates],
    dayStartMin: settingsSource.dayStartMin,
    dayEndMin: settingsSource.dayEndMin,
    durationMin: settingsSource.durationMin,
    final: settingsSource.final ? { ...settingsSource.final } : undefined,
    settingsUpdatedAt: settingsSource.settingsUpdatedAt ?? settingsSource.createdAt,
    participants,
    availability,
    places,
    createdAt: local.createdAt,
    updatedAt,
  };
  if (!meeting.final) delete meeting.final;

  return {
    meeting,
    summary: {
      meetingId: local.id,
      title: meeting.title,
      isNew: false,
      newParticipants,
      updatedParticipants,
      newPlaces,
      newVotes,
      settingsChanged,
      finalChanged,
      isNoop,
    },
  };
}

/** Сводка для встречи, которой ещё нет на устройстве. */
export function summaryForNew(m: Meeting): ImportSummary {
  return {
    meetingId: m.id,
    title: m.title,
    isNew: true,
    newParticipants: m.participants.map((p) => p.name),
    updatedParticipants: [],
    newPlaces: m.places.length,
    newVotes: 0,
    settingsChanged: false,
    finalChanged: false,
    isNoop: false,
  };
}

/** «Добавится: Макс (новые отметки), 1 место» */
export function describeSummary(s: ImportSummary): string {
  if (s.isNew) {
    const parts = [`новая встреча «${s.title}»`];
    if (s.newParticipants.length) parts.push(`участники: ${s.newParticipants.join(', ')}`);
    if (s.newPlaces) parts.push(`${s.newPlaces} ${placesWord(s.newPlaces)}`);
    return `Добавится: ${parts.join(', ')}`;
  }
  if (s.isNoop) return 'Ничего нового: файл совпадает с тем, что уже есть.';
  const parts: string[] = [];
  for (const n of s.newParticipants) parts.push(`${n} (новый участник)`);
  for (const n of s.updatedParticipants) parts.push(`${n} (новые отметки)`);
  if (s.newPlaces) parts.push(`${s.newPlaces} ${placesWord(s.newPlaces)}`);
  if (s.newVotes) parts.push(`${s.newVotes} ${plural(s.newVotes, ['лайк', 'лайка', 'лайков'])}`);
  if (s.settingsChanged) parts.push('новые настройки встречи');
  if (s.finalChanged) parts.push('изменения в фиксации');
  return `Добавится: ${parts.join(', ')}`;
}

function placesWord(n: number): string {
  return plural(n, ['место', 'места', 'мест']);
}

function sameMarks(a: Record<string, string> | undefined, b: Record<string, string> | undefined) {
  const ka = Object.keys(a ?? {});
  const kb = Object.keys(b ?? {});
  return ka.length === kb.length && ka.every((k) => a?.[k] === b?.[k]);
}
