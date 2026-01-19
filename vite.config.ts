import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { crx } from '@crxjs/vite-plugin';
import { resolve } from 'path';
import manifest from './manifest.json';

export default defineConfig({
  plugins: [
    react(),
    crx({ manifest }),
  ],
  build: {
    rollupOptions: {
      input: {
        popup: 'index.html',
        pageScript: resolve(__dirname, 'src/content/pageScript.ts'),
      },
      output: {
        entryFileNames: (chunkInfo) => {
          // Output pageScript.js at root level for web_accessible_resources
          if (chunkInfo.name === 'pageScript') {
            return 'pageScript.js';
          }
          return 'assets/[name]-[hash].js';
        },
      },
    },
  },
});
