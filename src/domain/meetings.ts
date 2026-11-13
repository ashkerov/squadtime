import {
  MAX_ADDRESS_LENGTH,
  MAX_DAYS,
  MAX_NAME_LENGTH,
  MAX_PARTICIPANTS,
  MAX_PLACE_NAME_LENGTH,
  MAX_TITLE_LENGTH,
  MAX_URL_LENGTH,
  type Id,
  type Meeting,
  type MeetingSettings,
  type NewMeetingInput,
  type Participant,
  type Place,
  type SlotStatus,
} from './schemas';
import { finalEnd } from './final';
import { addDays, daysBetween, todayIn } from './slots';

/**
 * Чистые операции над встречей. Хранилище (сейчас localStorage, потом сервер)
 * только вызывает их и сохраняет результат — логика остаётся в domain/.
 */

export class DomainError extends Error {}

export type Clock = () => Date;
export type IdGen = () => Id;

export const defaultIdGen: IdGen = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

export function normalizeName(name: string): string {
  return name.replace(/\s+/g, ' ').trim().slice(0, MAX_NAME_LENGTH);
}

function assertSettings(s: MeetingSettings) {
  if (!s.title.trim()) throw new DomainError('Введите название');
  if (s.title.trim().length > MAX_TITLE_LENGTH)
    throw new DomainError(`Название — до ${MAX_TITLE_LENGTH} символов`);
  if (s.dates.length === 0) throw new DomainError('Выберите хотя бы один день');
  if (s.dates.length > MAX_DAYS) throw new DomainError(`Не больше ${MAX_DAYS} дней`);
  if (s.dayEndMin <= s.dayStartMin) throw new DomainError('Конец дня должен быть позже начала');
}

export function createMeeting(
  input: NewMeetingInput,
  now: Date = new Date(),
  idGen: IdGen = defaultIdGen,
): Meeting {
  const settings: MeetingSettings = {
    title: input.title.trim(),
    timezone: input.timezone,
    dates: [...new Set(input.dates)].sort(),
    dayStartMin: input.dayStartMin,
    dayEndMin: input.dayEndMin,
    durationMin: input.durationMin,
  };
  assertSettings(settings);
  const ts = now.toISOString();
  const participants: Participant[] = [];
  for (const raw of input.participantNames) {
    const name = normalizeName(raw);
    if (!name || participants.some((p) => sameName(p.name, name))) continue;
    if (participants.length >= MAX_PARTICIPANTS) break;
    participants.push({ id: idGen(), name, isRequired: false, updatedAt: ts });
  }
  return {
    id: idGen(),
    ...settings,
    participants,
    availability: {},
    places: [],
    createdAt: ts,
    updatedAt: ts,
    settingsUpdatedAt: ts,
  };
}

function touch(m: Meeting, now: Date): Meeting {
  return { ...m, updatedAt: now.toISOString() };
}

export function applySettings(m: Meeting, patch: Partial<MeetingSettings>, now = new Date()) {
  const next = { ...m, ...patch };
  if (patch.title !== undefined) next.title = patch.title.trim();
  if (patch.dates) next.dates = [...new Set(patch.dates)].sort();
  assertSettings(next);
  return { ...touch(next, now), settingsUpdatedAt: now.toISOString() };
}

function updateParticipant(
  m: Meeting,
  id: Id,
  fn: (p: Participant) => Participant,
  now: Date,
): Meeting {
  if (!m.participants.some((p) => p.id === id)) throw new DomainError('Участник не найден');
  return touch(
    {
      ...m,
      participants: m.participants.map((p) =>
        p.id === id ? { ...fn(p), updatedAt: now.toISOString() } : p,
      ),
    },
    now,
  );
}

export function setAvailability(
  m: Meeting,
  participantId: Id,
  slots: Record<string, SlotStatus>,
  now = new Date(),
): Meeting {
  const next = updateParticipant(m, participantId, (p) => p, now);
  const availability = { ...next.availability };
  if (Object.keys(slots).length === 0) delete availability[participantId];
  else availability[participantId] = { ...slots };
  return { ...next, availability };
}

function sameName(a: string, b: string) {
  return a.toLocaleLowerCase('ru') === b.toLocaleLowerCase('ru');
}

export function addParticipant(
  m: Meeting,
  rawName: string,
  now = new Date(),
  idGen: IdGen = defaultIdGen,
): { meeting: Meeting; participant: Participant } {
  const name = normalizeName(rawName);
  if (!name) throw new DomainError('Введите имя');
  if (m.participants.length >= MAX_PARTICIPANTS)
    throw new DomainError(`Не больше ${MAX_PARTICIPANTS} участников`);
  if (m.participants.some((p) => sameName(p.name, name)))
    throw new DomainError(`Участник «${name}» уже есть`);
  const participant: Participant = {
    id: idGen(),
    name,
    isRequired: false,
    updatedAt: now.toISOString(),
  };
  return {
    meeting: touch({ ...m, participants: [...m.participants, participant] }, now),
    participant,
  };
}

