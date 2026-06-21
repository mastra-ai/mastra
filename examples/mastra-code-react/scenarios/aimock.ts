import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * AIMock harness — the same `@copilotkit/aimock` LLMock that MastraCode's TUI
 * scenario tests use. It stands up a tiny HTTP server that speaks the OpenAI
 * wire protocol and replays a fixture file, so the real agent run streams real
 * tool calls / text without hitting a provider.
 *
 * We resolve the package through MastraCode (it's a workspace/catalog dep there)
 * so this example doesn't need its own copy installed.
 */

const here = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(here, 'fixtures');

/** Minimal shape of the bits of LLMock we use (avoids a type dependency). */
interface LLMockInstance {
  url: string;
  loadFixtureFile: (path: string) => void;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  getRequests: () => unknown[];
}
type LLMockCtor = new (opts: { port: number }) => LLMockInstance;

// Resolve aimock via the mastracode package, which depends on it.
const requireFromMastraCode = createRequire(join(here, '../../..', 'mastracode', 'package.json'));
const { LLMock } = requireFromMastraCode('@copilotkit/aimock') as { LLMock: LLMockCtor };

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
