import { register } from 'node:module';

/**
 * Main loader hook that modifies module resolution
 */
register('./custom-resolver.js', import.meta.url);