export function renameParticipant(m: Meeting, id: Id, rawName: string, now = new Date()) {
  const name = normalizeName(rawName);
  if (!name) throw new DomainError('Введите имя');
  if (m.participants.some((p) => p.id !== id && sameName(p.name, name)))
    throw new DomainError(`Участник «${name}» уже есть`);
  return updateParticipant(m, id, (p) => ({ ...p, name }), now);
}

export function setRequired(m: Meeting, id: Id, isRequired: boolean, now = new Date()) {
  return updateParticipant(m, id, (p) => ({ ...p, isRequired }), now);
}

export function setRsvp(
  m: Meeting,
  id: Id,
  rsvp: Participant['rsvp'] | undefined,
  now = new Date(),
) {
  return updateParticipant(
    m,
    id,
    (p) => {
      const next = { ...p, rsvp };
      if (!rsvp) delete next.rsvp;
      return next;
    },
    now,
  );
}

/** Всё, что нужно, чтобы вернуть удалённого участника кнопкой «Вернуть». */
export interface ParticipantSnapshot {
  participant: Participant;
  index: number;
  availability?: Record<string, SlotStatus>;
  votedPlaceIds: Id[];
}

export function removeParticipant(
  m: Meeting,
  id: Id,
  now = new Date(),
): { meeting: Meeting; snapshot: ParticipantSnapshot } {
  const index = m.participants.findIndex((p) => p.id === id);
  if (index < 0) throw new DomainError('Участник не найден');
  const availability = { ...m.availability };
  const snapshot: ParticipantSnapshot = {
    participant: m.participants[index],
    index,
    availability: availability[id],
    votedPlaceIds: m.places.filter((pl) => pl.votes.includes(id)).map((pl) => pl.id),
  };
  delete availability[id];
  return {
    meeting: touch(
      {
        ...m,
        participants: m.participants.filter((p) => p.id !== id),
        availability,
        places: m.places.map((pl) => ({ ...pl, votes: pl.votes.filter((v) => v !== id) })),
      },
      now,
    ),
    snapshot,
  };
}

export function restoreParticipant(m: Meeting, s: ParticipantSnapshot, now = new Date()) {
  if (m.participants.some((p) => p.id === s.participant.id)) return m;
  const participants = [...m.participants];
  participants.splice(Math.min(s.index, participants.length), 0, s.participant);
  const availability = { ...m.availability };
  if (s.availability) availability[s.participant.id] = s.availability;
  return touch(
    {
      ...m,
      participants,
      availability,
      places: m.places.map((pl) =>
        s.votedPlaceIds.includes(pl.id) && !pl.votes.includes(s.participant.id)
          ? { ...pl, votes: [...pl.votes, s.participant.id] }
          : pl,
      ),
    },
    now,
  );
}

export interface NewPlaceInput {
  name: string;
  address?: string;
  mapUrl?: string;
  addedBy: Id;
}

export function addPlace(
  m: Meeting,
  input: NewPlaceInput,
  now = new Date(),
  idGen: IdGen = defaultIdGen,
): { meeting: Meeting; place: Place } {
  // Длины ограничиваем здесь же, как в схеме: иначе при следующей загрузке данные не пройдут проверку.
  const name = input.name.trim().slice(0, MAX_PLACE_NAME_LENGTH);
  if (!name) throw new DomainError('Введите название места');
  if (!m.participants.some((p) => p.id === input.addedBy))
    throw new DomainError('Сначала выберите, кто вы');
  const mapUrl = input.mapUrl?.trim() || undefined;
  if (mapUrl && mapUrl.length > MAX_URL_LENGTH) throw new DomainError('Слишком длинная ссылка');
  if (mapUrl) {
    let ok: boolean;
    try {
      ok = new URL(mapUrl).protocol === 'https:';
    } catch {
      ok = false;
    }
    if (!ok) throw new DomainError('Ссылка на карту должна начинаться с https://');
  }
  const place: Place = {
    id: idGen(),
    name,
    addedBy: input.addedBy,
    votes: [input.addedBy],
  };
  const address = input.address?.trim().slice(0, MAX_ADDRESS_LENGTH);
  if (address) place.address = address;
  if (mapUrl) place.mapUrl = mapUrl;
  return { meeting: touch({ ...m, places: [...m.places, place] }, now), place };
}

export function removePlace(m: Meeting, placeId: Id, now = new Date()) {
  const index = m.places.findIndex((p) => p.id === placeId);
  if (index < 0) throw new DomainError('Место не найдено');
  const place = m.places[index];
  const next = touch({ ...m, places: m.places.filter((p) => p.id !== placeId) }, now);
  if (next.final?.placeId === placeId) {
    next.final = { ...next.final };
    delete next.final.placeId;
  }
  return { meeting: next, snapshot: { place, index } };
}

