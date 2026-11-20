import { access, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createHonoServer } from '@mastra/deployer/server';
import { MastraStorageExporter } from '@mastra/observability';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { loadConfig } from '../src/mastra/config';
import { normalizeHtml } from '../src/mastra/lib/content';

type Runtime = ReturnType<typeof import('../src/mastra/bootstrap').initializeRuntime>;
const runtimes: Runtime[] = [];
// Capture the native public async initialization before importing the runtime entry point.
const exporterInitializations: Promise<void>[] = [];
const originalExporterInit = MastraStorageExporter.prototype.init;
beforeEach(() => {
  vi.spyOn(MastraStorageExporter.prototype, 'init').mockImplementation(function (this: MastraStorageExporter, ...args) {
    const initialized = originalExporterInit.apply(this, args);
    exporterInitializations.push(initialized);
    return initialized;
  });
});
async function closeRuntime(runtime: Runtime) {
  await Promise.all(exporterInitializations);
  await runtime.observability.shutdown();
  await runtime.applicationStore.close();
  await runtime.frameworkStore.close();
}
afterEach(async () => {
  for (const runtime of runtimes.splice(0)) await closeRuntime(runtime);
  exporterInitializations.splice(0);
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.resetModules();
});

async function productionApp(token: string) {
  const directory = await mkdtemp(join(tmpdir(), 'competitor-monitor-auth-'));
  // Reload the production entry point with this server's own configuration.
  vi.stubEnv('MASTRA_DATABASE_URL', `file:${join(directory, 'mastra.db')}`);
  vi.stubEnv('MONITOR_DATABASE_URL', `file:${join(directory, 'monitor.db')}`);
  vi.stubEnv('EXECUTION_MODE', 'production');
  vi.stubEnv('MASTRA_API_TOKEN', token);
  vi.resetModules();
  const { mastra } = await import('../src/mastra/index');
  const { bootstrap } = await import('../src/mastra/bootstrap');
  expect(mastra.getClassifierById('competitor-change-classifier')).toBeDefined();
  runtimes.push(bootstrap);
  return createHonoServer(mastra);
}

