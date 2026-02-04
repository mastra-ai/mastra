/**
 * Cross-mount copy integration tests.
 *
 * Tests copying files between different mounts.
 */

import { describe, it, expect } from 'vitest';

import type { WorkspaceSetup } from '../types';

interface TestContext {
  setup: WorkspaceSetup;
  getTestPath: () => string;
  testTimeout: number;
  fastOnly: boolean;
}

export function createCrossMountCopyTests(getContext: () => TestContext): void {
  describe('Cross-Mount Copy', () => {
    it('copy file from one mount to another via sandbox', async () => {
      const { setup } = getContext();
      if (!setup.mounts) return;
      if (!setup.sandbox.executeCommand) return;

      const mountPaths = Object.keys(setup.mounts);
      if (mountPaths.length < 2) return;

      const srcMount = mountPaths[0]!;
      const destMount = mountPaths[1]!;
      const srcFs = setup.mounts[srcMount]!;
      const destFs = setup.mounts[destMount]!;

      const content = 'cross-mount content';

      // Write source file
      await srcFs.writeFile('/cross-copy-src.txt', content);

      // Copy via sandbox
      const result = await setup.sandbox.executeCommand('cp', [
        `${srcMount}/cross-copy-src.txt`,
        `${destMount}/cross-copy-dest.txt`,
      ]);

      expect(result.exitCode).toBe(0);

      // Verify copy in destination
      const destContent = await destFs.readFile('/cross-copy-dest.txt', { encoding: 'utf-8' });
      expect(destContent).toBe(content);

      // Cleanup
      await srcFs.deleteFile('/cross-copy-src.txt', { force: true });
      await destFs.deleteFile('/cross-copy-dest.txt', { force: true });
    }, getContext().testTimeout);

    it('move file from one mount to another via sandbox', async () => {
      const { setup } = getContext();
      if (!setup.mounts) return;
      if (!setup.sandbox.executeCommand) return;

      const mountPaths = Object.keys(setup.mounts);
      if (mountPaths.length < 2) return;

      const srcMount = mountPaths[0]!;
      const destMount = mountPaths[1]!;
      const srcFs = setup.mounts[srcMount]!;
      const destFs = setup.mounts[destMount]!;

      // Skip if source is read-only
      if (srcFs.readOnly) return;

      const content = 'move-me content';

      // Write source file
      await srcFs.writeFile('/cross-move-src.txt', content);

      // Move via sandbox
      const result = await setup.sandbox.executeCommand('mv', [
        `${srcMount}/cross-move-src.txt`,
        `${destMount}/cross-move-dest.txt`,
      ]);

      expect(result.exitCode).toBe(0);

      // Verify file moved
      const srcExists = await srcFs.exists('/cross-move-src.txt');
      const destContent = await destFs.readFile('/cross-move-dest.txt', { encoding: 'utf-8' });

      expect(srcExists).toBe(false);
      expect(destContent).toBe(content);

      // Cleanup
      await destFs.deleteFile('/cross-move-dest.txt', { force: true });
    }, getContext().testTimeout);
  });
}
