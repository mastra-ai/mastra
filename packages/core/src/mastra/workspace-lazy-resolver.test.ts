import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';

import { LocalFilesystem } from '../workspace/filesystem';
import { Workspace } from '../workspace/workspace';
import { Mastra } from './index';

/**
 * Tests for lazy workspace resolution.
 *
 * Dynamic workspaces (e.g. factory sessions with IDs like
 * `mfw-<repoId>-<sessionId>-web-factory`) are only registered as a side effect
 * of the request context that first spawned them. On container restart or
 * cross-replica lookup, the in-process `#workspaces` map is empty even though
 * the underlying sandbox is still reachable. A configurable `resolveWorkspaceById`
 * hook lets the host reconstruct the workspace shim on demand.
 */
describe('Mastra lazy workspace resolver', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'workspace-lazy-test-'));
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  const createWorkspace = (id: string) => {
    const filesystem = new LocalFilesystem({ basePath: tempDir });
    return new Workspace({ id, name: `Workspace ${id}`, filesystem });
  };

  describe('resolveWorkspaceById()', () => {
    it('returns from the in-memory registry without invoking the resolver', async () => {
      const workspace = createWorkspace('cached-workspace');
      const resolver = vi.fn();
      const mastra = new Mastra({
        logger: false,
        workspace,
        resolveWorkspaceById: resolver,
      });

      const result = await mastra.resolveWorkspaceById('cached-workspace');
      expect(result).toBe(workspace);
      expect(resolver).not.toHaveBeenCalled();
    });

    it('falls back to the configured resolver on a registry miss and registers the result', async () => {
      const workspace = createWorkspace('lazy-workspace');
      const resolver = vi.fn(async (id: string) => {
        expect(id).toBe('lazy-workspace');
        return workspace;
      });

      const mastra = new Mastra({ logger: false, resolveWorkspaceById: resolver });

      const result = await mastra.resolveWorkspaceById('lazy-workspace');
      expect(result).toBe(workspace);
      expect(resolver).toHaveBeenCalledTimes(1);

      // Post-resolution, the workspace is cached in the registry (source: 'resolver').
      expect(mastra.getWorkspaceById('lazy-workspace')).toBe(workspace);
      expect(mastra.listWorkspaces()['lazy-workspace']?.source).toBe('resolver');

      // Subsequent calls hit the cache, not the resolver.
      await mastra.resolveWorkspaceById('lazy-workspace');
      expect(resolver).toHaveBeenCalledTimes(1);
    });

    it('throws the standard 404 error when the resolver returns undefined', async () => {
      const resolver = vi.fn(async () => undefined);
      const mastra = new Mastra({ logger: false, resolveWorkspaceById: resolver });

      await expect(mastra.resolveWorkspaceById('missing-workspace')).rejects.toMatchObject({
        id: 'MASTRA_GET_WORKSPACE_BY_ID_NOT_FOUND',
      });
      expect(resolver).toHaveBeenCalledTimes(1);
    });

    it('throws the standard 404 error when no resolver is configured', async () => {
      const mastra = new Mastra({ logger: false });

      await expect(mastra.resolveWorkspaceById('missing-workspace')).rejects.toMatchObject({
        id: 'MASTRA_GET_WORKSPACE_BY_ID_NOT_FOUND',
      });
    });

    it('deduplicates concurrent lookups for the same id (single resolver invocation)', async () => {
      const workspace = createWorkspace('concurrent-workspace');
      let pending!: (ws: Workspace) => void;
      const resolver = vi.fn(
        () =>
          new Promise<Workspace>(resolve => {
            pending = resolve;
          }),
      );

      const mastra = new Mastra({ logger: false, resolveWorkspaceById: resolver });

      const p1 = mastra.resolveWorkspaceById('concurrent-workspace');
      const p2 = mastra.resolveWorkspaceById('concurrent-workspace');
      const p3 = mastra.resolveWorkspaceById('concurrent-workspace');

      // Give microtasks a chance to run so all three subscribe to the same in-flight promise.
      await Promise.resolve();
      expect(resolver).toHaveBeenCalledTimes(1);

      pending(workspace);
      const [r1, r2, r3] = await Promise.all([p1, p2, p3]);
      expect(r1).toBe(workspace);
      expect(r2).toBe(workspace);
      expect(r3).toBe(workspace);
      expect(resolver).toHaveBeenCalledTimes(1);
    });

    it('does not cache a failed resolution — the next call re-invokes the resolver', async () => {
      const workspace = createWorkspace('retry-workspace');
      let attempt = 0;
      const resolver = vi.fn(async () => {
        attempt += 1;
        if (attempt === 1) {
          throw new Error('transient failure');
        }
        return workspace;
      });

      const mastra = new Mastra({ logger: false, resolveWorkspaceById: resolver });

      await expect(mastra.resolveWorkspaceById('retry-workspace')).rejects.toThrow('transient failure');
      const result = await mastra.resolveWorkspaceById('retry-workspace');
      expect(result).toBe(workspace);
      expect(resolver).toHaveBeenCalledTimes(2);
    });

    it('does not cache when the resolver returns undefined — the next call re-invokes it', async () => {
      const workspace = createWorkspace('appears-later');
      let attempt = 0;
      const resolver = vi.fn(async () => {
        attempt += 1;
        return attempt === 1 ? undefined : workspace;
      });

      const mastra = new Mastra({ logger: false, resolveWorkspaceById: resolver });

      await expect(mastra.resolveWorkspaceById('appears-later')).rejects.toMatchObject({
        id: 'MASTRA_GET_WORKSPACE_BY_ID_NOT_FOUND',
      });
      const result = await mastra.resolveWorkspaceById('appears-later');
      expect(result).toBe(workspace);
      expect(resolver).toHaveBeenCalledTimes(2);
    });

    it('passes the mastra instance to the resolver context', async () => {
      const workspace = createWorkspace('context-workspace');
      const resolver = vi.fn(async (_id: string, ctx: { mastra: Mastra }) => {
        expect(ctx.mastra).toBe(mastra);
        return workspace;
      });

      const mastra = new Mastra({ logger: false, resolveWorkspaceById: resolver });
      await mastra.resolveWorkspaceById('context-workspace');
      expect(resolver).toHaveBeenCalledTimes(1);
    });
  });

  describe('sync getWorkspaceById()', () => {
    it('remains a pure map lookup and does not invoke the resolver', () => {
      const resolver = vi.fn();
      const mastra = new Mastra({ logger: false, resolveWorkspaceById: resolver });

      expect(() => mastra.getWorkspaceById('nope')).toThrow();
      expect(resolver).not.toHaveBeenCalled();
    });
  });
});
