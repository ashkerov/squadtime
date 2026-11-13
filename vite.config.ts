import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // 127.0.0.1, а не ::1 — чтобы localhost открывался в любом браузере; --host откроет сайт для телефона
  server: { host: '127.0.0.1', port: 5173 },
  // Zod и часовые пояса весят ~170 КБ gzip — для локальной версии это нормально
  build: { chunkSizeWarningLimit: 700 },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
