import { ensureInngestCliBinary } from './inngest-cli';

/**
 * Vitest globalSetup: download the Inngest CLI dev-server binary before any
 * test file runs, so the one-time download doesn't eat into per-test or hook
 * timeouts.
 */
export default function setup() {
  ensureInngestCliBinary();
}
