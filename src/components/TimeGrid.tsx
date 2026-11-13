import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import { isPastSlot } from '../domain/marks';
import type { SlotStatus } from '../domain/schemas';
import { formatDayShort, formatMinutes, type Grid, type Slot } from '../domain/slots';
import { GridFrame } from './GridFrame';
import s from './Grid.module.css';

type Marks = Record<string, SlotStatus>;
interface Pos {
  d: number;
  r: number;
}

const STATUS_TEXT: Record<SlotStatus, string> = { yes: 'могу', maybe: 'если нужно' };

function vibrate() {
  try {
    navigator.vibrate?.(5); // на iPhone вибрации нет — просто пропускаем
  } catch {
    /* ignore */
  }
}

function sameMarks(a: Marks, b: Marks) {
  const ka = Object.keys(a);
  return ka.length === Object.keys(b).length && ka.every((k) => a[k] === b[k]);
}

/**
 * Сетка доступности на Pointer Events: мышь, палец и клавиатура.
 * Протягивание выделяет прямоугольник от первой ячейки до текущей:
 * если первая ячейка уже была в текущем статусе — стираем, иначе закрашиваем.
 * Двумя пальцами сетка прокручивается.
 */
export function TimeGrid({
  grid,
  value,
  mode,
  onChange,
  disabled,
  overlay,
  nowMs,
  hints,
}: {
  grid: Grid;
  value: Marks;
  mode: SlotStatus;
  onChange: (next: Marks) => void;
  disabled?: boolean;
  overlay?: ReactNode;
  /** Слоты, закончившиеся раньше этого момента, отмечать нельзя. */
  nowMs?: number;
  /** Сколько других участников отметили слот — подсказка, куда «подтянуться». */
  hints?: Record<string, number>;
}) {
  const [draft, setDraft] = useState<Marks | null>(null);
  const [focus, setFocus] = useState<Pos>({ d: 0, r: 0 });
  const draftRef = useRef<Marks | null>(null);
  const committedRef = useRef(false);
  const drag = useRef<{ anchor: Pos; current: Pos; paint: SlotStatus | null; id: number } | null>(
    null,
  );
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pan = useRef<{ x: number; y: number } | null>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  // Последнее значение, отправленное наверх: быстрые действия подряд не теряют друг друга,
  // даже если новое value ещё не пришло.
  const latest = useRef(value);

  const emit = (next: Marks) => {
    latest.current = next;
    onChange(next);
  };

  const updateDraft = (next: Marks | null) => {
    draftRef.current = next;
    setDraft(next);
  };

  // После сохранения держим черновик, пока не придёт новое значение, — без мигания.
  useEffect(() => {
    latest.current = value;
    if (committedRef.current) {
      committedRef.current = false;
      updateDraft(null);
    }
  }, [value]);

  const shown = draft ?? value;
  const past = (cell: { ms: number }) => nowMs !== undefined && isPastSlot(cell, nowMs);

  const applyRect = (a: Pos, b: Pos, paint: SlotStatus | null): Marks => {
    const next = { ...latest.current };
    for (let d = Math.min(a.d, b.d); d <= Math.max(a.d, b.d); d++) {
      for (let r = Math.min(a.r, b.r); r <= Math.max(a.r, b.r); r++) {
        const cell = grid.days[d]?.cells[r];
        if (!cell || past(cell)) continue;
        if (paint) next[cell.key] = paint;
        else delete next[cell.key];
      }
    }
    return next;
  };

  const posOf = (el: Element | null): Pos | null => {
    const cell = el?.closest<HTMLElement>('[data-d]');
    if (!cell) return null;
    return { d: Number(cell.dataset.d), r: Number(cell.dataset.r) };
  };

  const commit = () => {
    const next = draftRef.current;
    if (next && !sameMarks(next, latest.current)) {
      committedRef.current = true;
      emit(next);
    } else {
      updateDraft(null);
    }
  };

  const midpoint = () => {
    const pts = [...pointers.current.values()];
    return {
      x: pts.reduce((a, p) => a + p.x, 0) / pts.length,
      y: pts.reduce((a, p) => a + p.y, 0) / pts.length,
    };
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const pos = posOf(e.target as Element);
    if (!pos) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.current.size >= 2) {
      // Второй палец: отменяем рисование и переходим в прокрутку.
      drag.current = null;
      updateDraft(null);
      pan.current = midpoint();
      return;
    }

    const cell = grid.days[pos.d]?.cells[pos.r];
    if (!cell) return;
    e.preventDefault();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    const paint = latest.current[cell.key] === mode ? null : mode;
    drag.current = { anchor: pos, current: pos, paint, id: e.pointerId };
    setFocus(pos);
    updateDraft(applyRect(pos, pos, paint));
    if (e.pointerType !== 'mouse') vibrate();
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (pointers.current.has(e.pointerId)) {
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }
    if (pan.current && pointers.current.size >= 2) {
      const mid = midpoint();
      const dx = mid.x - pan.current.x;
      const dy = mid.y - pan.current.y;
      if (scrollerRef.current) scrollerRef.current.scrollLeft -= dx;
      window.scrollBy(0, -dy);
      pan.current = mid;
      return;
    }
    const dr = drag.current;
    if (!dr || dr.id !== e.pointerId) return;

    // Автопрокрутка у краёв горизонтально листаемой сетки.
    const sc = scrollerRef.current;
    if (sc) {
      const rect = sc.getBoundingClientRect();
      if (e.clientX > rect.right - 24) sc.scrollLeft += 12;
      else if (e.clientX < rect.left + 76) sc.scrollLeft -= 12;
    }

    const pos = posOf(document.elementFromPoint(e.clientX, e.clientY));
    if (!pos || (pos.d === dr.current.d && pos.r === dr.current.r)) return;
    dr.current = pos;
    updateDraft(applyRect(dr.anchor, pos, dr.paint));
    if (e.pointerType !== 'mouse') vibrate();
  };

  const endPointer = (e: ReactPointerEvent<HTMLDivElement>, cancelled: boolean) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pan.current = null;
    const dr = drag.current;
    if (!dr || dr.id !== e.pointerId) return;
    drag.current = null;
    if (cancelled) updateDraft(null);
    else commit();
  };

  const focusCell = (pos: Pos) => {
    setFocus(pos);
    scrollerRef.current
      ?.querySelector<HTMLElement>(`[data-d="${pos.d}"][data-r="${pos.r}"]`)
      ?.focus();
  };

  const toggleOne = (pos: Pos) => {
    const cell = grid.days[pos.d]?.cells[pos.r];
    if (!cell || disabled || past(cell)) return;
    const next = { ...latest.current };
    if (next[cell.key] === mode) delete next[cell.key];
    else next[cell.key] = mode;
    emit(next);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const pos = posOf(e.target as Element);
    if (!pos) return;
    const maxD = grid.days.length - 1;
    const maxR = grid.rows.length - 1;
    const moves: Record<string, Pos> = {
      ArrowUp: { d: pos.d, r: Math.max(0, pos.r - 1) },
      ArrowDown: { d: pos.d, r: Math.min(maxR, pos.r + 1) },
      ArrowLeft: { d: Math.max(0, pos.d - 1), r: pos.r },
      ArrowRight: { d: Math.min(maxD, pos.d + 1), r: pos.r },
      Home: { d: pos.d, r: 0 },
      End: { d: pos.d, r: maxR },
    };
    if (moves[e.key]) {
      e.preventDefault();
      focusCell(moves[e.key]);
    } else if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      toggleOne(pos);
    }
  };

  const toggleDay = (d: number) => {
    if (disabled) return;
    const cells = grid.days[d].cells.filter((c): c is Slot => c !== null && !past(c));
    if (cells.length === 0) return;
    const allSet = cells.every((c) => latest.current[c.key] === mode);
    const next = { ...latest.current };
    for (const c of cells) {
      if (allSet) delete next[c.key];
      else next[c.key] = mode;
    }
    emit(next);
  };

  return (
    <GridFrame
      ref={scrollerRef}
      grid={grid}
      label="Сетка доступности. Стрелки — перемещение, пробел — отметить или снять отметку."
      onDayClick={toggleDay}
      dayClickLabel={(date) => `${formatDayShort(date)}: отметить или снять весь день`}
      overlay={overlay}
      tableProps={{
        onPointerDown,
        onPointerMove,
        onPointerUp: (e) => endPointer(e, false),
        onPointerCancel: (e) => endPointer(e, true),
        onLostPointerCapture: (e) => endPointer(e, false),
        onKeyDown,
        onContextMenu: (e) => e.preventDefault(),
      }}
      renderCell={(d, r) => {
        const cell = grid.days[d].cells[r];
        const isFocus = focus.d === d && focus.r === r;
        if (!cell) {
          return (
            <div
              key={d}
              role="gridcell"
              className={`${s.cell} ${s.missing}`}
              data-d={d}
              data-r={r}
              tabIndex={isFocus ? 0 : -1}
              aria-label="Этого времени нет из-за перевода часов"
              aria-disabled="true"
            />
          );
        }
        const st = shown[cell.key];
        const isPast = past(cell);
        const others = hints?.[cell.key] ?? 0;
        return (
          <div
            key={d}
            role="gridcell"
            className={`${s.cell} ${s.markCell} ${st ? s[st] : ''} ${isPast ? s.past : ''}`}
            data-d={d}
            data-r={r}
            tabIndex={isFocus ? 0 : -1}
            aria-selected={Boolean(st)}
            aria-disabled={isPast || undefined}
            aria-label={`${formatDayShort(cell.date)}, ${formatMinutes(cell.minute)}${st ? ` — ${STATUS_TEXT[st]}` : ''}${isPast ? ', уже прошло' : ''}${others ? `, другие: ${others}` : ''}`}
            onFocus={() => !isFocus && setFocus({ d, r })}
          >
            {others > 0 && !isPast && (
              <span className={s.hint} aria-hidden="true">
                {others}
              </span>
            )}
          </div>
        );
      }}
    />
  );
}
