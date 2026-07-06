import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { LLMock } from '@copilotkit/aimock';

/**
 * AIMock harness — the same `@copilotkit/aimock` LLMock that MastraCode's TUI
 * scenario tests use. It stands up a tiny HTTP server that speaks the OpenAI
 * wire protocol and replays a fixture file, so the real agent run streams real
 * tool calls / text without hitting a provider.
 */

const here = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(here, 'fixtures');

export interface AimockHandle {
  /** OpenAI-compatible base URL, including the `/v1` suffix. */
  baseUrl: string;
  requestCount: () => number;
  requests: () => unknown[];
  stop: () => Promise<void>;
}

export async function startAimock(fixtureFile: string): Promise<AimockHandle> {
  const mock = new LLMock({ port: 0 });
  mock.loadFixtureFile(join(fixturesDir, fixtureFile));
  await mock.start();
  const baseUrl = `${mock.url.replace(/\/+$/, '')}/v1`;
  return {
    baseUrl,
    requestCount: () => mock.getRequests().length,
    requests: () => mock.getRequests() as unknown[],
    stop: () => mock.stop(),
  };
}
