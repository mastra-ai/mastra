import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DesktopSettings, DesktopState } from '../shared/types';
import { DEFAULT_SETTINGS, LOCALHOST } from './defaults';
import { findAvailablePort } from './ports';
import { startStudioShellServer } from './studio-server';

const servers: Server[] = [];
const tempDirs: string[] = [];

function closeServer(server: Server) {
  return new Promise<void>(resolve => server.close(() => resolve()));
}

async function createStudioDist() {
  const dir = await mkdtemp(join(tmpdir(), 'mastra-desktop-studio-'));
  tempDirs.push(dir);
  await mkdir(join(dir, 'assets'));
  await writeFile(
    join(dir, 'index.html'),
    [
      '<!doctype html>',
      '<html>',
      '<head><title>Studio</title></head>',
      '<body>',
      '<div id="root"></div>',
      '<script>',
      'window.__studioConfig = {',
      '  serverHost: "%%MASTRA_SERVER_HOST%%",',
      '  serverPort: "%%MASTRA_SERVER_PORT%%",',
      '  telemetryDisabled: "%%MASTRA_TELEMETRY_DISABLED%%",',
      '  cloudEndpoint: "%%MASTRA_CLOUD_API_ENDPOINT%%"',
      '};',
      'window.MASTRA_DESKTOP_ENDPOINT = "%%MASTRA_DESKTOP_ENDPOINT%%";',
      '</script>',
      '<script type="module" src="/assets/app.js"></script>',
      '</body>',
      '</html>',
    ].join('\n'),
  );
  await writeFile(join(dir, 'assets', 'app.js'), 'window.__studioAssetLoaded = true;');
  return dir;
}

async function createRuntimeServer() {
  const requests: string[] = [];
  const server = createServer((req, res) => {
    requests.push(req.url ?? '');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, LOCALHOST, resolve);
  });
  servers.push(server);
  const address = server.address() as AddressInfo;
  return {
    requests,
    url: `http://${LOCALHOST}:${address.port}`,
  };
}

function createDesktopState(): DesktopState {
  return {
    settings: {
      ...DEFAULT_SETTINGS,
      environmentVariables: {
        OPENAI_API_KEY: 'test-key',
      },
    },
    runtime: {
      state: 'running',
      url: 'http://127.0.0.1:4112',
    },
    studio: {},
    activeServerUrl: 'http://127.0.0.1:4112',
    tabs: [],
    platform: {
      baseUrl: DEFAULT_SETTINGS.platformBaseUrl,
      status: 'signed-out',
      signedIn: false,
      organizations: [],
      projects: [],
    },
    logs: [],
  };
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map(server => closeServer(server)));
  await Promise.all(tempDirs.splice(0).map(dir => rm(dir, { force: true, recursive: true })));
});

describe('Studio shell server', () => {
  it('serves embedded Studio files locally and proxies API requests to the local runtime', async () => {
    const builtStudioPath = await createStudioDist();
    const runtime = await createRuntimeServer();
    const studioPort = await findAvailablePort(3133);
    const studioServer = await startStudioShellServer({
      builtStudioPath,
      port: studioPort,
      serverUrl: runtime.url,
    });
    servers.push(studioServer);

    const studioUrl = `http://${LOCALHOST}:${studioPort}`;
    const html = await fetch(studioUrl).then(response => response.text());
    expect(html).toContain(`serverHost: "${LOCALHOST}"`);
    expect(html).toContain(`serverPort: "${studioPort}"`);
    expect(html).toContain('telemetryDisabled: "true"');
    expect(html).toContain('cloudEndpoint: ""');

    await expect(fetch(`${studioUrl}/assets/app.js`).then(response => response.text())).resolves.toBe(
      'window.__studioAssetLoaded = true;',
    );

    await expect(fetch(`${studioUrl}/api/agents`).then(response => response.json())).resolves.toEqual({ ok: true });
    expect(runtime.requests).toEqual(['/api/agents']);
  });

  it('serves desktop runtime endpoints only when desktop controls are enabled', async () => {
    const builtStudioPath = await createStudioDist();
    const runtime = await createRuntimeServer();
    const studioPort = await findAvailablePort(3133);
    const desktopState = createDesktopState();
    const updateSettings = vi.fn(async (updates: Partial<DesktopSettings>) => ({
      settings: {
        ...desktopState.settings,
        ...updates,
      },
      state: desktopState,
    }));
    const probeOpenAICompatibleModels = vi.fn(async () => ({
      ok: true,
      modelUrl: 'http://localhost:1234/v1',
      models: ['local-model'],
    }));
    const restartRuntime = vi.fn(async () => desktopState);
    const studioServer = await startStudioShellServer({
      builtStudioPath,
      desktopApi: {
        getState: () => desktopState,
        probeOpenAICompatibleModels,
        restartRuntime,
        updateSettings,
      },
      port: studioPort,
      serverUrl: runtime.url,
    });
    servers.push(studioServer);

    const studioUrl = `http://${LOCALHOST}:${studioPort}`;
    const html = await fetch(studioUrl).then(response => response.text());
    expect(html).toContain('window.MASTRA_DESKTOP_ENDPOINT = "/__desktop"');

    await expect(fetch(`${studioUrl}/__desktop/state`).then(response => response.json())).resolves.toMatchObject({
      runtime: { state: 'running' },
      settings: { environmentVariables: { OPENAI_API_KEY: 'test-key' } },
    });

    await expect(
      fetch(`${studioUrl}/__desktop/settings`, {
        body: JSON.stringify({ modelId: 'local-model' }),
        headers: { 'Content-Type': 'application/json' },
        method: 'PATCH',
      }).then(response => response.json()),
    ).resolves.toMatchObject({ settings: { modelId: 'local-model' } });

    await expect(
      fetch(`${studioUrl}/__desktop/probe-models`, {
        body: JSON.stringify({ modelUrl: 'http://localhost:1234/v1' }),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      }).then(response => response.json()),
    ).resolves.toEqual({ ok: true, modelUrl: 'http://localhost:1234/v1', models: ['local-model'] });

    await expect(
      fetch(`${studioUrl}/__desktop/restart-runtime`, { method: 'POST' }).then(response => response.json()),
    ).resolves.toMatchObject({ runtime: { state: 'running' } });
    expect(updateSettings).toHaveBeenCalledWith({ modelId: 'local-model' });
    expect(probeOpenAICompatibleModels).toHaveBeenCalledWith('http://localhost:1234/v1', undefined, undefined);
    expect(restartRuntime).toHaveBeenCalledOnce();
    expect(runtime.requests).toEqual([]);
  });
});
