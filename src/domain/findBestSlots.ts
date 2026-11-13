import type { Id, Meeting } from './schemas';
import { buildGrid, SLOT_MS, slotKey, type Slot } from './slots';
import { SLOT_MIN } from './schemas';

/**
 * Поиск лучшего времени (раздел 6 ТЗ). Чистая функция: без React и без хранилища.
 *
 * 1. Длительность → число слотов k.
 * 2. Для каждого старта берём окно из k слотов подряд внутри одного дня
 *    (подряд — по реальному времени, поэтому переход на летнее/зимнее время учитывается).
 * 3. Участник «может», если все k слотов «могу»; «скорее может», если все «могу»/«если нужно»; иначе «не может».
 * 4. Окна, где не может кто-то из обязательных, отбрасываем.
 * 5. score = 100·(yes + maybe) + yes, сортировка по убыванию, при равенстве — более раннее окно.
 * 6. Соседние окна с одинаковым составом склеиваем в один вариант.
 * 7. Возвращаем топ-N со списками.
 *
 * Участник, который ещё не поставил ни одной отметки, считается «не ответившим»:
 * он попадает в список noResponse и не может заблокировать окна как обязательный —
 * иначе до его ответа топ был бы пустым.
 */

export interface BestOption {
  /** День (YYYY-MM-DD в часовом поясе встречи). */
  date: string;
  /** Самый ранний старт, UTC ISO. */
  start: string;
  /** Самый поздний старт с тем же составом, UTC ISO (совпадает со start, если вариант один). */
  latestStart: string;
  /** Конец интервала при самом позднем старте, UTC ISO. */
  end: string;
  /** Все возможные старты (UTC ISO) внутри склеенного варианта. */
  starts: string[];
  yes: Id[];
  maybe: Id[];
  /** Отметились, но в это время не могут. */
  no: Id[];
  /** Ещё не поставили ни одной отметки. */
  noResponse: Id[];
  score: number;
}

export type BestSlotsInput = Pick<
  Meeting,
  | 'dates'
  | 'dayStartMin'
  | 'dayEndMin'
  | 'timezone'
  | 'durationMin'
  | 'participants'
  | 'availability'
>;

export function scoreOf(yes: number, maybe: number): number {
  return 100 * (yes + maybe) + yes;
}

interface Window {
  date: string;
  startMs: number;
  yes: Id[];
  maybe: Id[];
  no: Id[];
  score: number;
}

export interface FindOptions {
  /** Сколько вариантов вернуть (по умолчанию 3). */
  limit?: number;
  /** Не предлагать окна, которые начинаются раньше этого момента (мс) — прошедшее время. */
  notBefore?: number;
}

