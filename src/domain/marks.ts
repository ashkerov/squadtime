import type { SlotStatus } from './schemas';
import { SLOT_MS, type Grid, type Slot } from './slots';

/** Операции над отметками одного участника — для инструментов на экране отметок. */

export type Marks = Record<string, SlotStatus>;

/** Слот уже закончился — отмечать его бессмысленно. */
export function isPastSlot(slot: Pick<Slot, 'ms'>, nowMs: number): boolean {
  return slot.ms + SLOT_MS <= nowMs;
}

/** Есть ли у дня хоть одна отметка. */
export function dayHasMarks(grid: Grid, marks: Marks, dayIndex: number): boolean {
  return grid.days[dayIndex].cells.some((c) => c !== null && marks[c.key] !== undefined);
}

/**
 * Скопировать отметки дня на все остальные дни (по настенному времени).
 * Прошедшие слоты не трогаем.
 */
export function copyDayToAll(grid: Grid, marks: Marks, fromDay: number, nowMs = 0): Marks {
  const next: Marks = { ...marks };
  const source = grid.days[fromDay];
  grid.days.forEach((day, d) => {
    if (d === fromDay) return;
    day.cells.forEach((cell, r) => {
      if (!cell || isPastSlot(cell, nowMs)) return;
      const src = source.cells[r];
      const st = src ? marks[src.key] : undefined;
      if (st) next[cell.key] = st;
      else delete next[cell.key];
    });
  });
  return next;
}

/** Сколько других участников отметили каждый слот («если нужно» тоже считается). */
export function othersCount(
  availability: Record<string, Marks>,
  exceptId: string | undefined,
): Record<string, number> {
  const res: Record<string, number> = {};
  for (const [pid, marks] of Object.entries(availability)) {
    if (pid === exceptId) continue;
    for (const key of Object.keys(marks)) res[key] = (res[key] ?? 0) + 1;
  }
  return res;
}
