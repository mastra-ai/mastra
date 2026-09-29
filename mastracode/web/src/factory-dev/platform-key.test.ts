import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { checkSavedPlatformKey } from './platform-key.js';

let dir: string;
let envFile: string;

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'factory-platform-key-'));
  envFile = path.join(dir, '.env');
  vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
});

afterEach(async () => {
  vi.restoreAllMocks();
  await fs.rm(dir, { recursive: true, force: true });
});

function problem(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/problem+json' } });
}

function check(fetchImpl: typeof fetch, env: NodeJS.ProcessEnv = {}) {
  return checkSavedPlatformKey({ secretKey: 'sk_saved', env, envFile, fetchImpl });
}

describe('checkSavedPlatformKey', () => {
  it('reports rejected only when the Platform rejects the key itself', async () => {
    const rejected = vi
      .fn<typeof fetch>()
      .mockResolvedValue(problem(401, { type: 'authentication_error', detail: 'Invalid API key' }));

    await expect(check(rejected)).resolves.toEqual({ outcome: 'rejected' });
    await expect(check(vi.fn<typeof fetch>().mockResolvedValue(Response.json({ connections: [] })))).resolves.toEqual({
      outcome: 'accepted',
    });
  });

  it('keeps the saved key when the Platform is unreachable or failing', async () => {
    const offline = vi.fn<typeof fetch>().mockRejectedValue(new TypeError('fetch failed'));
    const serverError = vi.fn<typeof fetch>().mockResolvedValue(problem(503, { detail: 'Unavailable' }));

    await expect(check(offline)).resolves.toEqual({ outcome: 'unchecked', reason: 'fetch failed' });
    await expect(check(serverError)).resolves.toMatchObject({ outcome: 'unchecked' });
  });

  it("checks the key against the region from the web app's .env, like the server will", async () => {
    await fs.writeFile(envFile, 'MASTRA_PLATFORM_REGION=eu\n');
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ connections: [] }));

    await check(fetchImpl);

    expect(String(fetchImpl.mock.calls[0]?.[0])).toBe('https://integrations.eu.mastra.ai/v2/connections');
  });
});
