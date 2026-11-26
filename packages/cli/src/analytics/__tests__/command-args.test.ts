import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { initProject } from '../../commands/actions/init-project';
import { startProject } from '../../commands/actions/start-project';
import { PosthogAnalytics } from '../index';

const API_KEY = 'test-llm-api-key';

const mocks = vi.hoisted(() => ({
  analytics: undefined as unknown,
  init: vi.fn(),
  interactivePrompt: vi.fn(),
  start: vi.fn(),
}));

vi.mock('../..', () => ({
  get analytics() {
    return mocks.analytics;
  },
  origin: undefined,
}));
vi.mock('../../commands/init/init', () => ({ init: mocks.init }));
vi.mock('../../commands/init/utils', () => ({
  checkAndInstallCoreDeps: vi.fn(),
  checkForPkgJson: vi.fn(),
  interactivePrompt: mocks.interactivePrompt,
}));
vi.mock('../../commands/start', () => ({ start: mocks.start }));
vi.mock('../../commands/utils', async importOriginal => ({
  ...(await importOriginal<object>()),
  getVersionTag: async () => 'latest',
  isGitInitialized: async () => true,
}));

/** What PostHog would have received, over a real socket. */
let received: string[] = [];
let server: Server;
let analytics: PosthogAnalytics;
let configDir: string;

beforeAll(async () => {
  server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => {
      const body = Buffer.concat(chunks);
      received.push((req.headers['content-encoding'] === 'gzip' ? gunzipSync(body) : body).toString());
      res.setHeader('content-type', 'application/json').end('{"status":1}');
    });
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
});

afterAll(() => new Promise(resolve => server.close(resolve)));

beforeEach(() => {
  vi.stubEnv('MASTRA_TELEMETRY_DISABLED', '');
  received = [];
  configDir = mkdtempSync(path.join(os.tmpdir(), 'mastra-cli-analytics-'));
  const prototype = PosthogAnalytics.prototype as unknown as {
    getOrCreateAnalyticsConfig: (configPath?: string) => unknown;
  };
  const getConfig = prototype.getOrCreateAnalyticsConfig;
  vi.spyOn(prototype, 'getOrCreateAnalyticsConfig').mockImplementation(function (this: unknown) {
    return getConfig.call(this as typeof prototype, path.join(configDir, 'analytics.json'));
  });
  analytics = new PosthogAnalytics({
    version: 'test-version',
    apiKey: 'test-project',
    host: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
  });
  mocks.analytics = analytics;
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  rmSync(configDir, { recursive: true, force: true });
});

async function commandEvents() {
  await analytics.shutdown();
  return received
    .flatMap(body => JSON.parse(body).batch as { event: string; properties: Record<string, unknown> }[])
    .filter(({ event }) => event === 'cli_command')
    .map(({ properties }) => properties);
}

describe('command analytics', () => {
  it('reports the options of `mastra init` without the API key, paths or project name', async () => {
    await initProject({
      dir: 'private-dir',
      components: ['agents'],
      llm: 'openai',
      llmApiKey: API_KEY,
      example: false,
      observabilityProject: 'private-project',
    });

    // The command itself still gets the key.
    expect(mocks.init).toHaveBeenCalledWith(expect.objectContaining({ llmApiKey: API_KEY }));
    const events = await commandEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ command: 'init', status: 'success' });
    expect(events[0]!.args).toEqual({ components: ['agents'], llm: 'openai', example: false });
    expect(received.join()).not.toMatch(/test-llm-api-key|private-/);
  });

  it('does not report an API key entered at the `mastra init` prompt', async () => {
    mocks.interactivePrompt.mockResolvedValue({ llmProvider: 'openai', llmApiKey: API_KEY });

    await initProject({});

    expect(mocks.init).toHaveBeenCalledWith(expect.objectContaining({ llmApiKey: API_KEY }));
    expect(await commandEvents()).toHaveLength(1);
    expect(received.join()).not.toContain(API_KEY);
  });

  it('does not report the custom Node.js arguments of `mastra start`', async () => {
    await startProject({ dir: 'out', customArgs: `--token=${API_KEY}` });

    expect(mocks.start).toHaveBeenCalledWith(expect.objectContaining({ customArgs: [`--token=${API_KEY}`] }));
    const events = await commandEvents();
    expect(events[0]!.args).toEqual({ dir: 'out' });
    expect(received.join()).not.toContain(API_KEY);
  });

  it('only sends known options when a command passes all of its options', async () => {
    const options = { debug: true, llmApiKey: API_KEY };

    // @ts-expect-error `llmApiKey` is not a known analytics option
    analytics.trackCommand({ command: 'future', args: { ...options } });

    const events = await commandEvents();
    expect(events[0]!.args).toEqual({ debug: true });
    expect(received.join()).not.toContain(API_KEY);
  });

  it.each([
    ['https://git.test/a?token=KEY', 'https://git.test/a'],
    ['https://git.test/a?token=label@KEY', 'https://[redacted]'],
    ['https://user:KEY@git.test/a?b=KEY', 'https://[redacted]'],
    ['postgres://user:/?#KEY@db.test/a', 'postgres://[redacted]'],
    ['https://user:KEY/@git.test/a', 'https://[redacted]'],
  ])('removes credentials and query strings from %s in reported errors', async (url, reported) => {
    const error = new Error(`Could not fetch ${url.replaceAll('KEY', API_KEY)} (404)`);

    await expect(
      analytics.trackCommandExecution({ command: 'create', args: {}, execution: () => Promise.reject(error) }),
    ).rejects.toBe(error);

    const events = await commandEvents();
    expect(events[0]).toMatchObject({ status: 'error', error: `Could not fetch ${reported} (404)` });
    expect(received.join()).not.toContain(API_KEY);
  });
});
