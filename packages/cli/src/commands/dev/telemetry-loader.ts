import { register } from 'node:module';

/**
 * Main loader hook that modifies module resolution
 */
register('./telemetry-resolver.js', import.meta.url);
