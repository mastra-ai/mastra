import type { QuoremEnvironmentConfig } from '@mastra/core/harness';

/**
 * Creates environment management functions for the quorem feature.
 * This implementation uses git worktrees as the isolation mechanism.
 * These are injected into the Harness config to keep git operations
 * in the app layer (mastracode) rather than the core.
 */
export function createQuoremEnvironmentConfig(): QuoremEnvironmentConfig {
  return {
    createEnvironment: async ({ path, ref }) => {
      const { execa } = await import('execa');
      // Create a git worktree on a new branch from HEAD
      await execa('git', ['worktree', 'add', '-b', ref, path], {
        cwd: process.cwd(),
      });
    },

    removeEnvironment: async ({ path }) => {
      const { execa } = await import('execa');
      await execa('git', ['worktree', 'remove', path, '--force'], {
        cwd: process.cwd(),
        reject: false,
      });
    },

    mergeResults: async ({ ref }) => {
      const { execa } = await import('execa');
      await execa('git', ['merge', ref, '--no-edit'], {
        cwd: process.cwd(),
      });
    },

    getArtifacts: async ({ path }) => {
      const { execa } = await import('execa');
      // List files modified in the environment relative to its base
      const result = await execa('git', ['diff', '--name-only', 'HEAD'], {
        cwd: path,
        reject: false,
      });
      const staged = await execa('git', ['diff', '--cached', '--name-only'], {
        cwd: path,
        reject: false,
      });
      const files = new Set<string>();
      for (const line of result.stdout.split('\n').filter(Boolean)) {
        files.add(line);
      }
      for (const line of staged.stdout.split('\n').filter(Boolean)) {
        files.add(line);
      }
      return Array.from(files);
    },

    getResultDiff: async ({ path }) => {
      const { execa } = await import('execa');
      const result = await execa('git', ['diff', 'HEAD'], {
        cwd: path,
        reject: false,
      });
      const staged = await execa('git', ['diff', '--cached'], {
        cwd: path,
        reject: false,
      });
      return [result.stdout, staged.stdout].filter(Boolean).join('\n');
    },
  };
}
