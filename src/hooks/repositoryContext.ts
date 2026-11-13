import { createContext, useContext } from 'react';
import type { MeetingRepository } from '../storage/MeetingRepository';

export const RepositoryContext = createContext<MeetingRepository | null>(null);

export function useRepository(): MeetingRepository {
  const repo = useContext(RepositoryContext);
  if (!repo) throw new Error('RepositoryProvider не найден');
  return repo;
}