describe('native Mastra SimpleAuth', () => {
  it('runtime_observability_closes_before_framework_storage', async () => {
    await productionApp('synthetic-shutdown-token');
    const runtime = runtimes.at(-1)!;
    expect(exporterInitializations.length).toBeGreaterThan(0);
    const order: string[] = [];
    const shutdown = runtime.observability.shutdown.bind(runtime.observability);
    const close = runtime.frameworkStore.close.bind(runtime.frameworkStore);
    vi.spyOn(runtime.observability, 'shutdown').mockImplementation(async () => {
      await shutdown();
      order.push('observability');
    });
    vi.spyOn(runtime.frameworkStore, 'close').mockImplementation(async () => {
      expect(order).toEqual(['observability']);
      await close();
      order.push('storage');
    });
    await closeRuntime(runtime);
    runtimes.splice(runtimes.indexOf(runtime), 1);
    expect(order).toEqual(['observability', 'storage']);
  });

  it('registers OpenAI chat without provider calls during initialization', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'competitor-monitor-chat-init-'));
    vi.stubEnv('EXECUTION_MODE', 'local');
    vi.stubEnv('OPENAI_API_KEY', 'synthetic-chat-key');
    vi.stubEnv('MASTRA_DATABASE_URL', `file:${join(directory, 'mastra.db')}`);
    vi.stubEnv('MONITOR_DATABASE_URL', `file:${join(directory, 'monitor.db')}`);
    const fetch = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('UNEXPECTED_PROVIDER_CALL'));
    const { mastra } = await import('../src/mastra/index');
    const { bootstrap, initializeRuntime } = await import('../src/mastra/bootstrap');
    runtimes.push(bootstrap);
    expect(mastra.getAgent('competitorMonitor').id).toBe('competitor-monitor-agent');
    expect(bootstrap.summaryAgent).toBeDefined();
    const withoutChat = initializeRuntime({
      MASTRA_DATABASE_URL: `file:${join(directory, 'without-chat-mastra.db')}`,
      MONITOR_DATABASE_URL: `file:${join(directory, 'without-chat-monitor.db')}`,
    });
    runtimes.push(withoutChat);
    expect(withoutChat.monitorAgent).toBeUndefined();
    expect(withoutChat.summaryAgent).toBeUndefined();
    expect(withoutChat.workflow).toBeDefined();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('reuses durable databases from native dev through build cleanup and native start', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'competitor-monitor-start-'));
    const nativeDevRoot = join(projectRoot, '.mastra');
    const outputDirectory = join(nativeDevRoot, 'output');
    const packagesFile = join(nativeDevRoot, 'mastra-packages.json');
    await mkdir(outputDirectory, { recursive: true });
    vi.stubEnv('EXECUTION_MODE', 'local');
    // Mastra CLI 1.31.3's dev launcher sets these values while running from `.mastra/output`.
    vi.stubEnv('MASTRA_PROJECT_ROOT', nativeDevRoot);
    vi.stubEnv('MASTRA_DEV', 'true');
    vi.stubEnv('MASTRA_PACKAGES_FILE', packagesFile);
    vi.stubEnv('MASTRA_DATABASE_URL', undefined);
    vi.stubEnv('MONITOR_DATABASE_URL', undefined);
    const currentDirectory = vi.spyOn(process, 'cwd').mockReturnValue(outputDirectory);
    await import('../src/mastra/index');
    const { bootstrap: first, initializeRuntime } = await import('../src/mastra/bootstrap');
    runtimes.push(first);
    await first.frameworkStore.init();
    const run = await first.applicationStore.beginRun('durable-monitor');
    const snapshot = await first.applicationStore.persistAcceptedSnapshot({
      runId: run.id,
      monitorId: 'durable-monitor',
      sourceId: 'pricing',
      sourceUrl: 'https://public.example/pricing',
      normalizationProfile: 'test-profile',
      content: normalizeHtml('<main><h1>Pricing</h1><p>Starter plan $19 per month.</p></main>'),
      evidence: [],
      promoteBaseline: true,
    });
    await first.applicationStore.finishRun(run, 'success', { snapshotId: snapshot.id });
    const devPaths = loadConfig({
      MASTRA_PROJECT_ROOT: nativeDevRoot,
      MASTRA_DEV: 'true',
      MASTRA_PACKAGES_FILE: packagesFile,
    }).storage;
    expect(devPaths.mastraUrl).toContain(`${projectRoot}/.data/mastra.db`);
    expect(devPaths.monitorUrl).toContain(`${projectRoot}/.data/competitor-monitor.db`);
    // A direct explicit `.mastra` root remains literal unless the native dev marker is present.
    expect(loadConfig({ MASTRA_PROJECT_ROOT: nativeDevRoot }).storage.monitorUrl).toContain(
      `${nativeDevRoot}/.data/competitor-monitor.db`,
    );
    await closeRuntime(first);
    runtimes.splice(runtimes.indexOf(first), 1);
    // Native build preparation wipes only this temporary project's build area.
    await rm(nativeDevRoot, { recursive: true });
    currentDirectory.mockReturnValue(projectRoot);
    vi.stubEnv('MASTRA_DEV', undefined);
    vi.stubEnv('MASTRA_PACKAGES_FILE', undefined);
    vi.stubEnv('MASTRA_PROJECT_ROOT', projectRoot);
    const startPaths = loadConfig({ MASTRA_PROJECT_ROOT: projectRoot }).storage;
    expect(startPaths).toEqual(devPaths);
    expect(loadConfig({}).storage).toEqual(startPaths);
    const reopened = initializeRuntime({});
    runtimes.push(reopened);
    await reopened.frameworkStore.init();
    expect((await reopened.applicationStore.baseline('durable-monitor', 'pricing'))?.id).toBe(snapshot.id);
    await access(join(projectRoot, '.data', 'mastra.db'));
    await access(join(projectRoot, '.data', 'competitor-monitor.db'));
    const custom = loadConfig({ MASTRA_PROJECT_ROOT: projectRoot, MONITOR_DATABASE_URL: 'file:./custom/history.db' });
    const overridden = initializeRuntime({
      MASTRA_PROJECT_ROOT: projectRoot,
      MONITOR_DATABASE_URL: 'file:./custom/history.db',
    });
    runtimes.push(overridden);
    expect(custom.storage.monitorUrl).toContain('/custom/history.db');
    await overridden.applicationStore.init();
    await access(join(projectRoot, 'custom', 'history.db'));
  });

  it('production_auth_rejects_missing_invalid_tokens', async () => {
    const app = await productionApp('current-token');
    const protectedReads = ['/api/workflows', '/api/workflows/competitorMonitor/runs', '/api/schedules'];
    for (const path of protectedReads) {
      expect((await app.request(path)).status, path).toBe(401);
      expect((await app.request(path, { headers: { Authorization: 'Bearer invalid-token' } })).status, path).toBe(401);
      expect((await app.request(path, { headers: { Authorization: 'Bearer current-token' } })).status, path).toBe(200);
    }
    const startPath = '/api/workflows/competitorMonitor/start';
    const start = { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' };
    expect((await app.request(startPath, start)).status).toBe(401);
    expect(
      (
        await app.request(startPath, {
          ...start,
          headers: { ...start.headers, Authorization: 'Bearer invalid-token' },
        })
      ).status,
    ).toBe(401);
    // A syntactically invalid payload reaches the registered handler under the current token,
    // proving this is an auth assertion rather than a 404/500 route accident.
    expect(
      (
        await app.request(startPath, {
          ...start,
          headers: { ...start.headers, Authorization: 'Bearer current-token' },
        })
      ).status,
    ).toBe(400);
  });

  it('execution_mode_defaults_local_and_token_rotation', async () => {
    expect(loadConfig({}).executionMode).toBe('local');
    expect(() => loadConfig({ EXECUTION_MODE: 'production' })).toThrow('MASTRA_API_TOKEN');
    const oldApp = await productionApp('old-token');
    expect((await oldApp.request('/api/workflows', { headers: { Authorization: 'Bearer old-token' } })).status).toBe(
      200,
    );
    const rotatedApp = await productionApp('new-token');
    expect(
      (await rotatedApp.request('/api/workflows', { headers: { Authorization: 'Bearer old-token' } })).status,
    ).toBe(401);
    expect(
      (await rotatedApp.request('/api/workflows', { headers: { Authorization: 'Bearer new-token' } })).status,
    ).toBe(200);
  });
});
