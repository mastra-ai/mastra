import { register } from 'node:module';
register('../../scripts/typescript-loader.mjs', import.meta.url);
await import('./mastra-worker.ts');
