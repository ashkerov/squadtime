import { createDemoMeeting } from '../domain/demo';
import {
  addParticipant,
  addPlace,
  applySettings,
  createMeeting,
  DomainError,
  duplicateMeeting,
  fixMeeting,
  removeParticipant,
  removePlace,
  renameParticipant,
  restoreParticipant,
  restorePlace,
  setAvailability,
  setRequired,
  setRsvp,
  toggleVote,
  unfixMeeting,
  type NewPlaceInput,
  type ParticipantSnapshot,
} from '../domain/meetings';
import { mergeMeetings, summaryForNew, type ImportSummary } from '../domain/merge';
import {
  AppDataSchema,
  MeetingFileSchema,
  MeetingSchema,
  type AppData,
  type Id,
  type Meeting,
  type MeetingFile,
  type NewMeetingInput,
  type Participant,
  type SlotStatus,
} from '../domain/schemas';
import { deviceTimezone, plural, todayIn } from '../domain/slots';
import { migrate } from './migrations';
import {
  NotFoundError,
  type MeetingPatch,
  type MeetingRepository,
  type PlaceSnapshot,
} from './MeetingRepository';

export const STORAGE_KEY = 'kogda:v1';
export const BROKEN_PREFIX = 'kogda:broken:';
export const WRITE_DELAY_MS = 300;

export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export interface LocalRepoOptions {
  /** Окно для подписки на событие storage и сохранения при закрытии вкладки. */
  win?: Pick<Window, 'addEventListener'>;
  now?: () => Date;
  writeDelayMs?: number;
}

/** Из частично повреждённых данных достаём встречи, которые проходят проверку. */
function salvage(
  json: unknown,
): { meetings: Meeting[]; active: Record<string, string>; lost: number } | null {
  if (typeof json !== 'object' || json === null) return null;
  const list = (json as { meetings?: unknown }).meetings;
  if (!Array.isArray(list)) return null;
  const meetings: Meeting[] = [];
  for (const item of list) {
    const r = MeetingSchema.safeParse(item);
    if (r.success) meetings.push(r.data);
  }
  const rawActive = (json as { activeParticipant?: unknown }).activeParticipant;
  const active: Record<string, string> = {};
  if (rawActive && typeof rawActive === 'object') {
    for (const [k, v] of Object.entries(rawActive)) if (typeof v === 'string') active[k] = v;
  }
  return { meetings, active, lost: list.length - meetings.length };
}

const emptyData = (): AppData => ({ version: 1, meetings: [], activeParticipant: {} });
const clone = <T>(v: T): T => structuredClone(v);

export class LocalStorageRepository implements MeetingRepository {
  private data: AppData = emptyData();
  private timer: ReturnType<typeof setTimeout> | undefined;
  private listeners = new Set<() => void>();
  private warning: string | undefined;
  private readonly now: () => Date;
  private readonly writeDelay: number;

  constructor(
    private readonly storage: StorageLike,
    opts: LocalRepoOptions = {},
  ) {
    this.now = opts.now ?? (() => new Date());
    this.writeDelay = opts.writeDelayMs ?? WRITE_DELAY_MS;
    this.data = this.load();
    opts.win?.addEventListener('storage', (e) => {
      if ((e as StorageEvent).key !== STORAGE_KEY) return;
      if (this.timer) return; // у нас есть несохранённые изменения — они перезапишут чужие
      this.data = this.load();
      this.listeners.forEach((l) => l());
    });
    opts.win?.addEventListener('pagehide', () => this.flush());
    opts.win?.addEventListener('beforeunload', () => this.flush());
  }

  // ——— Загрузка и запись ———

