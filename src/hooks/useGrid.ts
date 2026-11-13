import { useMemo } from 'react';
import type { Meeting } from '../domain/schemas';
import { buildGrid } from '../domain/slots';

/** Сетка пересчитывается только при смене дат/часов/пояса, а не при каждой отметке. */
export function useGrid(meeting: Meeting) {
  const { dayStartMin, dayEndMin, timezone } = meeting;
  const datesKey = meeting.dates.join(',');
  return useMemo(
    () => buildGrid({ dates: datesKey.split(','), dayStartMin, dayEndMin, timezone }),
    [datesKey, dayStartMin, dayEndMin, timezone],
  );
}
