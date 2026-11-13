import { useQueryClient } from '@tanstack/react-query';
import { useEffect, type ReactNode } from 'react';
import type { MeetingRepository } from '../storage/MeetingRepository';
import { showToast } from '../components/toastBus';
import { RepositoryContext } from './repositoryContext';

export function RepositoryProvider({
  repository,
  children,
}: {
  repository: MeetingRepository;
  children: ReactNode;
}) {
  const qc = useQueryClient();

  useEffect(() => {
    // Изменения из другой вкладки (а потом — с сервера) обновляют все экраны.
    const unsubscribe = repository.subscribe(() => {
      void qc.invalidateQueries();
      const warning = repository.takeLoadWarning();
      if (warning) showToast({ message: warning, tone: 'error', durationMs: 10_000 });
    });
    const warning = repository.takeLoadWarning();
    if (warning) showToast({ message: warning, tone: 'error', durationMs: 12_000 });
    return unsubscribe;
  }, [repository, qc]);

  return <RepositoryContext.Provider value={repository}>{children}</RepositoryContext.Provider>;
}
