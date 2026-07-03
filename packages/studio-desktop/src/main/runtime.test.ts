import { EventEmitter } from 'node:events';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS } from './defaults';
import { LogBuffer } from './log-buffer';
import { ManagedMastraRuntime } from './runtime';
import type { SpawnFn } from './runtime';

class MockChild extends EventEmitter {
  pid = 1234;
  stdout = new EventEmitter();
  stderr = new EventEmitter();
  killedWith?: string;

  kill(signal?: string) {
    this.killedWith = signal;
    this.emit('exit', 0);
    return true;
  }
}

describe('ManagedMastraRuntime', () => {
  it('reports an error when the built runtime is missing', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'mastra-desktop-runtime-'));
    const runtime = new ManagedMastraRuntime({
      outputDir: join(dir, 'missing'),
      userDataPath: dir,
      logs: new LogBuffer(),
    });

    await expect(runtime.start(DEFAULT_SETTINGS, 4111)).resolves.toMatchObject({
      state: 'error',
      error: expect.stringContaining('Mastra starter runtime was not built'),
    });
  });

  it('starts the built runtime with desktop model, storage, and user env vars', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'mastra-desktop-runtime-'));
    const outputDir = join(dir, 'output');
    await mkdir(outputDir);
    await writeFile(join(outputDir, 'index.mjs'), '');

    const child = new MockChild();
    const spawnFn = vi.fn(() => child) as unknown as SpawnFn;
    const runtime = new ManagedMastraRuntime({
      outputDir,
      userDataPath: dir,
      logs: new LogBuffer(),
      spawnFn,
      nodePath: '/node',
    });

    await expect(
      runtime.start(
        {
          ...DEFAULT_SETTINGS,
          environmentVariables: {
            HOST: '0.0.0.0',
            OPENAI_API_KEY: 'sk-local',
            PORT: '9999',
          },
        },
        4112,
      ),
    ).resolves.toMatchObject({
      state: 'running',
      pid: 1234,
      port: 4112,
      url: 'http://127.0.0.1:4112',
    });

    expect(spawnFn).toHaveBeenCalledWith(
      '/node',
      ['index.mjs'],
      expect.objectContaining({
        cwd: outputDir,
        env: expect.objectContaining({
          ELECTRON_RUN_AS_NODE: '1',
          HOST: '127.0.0.1',
          MASTRA_DEV: 'true',
          OPENAI_API_KEY: 'sk-local',
          PORT: '4112',
          MASTRA_TELEMETRY_DISABLED: 'true',
          MASTRA_DESKTOP_MODEL_ID: DEFAULT_SETTINGS.modelId,
          MASTRA_DESKTOP_MODEL_URL: DEFAULT_SETTINGS.modelUrl,
          MASTRA_DESKTOP_STORAGE_DIR: join(dir, 'storage'),
        }),
      }),
    );
  });

  it('stops and restarts the child process', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'mastra-desktop-runtime-'));
    const outputDir = join(dir, 'output');
    await mkdir(outputDir);
    await writeFile(join(outputDir, 'index.mjs'), '');

    const children = [new MockChild(), new MockChild()];
    const spawnFn = vi.fn(() => children.shift()!) as unknown as SpawnFn;
    const runtime = new ManagedMastraRuntime({
      outputDir,
      userDataPath: dir,
      logs: new LogBuffer(),
      spawnFn,
      nodePath: '/node',
    });

    await runtime.start(DEFAULT_SETTINGS, 4111);
    await runtime.restart(DEFAULT_SETTINGS, 4113);

    expect(spawnFn).toHaveBeenCalledTimes(2);
    expect(runtime.status).toMatchObject({ state: 'running', port: 4113 });
  });
});
