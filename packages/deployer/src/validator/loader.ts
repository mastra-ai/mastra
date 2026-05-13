import { register } from 'node:module';

/**
 * Main loader hook that modifies module resolution
 */
register(process.env.MASTRA_SOURCE_MODE ? './custom-resolver.ts' : './custom-resolver.js', import.meta.url);
