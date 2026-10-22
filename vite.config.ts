import { defineConfig } from 'vite';

// Geliştirmede /ws isteklerini yerel oyun sunucusuna (8787) yönlendir
export default defineConfig({
  server: {
    proxy: {
      '/ws': { target: 'ws://127.0.0.1:8787', ws: true },
    },
  },
});
