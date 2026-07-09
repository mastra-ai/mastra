import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getSubmitPlanProjectRoot, readPlanFile, resolveLocalPlanPath } from './plan-file';

describe('plan-file', () => {
  let projectRoot: string;

  beforeEach(async () => {
    projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'mastra-plan-file-'));
    await fs.mkdir(path.join(projectRoot, '.mastracode', 'plans'), { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(projectRoot, { recursive: true, force: true });
  });

  describe('resolveLocalPlanPath', () => {
    it('resolves a direct markdown file under .mastracode/plans', () => {
      const submitted = '.mastracode/plans/cook-anything.md';
      expect(resolveLocalPlanPath(projectRoot, submitted)).toBe(
        path.resolve(projectRoot, '.mastracode', 'plans', 'cook-anything.md'),
      );
    });

    it('rejects unsafe or non-markdown paths', () => {
      expect(resolveLocalPlanPath(projectRoot, '')).toBeUndefined();
      expect(resolveLocalPlanPath(projectRoot, '../plans/escape.md')).toBeUndefined();
      expect(resolveLocalPlanPath(projectRoot, '.mastracode/plans/nested/plan.md')).toBeUndefined();
      expect(resolveLocalPlanPath(projectRoot, '.mastracode/plans/plan.txt')).toBeUndefined();
    });
  });

  describe('readPlanFile', () => {
    it('parses the heading as title and the rest as body', async () => {
      const absPath = path.join(projectRoot, '.mastracode', 'plans', 'cook-anything.md');
      await fs.writeFile(absPath, '# Cook Anything\n\n## Summary\n\nMake dinner.', 'utf-8');

      await expect(readPlanFile(absPath)).resolves.toEqual({
        title: 'Cook Anything',
        plan: '## Summary\n\nMake dinner.',
      });
    });

    it('returns an empty title and the raw body when there is no heading', async () => {
      const absPath = path.join(projectRoot, '.mastracode', 'plans', 'no-heading.md');
      await fs.writeFile(absPath, 'Just a body.\n', 'utf-8');

      await expect(readPlanFile(absPath)).resolves.toEqual({ title: '', plan: 'Just a body.' });
    });

    it('returns undefined when the file cannot be read', async () => {
      await expect(readPlanFile(path.join(projectRoot, '.mastracode', 'plans', 'missing.md'))).resolves.toBeUndefined();
    });
  });

  describe('getSubmitPlanProjectRoot', () => {
    it('honors the explicit argument first', () => {
      expect(getSubmitPlanProjectRoot(projectRoot)).toBe(path.resolve(projectRoot));
    });

    it('falls back to the submit-plan env override', () => {
      vi.stubEnv('MASTRA_SUBMIT_PLAN_PROJECT_ROOT', projectRoot);
      try {
        expect(getSubmitPlanProjectRoot()).toBe(path.resolve(projectRoot));
      } finally {
        vi.unstubAllEnvs();
      }
    });
  });
});