export function findBestSlots(
  meeting: BestSlotsInput,
  { limit = 3, notBefore }: FindOptions = {},
): BestOption[] {
  const k = Math.max(1, Math.ceil(meeting.durationMin / SLOT_MIN));
  const durationMs = meeting.durationMin * 60_000;
  const grid = buildGrid(meeting);

  const responded = meeting.participants.filter(
    (p) => Object.keys(meeting.availability[p.id] ?? {}).length > 0,
  );
  const noResponse = meeting.participants.filter((p) => !responded.includes(p)).map((p) => p.id);
  const requiredIds = new Set(responded.filter((p) => p.isRequired).map((p) => p.id));

  if (responded.length === 0) return [];

  const windows: Window[] = [];
  for (const day of grid.days) {
    const slots = day.cells.filter((c): c is Slot => c !== null);
    for (let i = 0; i + k <= slots.length; i++) {
      const win = slots.slice(i, i + k);
      if (win[k - 1].ms - win[0].ms !== (k - 1) * SLOT_MS) continue; // разрыв из-за перевода часов
      if (notBefore !== undefined && win[0].ms < notBefore) continue; // уже прошло

      const yes: Id[] = [];
      const maybe: Id[] = [];
      const no: Id[] = [];
      for (const p of responded) {
        const marks = meeting.availability[p.id] ?? {};
        let all = true;
        let allYes = true;
        for (const s of win) {
          const st = marks[s.key];
          if (st === undefined) {
            all = false;
            break;
          }
          if (st !== 'yes') allYes = false;
        }
        if (!all) no.push(p.id);
        else if (allYes) yes.push(p.id);
        else maybe.push(p.id);
      }

      if (no.some((id) => requiredIds.has(id))) continue;
      if (yes.length + maybe.length === 0) continue;
      windows.push({
        date: day.date,
        startMs: win[0].ms,
        yes,
        maybe,
        no,
        score: scoreOf(yes.length, maybe.length),
      });
    }
  }

  // Склейка соседних окон (шаг 30 минут) с одинаковым составом.
  const groups: Window[][] = [];
  for (const w of windows) {
    const last = groups[groups.length - 1];
    const prev = last?.[last.length - 1];
    if (
      prev &&
      prev.date === w.date &&
      w.startMs - prev.startMs === SLOT_MS &&
      sameIds(prev.yes, w.yes) &&
      sameIds(prev.maybe, w.maybe)
    ) {
      last.push(w);
    } else {
      groups.push([w]);
    }
  }

  const options: BestOption[] = groups.map((g) => {
    const first = g[0];
    const last = g[g.length - 1];
    return {
      date: first.date,
      start: slotKey(first.startMs),
      latestStart: slotKey(last.startMs),
      end: slotKey(last.startMs + durationMs),
      starts: g.map((w) => slotKey(w.startMs)),
      yes: first.yes,
      maybe: first.maybe,
      no: first.no,
      noResponse,
      score: first.score,
    };
  });

  options.sort((a, b) => b.score - a.score || Date.parse(a.start) - Date.parse(b.start));

  // Отсев «поглощённых» вариантов: если более сильный вариант пересекается по времени
  // и подходит всем тем же людям, слабый не даёт выбора — показываем другой вечер.
  const picked: BestOption[] = [];
  for (const o of options) {
    if (picked.some((a) => dominates(a, o))) continue;
    picked.push(o);
    if (picked.length === limit) break;
  }
  return picked;
}

function overlaps(a: BestOption, b: BestOption): boolean {
  return Date.parse(a.start) < Date.parse(b.end) && Date.parse(b.start) < Date.parse(a.end);
}

/** a не хуже b для каждого, кто может в b, и они пересекаются по времени. */
function dominates(a: BestOption, b: BestOption): boolean {
  if (!overlaps(a, b)) return false;
  const aCan = new Set([...a.yes, ...a.maybe]);
  return b.yes.every((id) => a.yes.includes(id)) && b.maybe.every((id) => aCan.has(id));
}

function sameIds(a: Id[], b: Id[]): boolean {
  return a.length === b.length && a.every((id, i) => id === b[i]);
}

/** Кто может / скорее может / не может в один конкретный слот (для тепловой карты). */
export function whoInSlot(
  meeting: Pick<Meeting, 'participants' | 'availability'>,
  key: string,
): { yes: Id[]; maybe: Id[]; no: Id[]; noResponse: Id[] } {
  const res = { yes: [] as Id[], maybe: [] as Id[], no: [] as Id[], noResponse: [] as Id[] };
  for (const p of meeting.participants) {
    const marks = meeting.availability[p.id] ?? {};
    if (Object.keys(marks).length === 0) res.noResponse.push(p.id);
    else if (marks[key] === 'yes') res.yes.push(p.id);
    else if (marks[key] === 'maybe') res.maybe.push(p.id);
    else res.no.push(p.id);
  }
  return res;
}

/** Статус участника для конкретного интервала [start, start + duration). */
export function statusForInterval(
  marks: Record<string, 'yes' | 'maybe'> | undefined,
  startIso: string,
  durationMin: number,
): 'yes' | 'maybe' | 'no' | 'none' {
  if (!marks || Object.keys(marks).length === 0) return 'none';
  const k = Math.max(1, Math.ceil(durationMin / SLOT_MIN));
  const startMs = Date.parse(startIso);
  let allYes = true;
  for (let i = 0; i < k; i++) {
    const st = marks[slotKey(startMs + i * SLOT_MS)];
    if (!st) return 'no';
    if (st !== 'yes') allYes = false;
  }
  return allYes ? 'yes' : 'maybe';
}
