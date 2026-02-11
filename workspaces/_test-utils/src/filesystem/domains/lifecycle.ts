/**
 * Lifecycle test domain.
 * Tests: init, destroy, status transitions, getInfo
 */

import type { WorkspaceFilesystem } from '@mastra/core/workspace';
import { describe, it, expect } from 'vitest';

import type { FilesystemCapabilities } from '../types';

interface TestContext {
  fs: WorkspaceFilesystem;
  getTestPath: () => string;
  capabilities: Required<FilesystemCapabilities>;
  testTimeout: number;
  fastOnly: boolean;
  cleanup: () => Promise<void>;
  /** Optional: factory to create additional instances for uniqueness tests */
  createFilesystem?: () => Promise<WorkspaceFilesystem> | WorkspaceFilesystem;
}

export function createLifecycleTests(getContext: () => TestContext): void {
  describe('Lifecycle', () => {
    it('has a status property', () => {
      const { fs } = getContext();

      expect(fs.status).toBeDefined();
      expect(typeof fs.status).toBe('string');
    });

    it('status is ready after initialization', () => {
      const { fs } = getContext();

      // The factory calls init() in beforeAll, so status should be ready
      expect(fs.status).toBe('ready');
    });

    it('has required identification properties', () => {
      const { fs } = getContext();

      expect(fs.id).toBeDefined();
      expect(typeof fs.id).toBe('string');
      expect(fs.name).toBeDefined();
      expect(typeof fs.name).toBe('string');
      expect(fs.provider).toBeDefined();
      expect(typeof fs.provider).toBe('string');
    });

    it('id is unique per instance', async () => {
      const { fs, createFilesystem } = getContext();

      // Skip if no factory provided for creating additional instances
      if (!createFilesystem) return;

      const fs2 = await createFilesystem();

      expect(fs.id).not.toBe(fs2.id);
    });

    it('has optional display properties', () => {
      const { fs } = getContext();

      // These may or may not be defined, but if defined should be strings
      if (fs.displayName !== undefined) {
        expect(typeof fs.displayName).toBe('string');
      }
      if (fs.description !== undefined) {
        expect(typeof fs.description).toBe('string');
      }
      if (fs.icon !== undefined) {
        expect(typeof fs.icon).toBe('string');
      }
    });

    it('readOnly property is defined', () => {
      const { fs } = getContext();

      // readOnly may be undefined (defaults to false) or a boolean
      if (fs.readOnly !== undefined) {
        expect(typeof fs.readOnly).toBe('boolean');
      }
    });

    describe('getInfo', () => {
      it('returns FilesystemInfo when supported', async () => {
        const { fs } = getContext();

        if (!fs.getInfo) return;

        const info = await fs.getInfo();

        expect(info).toBeDefined();
        expect(info.id).toBe(fs.id);
        expect(info.name).toBe(fs.name);
        expect(info.provider).toBe(fs.provider);
        expect(info.status).toBeDefined();
      });

      it('includes icon in getInfo when set', async () => {
        const { fs } = getContext();

        if (!fs.getInfo) return;
        if (!fs.icon) return;

        const info = await fs.getInfo();

        expect(info.icon).toBe(fs.icon);
      });

      it('getInfo status matches filesystem status', async () => {
        const { fs } = getContext();

        if (!fs.getInfo) return;

        const info = await fs.getInfo();

        expect(info.status).toBe(fs.status);
      });
    });
  });
}