export function restorePlace(m: Meeting, s: { place: Place; index: number }, now = new Date()) {
  if (m.places.some((p) => p.id === s.place.id)) return m;
  const places = [...m.places];
  places.splice(Math.min(s.index, places.length), 0, s.place);
  return touch({ ...m, places }, now);
}

export function toggleVote(m: Meeting, placeId: Id, participantId: Id, now = new Date()) {
  if (!m.participants.some((p) => p.id === participantId))
    throw new DomainError('Сначала выберите, кто вы');
  return touch(
    {
      ...m,
      places: m.places.map((pl) =>
        pl.id !== placeId
          ? pl
          : {
              ...pl,
              votes: pl.votes.includes(participantId)
                ? pl.votes.filter((v) => v !== participantId)
                : [...pl.votes, participantId],
            },
      ),
    },
    now,
  );
}

export function fixMeeting(m: Meeting, start: string, placeId: Id | undefined, now = new Date()) {
  if (Number.isNaN(Date.parse(start))) throw new DomainError('Некорректное время');
  if (placeId && !m.places.some((p) => p.id === placeId)) throw new DomainError('Место не найдено');
  const final: NonNullable<Meeting['final']> = {
    start: new Date(start).toISOString(),
    fixedAt: now.toISOString(),
  };
  if (placeId) final.placeId = placeId;
  return { ...touch({ ...m, final }, now), settingsUpdatedAt: now.toISOString() };
}

export function unfixMeeting(m: Meeting, now = new Date()) {
  const next = { ...touch(m, now), settingsUpdatedAt: now.toISOString() };
  delete next.final;
  return next;
}

/**
 * «Повторить встречу»: та же компания, те же места и настройки, но новые даты —
 * сдвиг на целое число недель вперёд, чтобы дни недели совпали (пятница остаётся пятницей).
 * Отметки, лайки и фиксация не копируются.
 */
export function duplicateMeeting(
  m: Meeting,
  today: string,
  now = new Date(),
  idGen: IdGen = defaultIdGen,
): Meeting {
  const dates = [...m.dates].sort();
  const daysBehind = daysBetween(dates[0], today);
  const weeks = Math.max(1, Math.ceil(daysBehind / 7));
  const ts = now.toISOString();
  const idMap = new Map(m.participants.map((p) => [p.id, idGen()]));
  const participants = m.participants.map((p) => ({
    id: idMap.get(p.id)!,
    name: p.name,
    isRequired: p.isRequired,
    updatedAt: ts,
  }));
  return {
    id: idGen(),
    title: m.title,
    timezone: m.timezone,
    dates: dates.map((d) => addDays(d, weeks * 7)),
    dayStartMin: m.dayStartMin,
    dayEndMin: m.dayEndMin,
    durationMin: m.durationMin,
    participants,
    availability: {},
    places: m.places.map((pl) => {
      const author = idMap.get(pl.addedBy) ?? participants[0]?.id ?? pl.addedBy;
      return { ...pl, id: idGen(), addedBy: author, votes: [] };
    }),
    createdAt: ts,
    updatedAt: ts,
    settingsUpdatedAt: ts,
  };
}

export type MeetingStatus = 'collecting' | 'fixed' | 'past';

export function meetingStatus(m: Meeting, now: Date = new Date()): MeetingStatus {
  if (m.final) {
    return Date.parse(finalEnd(m, m.final.start)) < now.getTime() ? 'past' : 'fixed';
  }
  const lastDay = [...m.dates].sort().at(-1) ?? '';
  return lastDay < todayIn(m.timezone, now) ? 'past' : 'collecting';
}

export const STATUS_LABEL: Record<MeetingStatus, string> = {
  collecting: 'Собираем отметки',
  fixed: 'Зафиксирована',
  past: 'Прошла',
};

// ——— Значения по умолчанию для формы создания ———

export const DEFAULT_DAY_START = 10 * 60;
export const DEFAULT_DAY_END = 23 * 60;
export const DEFAULT_DURATION = 120;
export const EVENING_DURATION = 240;

/** Ближайшая неделя: сегодня и ещё 6 дней. */
export function nextWeekDates(today: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(today, i));
}

/** Эти выходные: ближайшие суббота и воскресенье (если сегодня воскресенье — только сегодня). */
export function weekendDates(today: string): string[] {
  const [y, mo, d] = today.split('-').map(Number);
  const wd = new Date(Date.UTC(y, mo - 1, d)).getUTCDay();
  if (wd === 0) return [today];
  const toSat = 6 - wd;
  return [addDays(today, toSat), addDays(today, toSat + 1)];
}
