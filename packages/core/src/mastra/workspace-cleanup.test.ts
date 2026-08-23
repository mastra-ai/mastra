import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LocalFilesystem } from '../workspace/filesystem';
import { Workspace } from '../workspace/workspace';
import { Mastra } from './index';

describe('Workspace cleanup', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'workspace-cleanup-test-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  });

  const createWorkspace = (id: string) =>
    new Workspace({
      id,
      filesystem: new LocalFilesystem({ basePath: path.join(tempDir, id) }),
    });

  describe('removeWorkspace', () => {
    it('removes a registered workspace', async () => {
      const mastra = new Mastra({ logger: false });
      const workspace = createWorkspace('dynamic-workspace');
      mastra.addWorkspace(workspace);

      await expect(mastra.removeWorkspace('dynamic-workspace')).resolves.toBe(true);
      expect(mastra.listWorkspaces()).not.toHaveProperty('dynamic-workspace');
      await expect(mastra.removeWorkspace('dynamic-workspace')).resolves.toBe(false);
    });

    it('destroys a workspace before removing it', async () => {
      const mastra = new Mastra({ logger: false });
      const workspace = createWorkspace('destroyed-workspace');
      const destroy = vi.spyOn(workspace, 'destroy').mockResolvedValue(undefined);
      mastra.addWorkspace(workspace);

      await expect(mastra.removeWorkspace('destroyed-workspace', { destroy: true })).resolves.toBe(true);

      expect(destroy).toHaveBeenCalledTimes(1);
      expect(mastra.listWorkspaces()).not.toHaveProperty('destroyed-workspace');
    });

    it('keeps a workspace registered when destroy fails', async () => {
      const mastra = new Mastra({ logger: false });
      const workspace = createWorkspace('failing-workspace');
      const error = new Error('destroy failed');
      vi.spyOn(workspace, 'destroy').mockRejectedValue(error);
      mastra.addWorkspace(workspace);

      await expect(mastra.removeWorkspace('failing-workspace', { destroy: true })).rejects.toThrow(error);

      expect(mastra.listWorkspaces()['failing-workspace']?.workspace).toBe(workspace);
    });

    it('clears the global workspace slot when removing the registered global workspace', async () => {
      const workspace = createWorkspace('global-workspace');
      const mastra = new Mastra({ logger: false, workspace });

      await expect(mastra.removeWorkspace('global-workspace')).resolves.toBe(true);

      expect(mastra.getWorkspace()).toBeUndefined();
      expect(mastra.listWorkspaces()).not.toHaveProperty('global-workspace');
    });
  });

  describe('shutdown', () => {
    it('stops and unregisters registered workspaces by default without destroying them', async () => {
      const mastra = new Mastra({ logger: false });
      const workspaceA = createWorkspace('workspace-a');
      const workspaceB = createWorkspace('workspace-b');
      const stopA = vi.spyOn(workspaceA, 'stop').mockResolvedValue(undefined);
      const stopB = vi.spyOn(workspaceB, 'stop').mockResolvedValue(undefined);
      const destroyA = vi.spyOn(workspaceA, 'destroy').mockResolvedValue(undefined);
      const destroyB = vi.spyOn(workspaceB, 'destroy').mockResolvedValue(undefined);
      mastra.addWorkspace(workspaceA);
      mastra.addWorkspace(workspaceB);

      await mastra.shutdown();

      expect(stopA).toHaveBeenCalledTimes(1);
      expect(stopB).toHaveBeenCalledTimes(1);
      expect(destroyA).not.toHaveBeenCalled();
      expect(destroyB).not.toHaveBeenCalled();
      expect(mastra.listWorkspaces()).toEqual({});
    });

    it('continues shutdown after a workspace stop failure and keeps failed workspaces registered', async () => {
      const mastra = new Mastra({ logger: false });
      const failingWorkspace = createWorkspace('failing-workspace');
      const successfulWorkspace = createWorkspace('successful-workspace');
      const error = new Error('stop failed');
      const failingStop = vi.spyOn(failingWorkspace, 'stop').mockRejectedValue(error);
      const successfulStop = vi.spyOn(successfulWorkspace, 'stop').mockResolvedValue(undefined);
      mastra.addWorkspace(failingWorkspace);
      mastra.addWorkspace(successfulWorkspace);

      await expect(mastra.shutdown()).resolves.toBeUndefined();

      expect(failingStop).toHaveBeenCalledTimes(1);
      expect(successfulStop).toHaveBeenCalledTimes(1);
      expect(mastra.listWorkspaces()['failing-workspace']?.workspace).toBe(failingWorkspace);
      expect(mastra.listWorkspaces()).not.toHaveProperty('successful-workspace');
    });

    it('stops registered workspaces before closing storage', async () => {
      const callOrder: string[] = [];
      const storage = {
        name: 'order-test-storage',
        init: vi.fn(async () => {}),
        close: vi.fn(async () => {
          callOrder.push('storage.close');
        }),
        __setLogger: vi.fn(),
      } as any;

      const mastra = new Mastra({ logger: false, storage });
      const workspace = createWorkspace('order-workspace');
      vi.spyOn(workspace, 'stop').mockImplementation(async () => {
        callOrder.push('workspace.stop');
      });
      mastra.addWorkspace(workspace);

      await mastra.shutdown();

      expect(callOrder).toEqual(['workspace.stop', 'storage.close']);
      expect(storage.close).toHaveBeenCalledTimes(1);
    });

    it('stops multiple workspaces concurrently (parallel teardown)', async () => {
      const mastra = new Mastra({ logger: false });
      const workspaceA = createWorkspace('parallel-a');
      const workspaceB = createWorkspace('parallel-b');
      const workspaceC = createWorkspace('parallel-c');
      let started = 0;
      let active = 0;
      let maxActive = 0;
      let releaseStops!: () => void;
      const release = new Promise<void>(resolve => {
        releaseStops = resolve;
      });

      const slowStop = async () => {
        started += 1;
        active += 1;
        maxActive = Math.max(maxActive, active);
        await release;
        active -= 1;
      };
      vi.spyOn(workspaceA, 'stop').mockImplementation(slowStop);
      vi.spyOn(workspaceB, 'stop').mockImplementation(slowStop);
      vi.spyOn(workspaceC, 'stop').mockImplementation(slowStop);

      mastra.addWorkspace(workspaceA);
      mastra.addWorkspace(workspaceB);
      mastra.addWorkspace(workspaceC);

      const shutdownPromise = mastra.shutdown();

      try {
        await vi.waitFor(() => expect(started).toBe(3), { timeout: 500, interval: 5 });
        expect(maxActive).toBe(3);
      } finally {
        releaseStops();
      }
      await shutdownPromise;

      expect(mastra.listWorkspaces()).toEqual({});
    });
  });
});
