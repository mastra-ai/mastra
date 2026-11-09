import { register } from 'node:module';
register('./typescript-loader.mjs', import.meta.url);
await import('./usage-delivery-worker.ts');
