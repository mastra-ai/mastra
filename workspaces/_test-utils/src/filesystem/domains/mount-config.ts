/**
 * Mount config test domain.
 * Tests: getMountConfig, readOnly in mount config
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
}

export function createMountConfigTests(getContext: () => TestContext): void {
  describe('Mount Config', () => {
    it('getMountConfig returns a valid config object', () => {
      const { fs, capabilities } = getContext();

      if (!capabilities.supportsMounting) return;
      if (!fs.getMountConfig) return;

      const config = fs.getMountConfig();

      expect(config).toBeDefined();
      expect(typeof config).toBe('object');
      expect(config.type).toBeDefined();
      expect(typeof config.type).toBe('string');
    });

    it('getMountConfig type matches provider', () => {
      const { fs, capabilities } = getContext();

      if (!capabilities.supportsMounting) return;
      if (!fs.getMountConfig) return;

      const config = fs.getMountConfig();

      // Type should be a recognizable mount type
      expect(['s3', 'gcs', 'local', 'r2']).toContain(config.type);
    });

    it('getMountConfig is undefined for non-mountable filesystems', () => {
      const { fs, capabilities } = getContext();

      // If the filesystem does NOT support mounting, getMountConfig should not exist
      if (capabilities.supportsMounting) return;

      expect(fs.getMountConfig).toBeUndefined();
    });

    it('getMountConfig includes readOnly when filesystem is readOnly', () => {
      const { fs, capabilities } = getContext();

      if (!capabilities.supportsMounting) return;
      if (!fs.getMountConfig) return;
      if (!fs.readOnly) return;

      const config = fs.getMountConfig();

      // If filesystem is readOnly, mount config should reflect that
      // Cast to access provider-specific readOnly property
      expect((config as { type: string; readOnly?: boolean }).readOnly).toBe(true);
    });
  });
}
