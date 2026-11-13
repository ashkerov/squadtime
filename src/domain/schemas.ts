import { z } from 'zod';

/**
 * Источник правды для структуры данных. Типы выводятся из схем,
 * поэтому всё, что прочитано из localStorage или файла, проходит проверку.
 */

export const MAX_TITLE_LENGTH = 64;
export const MAX_DAYS = 14;
export const MAX_PARTICIPANTS = 20;
export const MAX_NAME_LENGTH = 40;
export const SLOT_MIN = 30;
export const MAX_PLACE_NAME_LENGTH = 80;
export const MAX_ADDRESS_LENGTH = 200;
export const MAX_URL_LENGTH = 2000;

export const IdSchema = z.string().min(1).max(64);
export type Id = z.infer<typeof IdSchema>;

export const SlotStatusSchema = z.enum(['yes', 'maybe']);
export type SlotStatus = z.infer<typeof SlotStatusSchema>;

const isoDateTime = z.string().refine((s) => !Number.isNaN(Date.parse(s)), 'Ожидается дата ISO');
const isoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ожидается дата YYYY-MM-DD');

export const HttpsUrlSchema = z
  .string()
  .trim()
  .max(MAX_URL_LENGTH)
  .refine((s) => {
    try {
      return new URL(s).protocol === 'https:';
    } catch {
      return false;
    }
  }, 'Ссылка должна начинаться с https://');

export const ParticipantSchema = z.object({
  id: IdSchema,
  name: z.string().trim().min(1).max(MAX_NAME_LENGTH),
  isRequired: z.boolean(),
  rsvp: z.enum(['going', 'not_going']).optional(),
  /** Меняется при любом изменении участника или его отметок — нужно для слияния при импорте. */
  updatedAt: isoDateTime,
});
export type Participant = z.infer<typeof ParticipantSchema>;

export const PlaceSchema = z.object({
  id: IdSchema,
  name: z.string().trim().min(1).max(MAX_PLACE_NAME_LENGTH),
  address: z.string().trim().max(MAX_ADDRESS_LENGTH).optional(),
  mapUrl: HttpsUrlSchema.optional(),
  addedBy: IdSchema,
  votes: z.array(IdSchema),
});
export type Place = z.infer<typeof PlaceSchema>;

export const FinalSchema = z.object({
  start: isoDateTime,
  placeId: IdSchema.optional(),
  fixedAt: isoDateTime,
});
export type Final = z.infer<typeof FinalSchema>;

export const MeetingSchema = z
  .object({
    id: IdSchema,
    title: z.string().trim().min(1).max(MAX_TITLE_LENGTH),
    timezone: z.string().min(1),
    dates: z.array(isoDay).min(1).max(MAX_DAYS),
    dayStartMin: z.number().int().min(0).max(1410),
    dayEndMin: z.number().int().min(30).max(1440),
    durationMin: z.number().int().min(SLOT_MIN).max(1440),
    participants: z.array(ParticipantSchema).max(MAX_PARTICIPANTS),
    /** participantId → (начало слота в UTC → статус) */
    availability: z.record(IdSchema, z.record(z.string(), SlotStatusSchema)),
    places: z.array(PlaceSchema),
    final: FinalSchema.optional(),
    createdAt: isoDateTime,
    updatedAt: isoDateTime,
    /**
     * Когда последний раз менялись настройки встречи или фиксация.
     * Отдельно от updatedAt, чтобы чужие отметки при импорте не откатывали настройки организатора.
     */
    settingsUpdatedAt: isoDateTime.optional(),
  })
  .refine((m) => m.dayEndMin > m.dayStartMin, {
    message: 'Конец дня должен быть позже начала',
    path: ['dayEndMin'],
  });
export type Meeting = z.infer<typeof MeetingSchema>;

export const AppDataSchema = z.object({
  version: z.literal(1),
  meetings: z.array(MeetingSchema),
  /** meetingId → кто сейчас отмечается на этом устройстве */
  activeParticipant: z.record(IdSchema, IdSchema),
});
export type AppData = z.infer<typeof AppDataSchema>;

/** Формат файла .meet.json — тот же, что потом пойдёт на сервер. */
export const MeetingFileSchema = z.object({
  format: z.literal('squadtime.meeting'),
  version: z.literal(1),
  exportedAt: isoDateTime,
  meeting: MeetingSchema,
});
export type MeetingFile = z.infer<typeof MeetingFileSchema>;

export interface NewMeetingInput {
  title: string;
  timezone: string;
  dates: string[];
  dayStartMin: number;
  dayEndMin: number;
  durationMin: number;
  participantNames: string[];
}

export type MeetingSettings = Pick<
  Meeting,
  'title' | 'dates' | 'dayStartMin' | 'dayEndMin' | 'durationMin' | 'timezone'
>;
