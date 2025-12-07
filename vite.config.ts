import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  plugins: [react()],

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },

  build: {
    outDir: 'dist',
    emptyOutDir: true,

    // This is the magic part
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Big vendor libraries → separate chunk
          if (id.includes('node_modules')) {
            if (
              id.includes('react') ||
              id.includes('react-dom') ||
              id.includes('react-router')
            ) {
              return 'vendor-react';
            }

            if (id.includes('firebase')) return 'vendor-firebase';
            if (id.includes('recharts')) return 'vendor-charts';
            if (id.includes('xlsx')) return 'vendor-xlsx';
            if (id.includes('lucide-react') || id.includes('radix') || id.includes('class-variance-authority')) {
              return 'vendor-ui';
            }

            // Everything else from node_modules that is big
            return 'vendor';
          }
        },
      },
    },

    // Optional: stop the annoying warning (800 kB is perfectly fine after splitting)
    chunkSizeWarningLimit: 800,
  },

  server: {
    port: 3000,
  },
});