import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', '@supabase/supabase-js']
        }
      }
    }
  }
});