  private load(): AppData {
    let raw: string | null;
    try {
      raw = this.storage.getItem(STORAGE_KEY);
    } catch {
      this.warning =
        'Браузер не даёт доступ к хранилищу — данные не сохранятся после перезагрузки.';
      return emptyData();
    }
    if (raw === null) return emptyData();
    let json: unknown;
    try {
      json = migrate(JSON.parse(raw));
      return AppDataSchema.parse(json);
    } catch (err) {
      // Пытаемся спасти уцелевшие встречи, если повреждена только часть данных.
      const salvaged = salvage(json);
      if (salvaged && salvaged.meetings.length > 0) {
        const backupKey = this.backup(raw);
        const lostText =
          salvaged.lost > 0
            ? `${salvaged.lost} ${plural(salvaged.lost, ['встреча пропущена', 'встречи пропущены', 'встреч пропущено'])}, остальные на месте`
            : 'все встречи на месте';
        this.warning = `Часть данных была повреждена: ${lostText}. Копия сохранена в «${backupKey}».`;
        console.error('Данные повреждены частично', err);
        return { version: 1, meetings: salvaged.meetings, activeParticipant: salvaged.active };
      }
      const backupKey = this.backup(raw);
      try {
        this.storage.removeItem(STORAGE_KEY);
      } catch {
        /* ignore */
      }
      this.warning = `Сохранённые данные повреждены, поэтому начали с чистого листа. Копия сохранена в «${backupKey}».`;
      console.error('Не удалось прочитать данные', err);
      return emptyData();
    }
  }

  /** Сохранить копию повреждённых данных, чтобы их можно было восстановить вручную. */
  private backup(raw: string): string {
    const backupKey = `${BROKEN_PREFIX}${this.now().toISOString()}`;
    try {
      this.storage.setItem(backupKey, raw);
    } catch {
      // нет места для копии — всё равно продолжаем
    }
    return backupKey;
  }

