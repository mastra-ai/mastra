import { ensureInngestCliBinary } from './inngest-cli';

/**
 * Vitest globalSetup: resolve the Inngest CLI dev-server binary before any
 * test file runs, so a missing install fails fast once with clear
 * instructions instead of surfacing mid-suite.
 */
export default function setup() {
  ensureInngestCliBinary();
}
