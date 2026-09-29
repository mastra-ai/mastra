import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Mastra } from '@mastra/core/mastra';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { closeRefreshStreams } from '../handlers/client';
import { createHonoServer } from '../index';

let studioPath: string;
beforeAll(async () => {
  studioPath = await mkdtemp(join(tmpdir(), 'mastra-refresh-'));
  await mkdir(join(studioPath, 'assets'));
  await writeFile(
    join(studioPath, 'index.html'),
    `<script>window.MASTRA_DEV_SERVER_INSTANCE_ID = '%%MASTRA_DEV_SERVER_INSTANCE_ID%%';</script>`,
  );
  vi.stubEnv('MASTRA_STUDIO_PATH', studioPath);
});
afterEach(() => closeRefreshStreams());
afterAll(async () => {
  vi.unstubAllEnvs();
  await rm(studioPath, { recursive: true, force: true });
});

const createStudio = (isDev: boolean) =>
  createHonoServer(new Mastra({ server: { studioBase: '/studio' } }), { tools: {}, studio: true, isDev });
async function handshake(app: Awaited<ReturnType<typeof createStudio>>) {
  const response = await app.request('/studio/refresh-events');
  expect(response.status).toBe(200);
  const reader = response.body!.getReader();
  const { value } = await reader.read();
  await reader.cancel();
  return typeof value === 'string' ? value : new TextDecoder().decode(value);
}

describe('Studio dev refresh generation', () => {
  it('omits process identities from production HTML and connections', async () => {
    const first = await createStudio(false);
    const second = await createStudio(false);
    expect(await handshake(first)).toBe('data: connected\n\n');
    expect(await handshake(second)).toBe('data: connected\n\n');
    const html = await (await first.request('/studio')).text();
    expect(html).toContain('window.MASTRA_DEV_SERVER_INSTANCE_ID = "";');
  });

  it('uses the HTML generation in the first dev handshake and subsequent reconnects', async () => {
    const app = await createStudio(true);
    const event = await handshake(app);
    const id = event.match(/^id: (.+)$/m)?.[1];
    expect(id).toBeTruthy();
    const html = await (await app.request('/studio')).text();
    expect(html).toContain(`window.MASTRA_DEV_SERVER_INSTANCE_ID = "${id}";`);
    expect(await handshake(app)).toBe(event);
  });

  it('changes the generation when a new dev server is created', async () => {
    const first = await createStudio(true);
    const second = await createStudio(true);
    expect(await handshake(first)).not.toBe(await handshake(second));
  });
});
