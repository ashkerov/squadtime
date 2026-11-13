import { MutationCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { showToast } from './components/toastBus';
import { Toaster } from './components/Toaster';
import { RepositoryProvider } from './hooks/repository';
import { LocalStorageRepository } from './storage/LocalStorageRepository';
import './styles/tokens.css';
import './styles/global.css';

// Единственная строка, которую нужно поменять при переходе на сервер:
// const repository = new ApiRepository('/api');
const repository = new LocalStorageRepository(window.localStorage, { win: window });

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: Infinity, // данные меняются только через репозиторий — он сам обновляет кеш
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
  mutationCache: new MutationCache({
    onError: (error) =>
      showToast({ message: error.message || 'Что-то пошло не так', tone: 'error' }),
  }),
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RepositoryProvider repository={repository}>
        <App />
        <Toaster />
      </RepositoryProvider>
    </QueryClientProvider>
  </StrictMode>,
);
