import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { crx } from '@crxjs/vite-plugin';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import manifest from './manifest.json';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pageScriptPath = resolve(__dirname, 'src/content/pageScript.ts');

/**
 * Builds pageScript.ts independently using esbuild, bypassing the crx plugin's
 * rollup pipeline which can't handle TypeScript syntax.
 */
function pageScriptPlugin(): Plugin {
  async function compile() {
    const { build } = await import('esbuild');
    const result = await build({
      entryPoints: [pageScriptPath],
      bundle: true,
      write: false,
      format: 'iife',
      target: 'es2020',
    });
    return result.outputFiles[0].text;
  }

  let isDev = false;

  return {
    name: 'page-script',
    configResolved(config) {
      isDev = config.command === 'serve';
    },
    async buildStart() {
      if (isDev) {
        const { writeFileSync, mkdirSync } = await import('fs');
        const code = await compile();
        const distDir = resolve(__dirname, 'dist');
        mkdirSync(distDir, { recursive: true });
        writeFileSync(resolve(distDir, 'pageScript.js'), code);
        writeFileSync(resolve(__dirname, 'public/pageScript.js'), code);
      }
    },
    configureServer(server) {
      server.watcher.add(pageScriptPath);
      server.watcher.on('change', async (changedPath) => {
        if (changedPath === pageScriptPath) {
          const { writeFileSync } = await import('fs');
          const code = await compile();
          writeFileSync(resolve(__dirname, 'dist/pageScript.js'), code);
          writeFileSync(resolve(__dirname, 'public/pageScript.js'), code);
        }
      });
    },
    async generateBundle() {
      if (!isDev) {
        const code = await compile();
        this.emitFile({
          type: 'asset',
          fileName: 'pageScript.js',
          source: code,
        });
      }
    },
  };
}

export default defineConfig({
  plugins: [
    pageScriptPlugin(),
    react(),
    crx({ manifest }),
  ],
  server: {
    port: 5173,
    strictPort: true,
    hmr: { port: 5173 },
    cors: { origin: '*' },
  },
});
