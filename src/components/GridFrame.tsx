import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { formatMinutes, weekday, type Grid } from '../domain/slots';
import s from './Grid.module.css';

const WEEK = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

/** Общий каркас сетки: столбцы — дни, строки — слоты по 30 минут, колонка времени закреплена. */
export const GridFrame = forwardRef<
  HTMLDivElement,
  {
    grid: Grid;
    renderCell: (dayIndex: number, rowIndex: number) => ReactNode;
    onDayClick?: (dayIndex: number) => void;
    dayClickLabel?: (date: string) => string;
    overlay?: ReactNode;
    tableProps?: HTMLAttributes<HTMLDivElement>;
    label: string;
  }
>(function GridFrame(
  { grid, renderCell, onDayClick, dayClickLabel, overlay, tableProps, label },
  ref,
) {
  const cols = grid.days.length;
  return (
    <div className={s.frame}>
      <div className={s.scroller} ref={ref}>
        <div
          {...tableProps}
          className={s.table}
          style={{ ['--cols' as string]: cols }}
          role="grid"
          aria-label={label}
          aria-rowcount={grid.rows.length + 1}
          aria-colcount={cols + 1}
        >
          <div role="row" style={{ display: 'contents' }}>
            <div className={s.corner} role="columnheader" aria-label="Время" />
            {grid.days.map((d, i) => {
              const wd = weekday(d.date);
              const content = (
                <>
                  <span className={s.dayWeek}>{WEEK[wd]}</span>
                  <span className={s.dayNum}>{Number(d.date.slice(8))}</span>
                </>
              );
              const cls = `${s.dayHead} ${wd === 0 || wd === 6 ? s.weekend : ''}`;
              return onDayClick ? (
                <button
                  key={d.date}
                  type="button"
                  role="columnheader"
                  className={cls}
                  onClick={() => onDayClick(i)}
                  aria-label={dayClickLabel?.(d.date)}
                  title={dayClickLabel?.(d.date)}
                >
                  {content}
                </button>
              ) : (
                <div key={d.date} role="columnheader" className={cls}>
                  {content}
                </div>
              );
            })}
          </div>
          {grid.rows.map((minute, r) => (
            <div role="row" key={minute} style={{ display: 'contents' }}>
              <div className={s.timeLabel} role="rowheader" aria-label={formatMinutes(minute)}>
                {minute % 60 === 0 ? formatMinutes(minute) : ''}
              </div>
              {grid.days.map((_, d) => renderCell(d, r))}
            </div>
          ))}
        </div>
      </div>
      {overlay}
    </div>
  );
});
