import { useMemo } from 'react';
import type { BestOption } from '../domain/findBestSlots';
import type { Meeting } from '../domain/schemas';
import { formatDayShort, formatMinutes, SLOT_MS, type Grid } from '../domain/slots';
import { GridFrame } from './GridFrame';
import s from './Grid.module.css';

/**
 * Тепловая карта: 5 ступеней прозрачности акцента (0/25/50/75/100% участников),
 * «если нужно» — штриховка, лучший интервал обведён рамкой.
 */
export function Heatmap({
  grid,
  meeting,
  best,
  selectedKey,
  onSelect,
}: {
  grid: Grid;
  meeting: Meeting;
  best?: BestOption;
  selectedKey?: string;
  onSelect: (key: string) => void;
}) {
  const total = meeting.participants.length;

  const counts = useMemo(() => {
    const map = new Map<string, { yes: number; maybe: number }>();
    for (const p of meeting.participants) {
      const marks = meeting.availability[p.id] ?? {};
      for (const [key, st] of Object.entries(marks)) {
        const c = map.get(key) ?? { yes: 0, maybe: 0 };
        c[st]++;
        map.set(key, c);
      }
    }
    return map;
  }, [meeting]);

  const bestRange = useMemo(() => {
    if (!best) return null;
    return { from: Date.parse(best.start), to: Date.parse(best.end) };
  }, [best]);

  const inBest = (ms: number) => bestRange !== null && ms >= bestRange.from && ms < bestRange.to;

  return (
    <GridFrame
      grid={grid}
      label="Тепловая карта: насколько удобно время всем участникам"
      renderCell={(d, r) => {
        const cell = grid.days[d].cells[r];
        if (!cell) {
          return <div key={d} role="gridcell" className={`${s.cell} ${s.missing}`} />;
        }
        const c = counts.get(cell.key) ?? { yes: 0, maybe: 0 };
        const n = c.yes + c.maybe;
        const level = total === 0 ? 0 : Math.round((n / total) * 4);
        const isBest = inBest(cell.ms);
        const bestTop = isBest && !inBest(cell.ms - SLOT_MS);
        const bestBottom = isBest && !inBest(cell.ms + SLOT_MS);
        const cls = [
          s.cell,
          s.heatCell,
          s[`heat${level}`],
          c.maybe > 0 && s.hasMaybe,
          isBest && s.best,
          bestTop && s.bestTop,
          bestBottom && s.bestBottom,
          selectedKey === cell.key && s.selected,
        ]
          .filter(Boolean)
          .join(' ');
        return (
          <button
            key={d}
            type="button"
            role="gridcell"
            className={cls}
            onClick={() => onSelect(cell.key)}
            aria-label={`${formatDayShort(cell.date)}, ${formatMinutes(cell.minute)}: могут ${c.yes}, если нужно ${c.maybe} из ${total}`}
          >
            {n > 0 && <span>{n}</span>}
          </button>
        );
      }}
    />
  );
}
