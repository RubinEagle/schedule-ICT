import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const page = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: false,
    // Две настоящие страницы: / — личное расписание, /table/ — из общей таблицы
    rollupOptions: { input: { main: page('./index.html'), table: page('./table/index.html') } },
  },
  test: { include: ['tests/**/*.test.ts'] },
} as ReturnType<typeof defineConfig> & { test: unknown });
