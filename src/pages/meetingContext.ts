import { useOutletContext } from 'react-router-dom';
import type { Meeting } from '../domain/schemas';

export interface MeetingCtx {
  meeting: Meeting;
}

export function useMeetingContext() {
  return useOutletContext<MeetingCtx>();
}
