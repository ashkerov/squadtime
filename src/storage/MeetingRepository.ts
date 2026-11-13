import type { ImportSummary } from '../domain/merge';
import type { NewPlaceInput, ParticipantSnapshot } from '../domain/meetings';
import type {
  Id,
  Meeting,
  MeetingSettings,
  NewMeetingInput,
  Participant,
  Place,
  SlotStatus,
} from '../domain/schemas';

export type MeetingPatch = Partial<MeetingSettings>;

export interface PlaceSnapshot {
  place: Place;
  index: number;
}

/**
 * Единственная точка работы с данными. Сейчас её реализует localStorage,
 * потом — сервер (ApiRepository с теми же методами через fetch).
 * Все методы асинхронные, даже если localStorage синхронный.
 */
export interface MeetingRepository {
  list(): Promise<Meeting[]>;
  get(id: Id): Promise<Meeting | undefined>;
  create(input: NewMeetingInput): Promise<Meeting>;
  update(id: Id, patch: MeetingPatch): Promise<Meeting>;
  remove(id: Id): Promise<void>;
  setAvailability(
    meetingId: Id,
    participantId: Id,
    slots: Record<string, SlotStatus>,
  ): Promise<Meeting>;

  // Участники
  addParticipant(
    meetingId: Id,
    name: string,
  ): Promise<{ meeting: Meeting; participant: Participant }>;
  updateParticipant(
    meetingId: Id,
    participantId: Id,
    patch: Partial<Pick<Participant, 'name' | 'isRequired' | 'rsvp'>> & { clearRsvp?: boolean },
  ): Promise<Meeting>;
  removeParticipant(
    meetingId: Id,
    participantId: Id,
  ): Promise<{ meeting: Meeting; snapshot: ParticipantSnapshot }>;
  restoreParticipant(meetingId: Id, snapshot: ParticipantSnapshot): Promise<Meeting>;

  // Места
  addPlace(meetingId: Id, input: NewPlaceInput): Promise<Meeting>;
  removePlace(meetingId: Id, placeId: Id): Promise<{ meeting: Meeting; snapshot: PlaceSnapshot }>;
  restorePlace(meetingId: Id, snapshot: PlaceSnapshot): Promise<Meeting>;
  toggleVote(meetingId: Id, placeId: Id, participantId: Id): Promise<Meeting>;

  // Фиксация
  fix(meetingId: Id, start: string, placeId?: Id): Promise<Meeting>;
  unfix(meetingId: Id): Promise<Meeting>;
  /** Вернуть встречу целиком (для «Вернуть» после отмены фиксации). */
  restoreFinal(meetingId: Id, final: Meeting['final']): Promise<Meeting>;

  // Файлы .meet.json
  exportMeeting(id: Id): Promise<string>;
  previewImport(json: string): Promise<ImportSummary>;
  importMeeting(json: string): Promise<ImportSummary>;

  /** «Повторить встречу»: та же компания и места, даты на неделю(и) вперёд. */
  duplicate(id: Id): Promise<Meeting>;

  // Демо
  createDemo(): Promise<Meeting>;

  // «Кто отмечается» — запоминается на этом устройстве для каждой встречи
  getActiveParticipant(meetingId: Id): Promise<Id | undefined>;
  setActiveParticipant(meetingId: Id, participantId: Id): Promise<void>;

  /** Изменения из другого места (другая вкладка, потом — сервер). Возвращает отписку. */
  subscribe(listener: () => void): () => void;
  /** Сообщение о проблеме при загрузке данных (например, битый JSON) — показывается один раз. */
  takeLoadWarning(): string | undefined;
}

export class NotFoundError extends Error {
  constructor(what = 'Встреча не найдена') {
    super(what);
  }
}
