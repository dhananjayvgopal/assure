import { build } from 'esbuild';
import { mkdir } from 'node:fs/promises';

await mkdir('dist/electron', { recursive: true });
await build({
  entryPoints: ['server/database.ts'],
  outfile: 'dist/electron/database.mjs',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node24',
  packages: 'external',
});
