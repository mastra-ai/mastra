import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeJSON, ensureDir, remove } from 'fs-extra/esm';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getSourceOverrides, transformOverrideForOutput, transformOverrides } from './index';

describe('package manager overrides', () => {
  describe('transformOverrideForOutput', () => {
    const projectRoot = '/project';
    const outputDir = '/project/.mastra/output';

    it('should transform link: protocol with relative path', () => {
      const result = transformOverrideForOutput('link:../../packages/core', projectRoot, outputDir);
      // From /project/.mastra/output to /packages/core (which is /project/../../packages/core = /packages/core)
      // The absolute path is /packages/core, and from /project/.mastra/output we need to go up 3 dirs
      expect(result).toBe('link:../../../packages/core');
    });

    it('should transform link: protocol with absolute-like relative path', () => {
      const result = transformOverrideForOutput('link:./packages/core', projectRoot, outputDir);
      // From /project to /project/packages/core
      // From /project/.mastra/output we need to go up 2 dirs then into packages/core
      expect(result).toBe('link:../../packages/core');
    });

    it('should transform file: protocol', () => {
      const result = transformOverrideForOutput('file:../shared-lib', projectRoot, outputDir);
      // From /project to /shared-lib
      // From /project/.mastra/output we need to go up 3 dirs then into shared-lib
      expect(result).toBe('file:../../../shared-lib');
    });

    it('should transform portal: protocol', () => {
      const result = transformOverrideForOutput('portal:../other-project', projectRoot, outputDir);
      expect(result).toBe('portal:../../../other-project');
    });

    it('should pass through workspace: protocol unchanged', () => {
      const result = transformOverrideForOutput('workspace:*', projectRoot, outputDir);
      expect(result).toBe('workspace:*');
    });

    it('should pass through workspace:^ protocol unchanged', () => {
      const result = transformOverrideForOutput('workspace:^', projectRoot, outputDir);
      expect(result).toBe('workspace:^');
    });

    it('should pass through npm: alias unchanged', () => {
      const result = transformOverrideForOutput('npm:@other/pkg@^1.0.0', projectRoot, outputDir);
      expect(result).toBe('npm:@other/pkg@^1.0.0');
    });

    it('should pass through version ranges unchanged', () => {
      const result = transformOverrideForOutput('^1.0.0', projectRoot, outputDir);
      expect(result).toBe('^1.0.0');
    });

    it('should pass through exact versions unchanged', () => {
      const result = transformOverrideForOutput('1.0.0', projectRoot, outputDir);
      expect(result).toBe('1.0.0');
    });

    it('should pass through git URLs unchanged', () => {
      const result = transformOverrideForOutput('git+https://github.com/org/repo.git', projectRoot, outputDir);
      expect(result).toBe('git+https://github.com/org/repo.git');
    });
  });

  describe('transformOverrides', () => {
    const projectRoot = '/project';
    const outputDir = '/project/.mastra/output';

    it('should transform all overrides in a record', () => {
      const overrides = {
        '@mastra/core': 'link:../../packages/core',
        '@mastra/memory': 'link:../../packages/memory',
        lodash: '^4.17.21',
      };

      const result = transformOverrides(overrides, projectRoot, outputDir);

      expect(result).toEqual({
        '@mastra/core': 'link:../../../packages/core',
        '@mastra/memory': 'link:../../../packages/memory',
        lodash: '^4.17.21',
      });
    });

    it('should return undefined for undefined input', () => {
      const result = transformOverrides(undefined, projectRoot, outputDir);
      expect(result).toBeUndefined();
    });

    it('should return empty object for empty overrides', () => {
      const result = transformOverrides({}, projectRoot, outputDir);
      expect(result).toEqual({});
    });

    it('should handle mixed protocol types', () => {
      const overrides = {
        'pkg-link': 'link:../pkg-link',
        'pkg-file': 'file:../pkg-file',
        'pkg-portal': 'portal:../pkg-portal',
        'pkg-workspace': 'workspace:*',
        'pkg-npm': 'npm:other-pkg@^1.0.0',
        'pkg-version': '^2.0.0',
      };

      const result = transformOverrides(overrides, projectRoot, outputDir);

      expect(result).toEqual({
        'pkg-link': 'link:../../../pkg-link',
        'pkg-file': 'file:../../../pkg-file',
        'pkg-portal': 'portal:../../../pkg-portal',
        'pkg-workspace': 'workspace:*',
        'pkg-npm': 'npm:other-pkg@^1.0.0',
        'pkg-version': '^2.0.0',
      });
    });
  });

  describe('getSourceOverrides', () => {
    let tempDir: string;

    beforeEach(async () => {
      tempDir = join(tmpdir(), `mastra-test-${Date.now()}`);
      await ensureDir(tempDir);
    });

    afterEach(async () => {
      await remove(tempDir);
    });

    it('should read pnpm overrides from package.json', async () => {
      await writeJSON(join(tempDir, 'package.json'), {
        name: 'test-project',
        pnpm: {
          overrides: {
            '@mastra/core': 'link:../../packages/core',
          },
        },
      });

      const result = await getSourceOverrides(tempDir);

      expect(result.pnpmOverrides).toEqual({
        '@mastra/core': 'link:../../packages/core',
      });
      expect(result.npmOverrides).toBeUndefined();
      expect(result.yarnResolutions).toBeUndefined();
    });

    it('should read npm overrides from package.json', async () => {
      await writeJSON(join(tempDir, 'package.json'), {
        name: 'test-project',
        overrides: {
          lodash: '^4.17.21',
        },
      });

      const result = await getSourceOverrides(tempDir);

      expect(result.npmOverrides).toEqual({
        lodash: '^4.17.21',
      });
      expect(result.pnpmOverrides).toBeUndefined();
      expect(result.yarnResolutions).toBeUndefined();
    });

    it('should read yarn resolutions from package.json', async () => {
      await writeJSON(join(tempDir, 'package.json'), {
        name: 'test-project',
        resolutions: {
          'react-dom': '18.2.0',
        },
      });

      const result = await getSourceOverrides(tempDir);

      expect(result.yarnResolutions).toEqual({
        'react-dom': '18.2.0',
      });
      expect(result.pnpmOverrides).toBeUndefined();
      expect(result.npmOverrides).toBeUndefined();
    });

    it('should read all override types when present', async () => {
      await writeJSON(join(tempDir, 'package.json'), {
        name: 'test-project',
        pnpm: {
          overrides: {
            '@mastra/core': 'link:../../packages/core',
          },
        },
        overrides: {
          lodash: '^4.17.21',
        },
        resolutions: {
          'react-dom': '18.2.0',
        },
      });

      const result = await getSourceOverrides(tempDir);

      expect(result.pnpmOverrides).toEqual({
        '@mastra/core': 'link:../../packages/core',
      });
      expect(result.npmOverrides).toEqual({
        lodash: '^4.17.21',
      });
      expect(result.yarnResolutions).toEqual({
        'react-dom': '18.2.0',
      });
    });

    it('should return empty object when package.json does not exist', async () => {
      const result = await getSourceOverrides(join(tempDir, 'nonexistent'));

      expect(result).toEqual({});
    });

    it('should return empty object when no overrides are present', async () => {
      await writeJSON(join(tempDir, 'package.json'), {
        name: 'test-project',
        dependencies: {
          lodash: '^4.17.21',
        },
      });

      const result = await getSourceOverrides(tempDir);

      expect(result.pnpmOverrides).toBeUndefined();
      expect(result.npmOverrides).toBeUndefined();
      expect(result.yarnResolutions).toBeUndefined();
    });
  });
});
