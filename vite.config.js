import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: { host: true, port: 5182, strictPort: true },
  build: { target: 'es2022', chunkSizeWarningLimit: 1000 },
});