  private schedule() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(), this.writeDelay);
  }

  /** Немедленно записать отложенные изменения (если они есть — иначе не трогаем чужие записи). */
  flush() {
    if (!this.timer) return;
    clearTimeout(this.timer);
    this.timer = undefined;
    try {
      this.storage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch (err) {
      console.error('Не удалось сохранить данные', err);
      this.warning = 'Не удалось сохранить изменения: в хранилище браузера не хватает места.';
      this.listeners.forEach((l) => l());
    }
  }

  private find(id: Id): Meeting {
    const m = this.data.meetings.find((x) => x.id === id);
    if (!m) throw new NotFoundError();
    return m;
  }

  private put(meeting: Meeting) {
    const i = this.data.meetings.findIndex((x) => x.id === meeting.id);
    if (i >= 0) this.data.meetings[i] = meeting;
    else this.data.meetings.push(meeting);
    this.schedule();
  }

  private async mutate(id: Id, fn: (m: Meeting) => Meeting): Promise<Meeting> {
    const next = fn(this.find(id));
    this.put(next);
    return clone(next);
  }

  // ——— Встречи ———

  async list() {
    return clone(this.data.meetings);
  }

  async get(id: Id) {
    const m = this.data.meetings.find((x) => x.id === id);
    return m ? clone(m) : undefined;
  }

  async create(input: NewMeetingInput) {
    const meeting = createMeeting(input, this.now());
    this.put(meeting);
    if (meeting.participants[0]) {
      this.data.activeParticipant[meeting.id] = meeting.participants[0].id;
    }
    return clone(meeting);
  }

  async update(id: Id, patch: MeetingPatch) {
    return this.mutate(id, (m) => applySettings(m, patch, this.now()));
  }

  async remove(id: Id) {
    this.data.meetings = this.data.meetings.filter((m) => m.id !== id);
    delete this.data.activeParticipant[id];
    this.schedule();
  }

  async setAvailability(meetingId: Id, participantId: Id, slots: Record<string, SlotStatus>) {
    return this.mutate(meetingId, (m) => setAvailability(m, participantId, slots, this.now()));
  }

  // ——— Участники ———

  async addParticipant(meetingId: Id, name: string) {
    const res = addParticipant(this.find(meetingId), name, this.now());
    this.put(res.meeting);
    return clone(res);
  }

  async updateParticipant(
    meetingId: Id,
    participantId: Id,
    patch: Partial<Pick<Participant, 'name' | 'isRequired' | 'rsvp'>> & { clearRsvp?: boolean },
  ) {
    return this.mutate(meetingId, (m) => {
      let next = m;
      const now = this.now();
      if (patch.name !== undefined) next = renameParticipant(next, participantId, patch.name, now);
      if (patch.isRequired !== undefined)
        next = setRequired(next, participantId, patch.isRequired, now);
      if (patch.rsvp !== undefined || patch.clearRsvp)
        next = setRsvp(next, participantId, patch.clearRsvp ? undefined : patch.rsvp, now);
      return next;
    });
  }

  async removeParticipant(meetingId: Id, participantId: Id) {
    const res = removeParticipant(this.find(meetingId), participantId, this.now());
    this.put(res.meeting);
    if (this.data.activeParticipant[meetingId] === participantId) {
      delete this.data.activeParticipant[meetingId];
    }
    return clone(res);
  }

  async restoreParticipant(meetingId: Id, snapshot: ParticipantSnapshot) {
    return this.mutate(meetingId, (m) => restoreParticipant(m, snapshot, this.now()));
  }

  // ——— Места ———

  async addPlace(meetingId: Id, input: NewPlaceInput) {
    return this.mutate(meetingId, (m) => addPlace(m, input, this.now()).meeting);
  }

  async removePlace(meetingId: Id, placeId: Id) {
    const res = removePlace(this.find(meetingId), placeId, this.now());
    this.put(res.meeting);
    return clone(res);
  }

  async restorePlace(meetingId: Id, snapshot: PlaceSnapshot) {
    return this.mutate(meetingId, (m) => restorePlace(m, snapshot, this.now()));
  }

  async toggleVote(meetingId: Id, placeId: Id, participantId: Id) {
    return this.mutate(meetingId, (m) => toggleVote(m, placeId, participantId, this.now()));
  }

  // ——— Фиксация ———

  async fix(meetingId: Id, start: string, placeId?: Id) {
    return this.mutate(meetingId, (m) => fixMeeting(m, start, placeId, this.now()));
  }

  async unfix(meetingId: Id) {
    return this.mutate(meetingId, (m) => unfixMeeting(m, this.now()));
  }

  async restoreFinal(meetingId: Id, final: Meeting['final']) {
    return this.mutate(meetingId, (m) =>
      final ? fixMeeting(m, final.start, final.placeId, this.now()) : unfixMeeting(m, this.now()),
    );
  }

  // ——— Файлы ———

  async exportMeeting(id: Id) {
    const file: MeetingFile = {
      format: 'squadtime.meeting',
      version: 1,
      exportedAt: this.now().toISOString(),
      meeting: clone(this.find(id)),
    };
    return JSON.stringify(file, null, 2);
  }

  private parseFile(json: string): Meeting {
    let raw: unknown;
    try {
      raw = JSON.parse(json);
    } catch {
      throw new DomainError('Это не файл встречи: не удалось прочитать JSON.');
    }
    const asFile = MeetingFileSchema.safeParse(raw);
    if (asFile.success) return asFile.data.meeting;
    const asMeeting = MeetingSchema.safeParse(raw);
    if (asMeeting.success) return asMeeting.data;
    throw new DomainError('Файл повреждён или создан другой программой.');
  }

  private plan(json: string): { meeting: Meeting; summary: ImportSummary } {
    const incoming = this.parseFile(json);
    const local = this.data.meetings.find((m) => m.id === incoming.id);
    if (!local) return { meeting: incoming, summary: summaryForNew(incoming) };
    return mergeMeetings(local, incoming);
  }

  async previewImport(json: string) {
    return this.plan(json).summary;
  }

  async importMeeting(json: string) {
    const { meeting, summary } = this.plan(json);
    if (!summary.isNoop) this.put(meeting);
    return summary;
  }

  async duplicate(id: Id) {
    const source = this.find(id);
    const copy = duplicateMeeting(source, todayIn(source.timezone, this.now()), this.now());
    this.put(copy);
    const firstId = copy.participants[0]?.id;
    if (firstId) this.data.activeParticipant[copy.id] = firstId;
    return clone(copy);
  }

  async createDemo() {
    const meeting = createDemoMeeting(deviceTimezone(), this.now());
    this.put(meeting);
    this.data.activeParticipant[meeting.id] = meeting.participants[0].id;
    return clone(meeting);
  }

  // ——— Кто отмечается ———

  async getActiveParticipant(meetingId: Id) {
    const pid = this.data.activeParticipant[meetingId];
    const m = this.data.meetings.find((x) => x.id === meetingId);
    return m?.participants.some((p) => p.id === pid) ? pid : undefined;
  }

  async setActiveParticipant(meetingId: Id, participantId: Id) {
    this.data.activeParticipant[meetingId] = participantId;
    this.schedule();
  }

  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  takeLoadWarning() {
    const w = this.warning;
    this.warning = undefined;
    return w;
  }
}
