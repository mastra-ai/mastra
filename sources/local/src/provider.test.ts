import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, writeFile, rm, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { LocalProjectSource } from './provider';

describe('LocalProjectSource', () => {
  let testDir: string;
  let source: LocalProjectSource;

  beforeEach(async () => {
    testDir = join(tmpdir(), `mastra-provider-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });
    source = new LocalProjectSource({ basePaths: [testDir] });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  describe('type', () => {
    it('returns local as the type', () => {
      expect(source.type).toBe('local');
    });
  });

  describe('listProjects', () => {
    it('discovers Mastra projects in base paths', async () => {
      const projectDir = join(testDir, 'my-project');
      await mkdir(projectDir);
      await writeFile(
        join(projectDir, 'package.json'),
        JSON.stringify({
          name: 'my-project',
          dependencies: { '@mastra/core': '^1.0.0' },
        }),
      );

      const projects = await source.listProjects();

      expect(projects).toHaveLength(1);
      expect(projects[0].name).toBe('my-project');
      expect(projects[0].type).toBe('local');
      expect(projects[0].path).toBe(projectDir);
    });

    it('ignores non-Mastra projects', async () => {
      const mastraProject = join(testDir, 'mastra-project');
      const regularProject = join(testDir, 'regular-project');

      await mkdir(mastraProject);
      await mkdir(regularProject);

      await writeFile(
        join(mastraProject, 'package.json'),
        JSON.stringify({
          name: 'mastra-project',
          dependencies: { '@mastra/core': '^1.0.0' },
        }),
      );

      await writeFile(
        join(regularProject, 'package.json'),
        JSON.stringify({
          name: 'regular-project',
          dependencies: { express: '^4.0.0' },
        }),
      );

      const projects = await source.listProjects();

      expect(projects).toHaveLength(1);
      expect(projects[0].name).toBe('mastra-project');
    });

    it('discovers multiple Mastra projects', async () => {
      const project1 = join(testDir, 'project-1');
      const project2 = join(testDir, 'project-2');

      await mkdir(project1);
      await mkdir(project2);

      await writeFile(
        join(project1, 'package.json'),
        JSON.stringify({
          name: 'project-1',
          dependencies: { '@mastra/core': '^1.0.0' },
        }),
      );

      await writeFile(
        join(project2, 'package.json'),
        JSON.stringify({
          name: 'project-2',
          devDependencies: { '@mastra/core': '^2.0.0' },
        }),
      );

      const projects = await source.listProjects();

      expect(projects).toHaveLength(2);
      const names = projects.map(p => p.name);
      expect(names).toContain('project-1');
      expect(names).toContain('project-2');
    });

    it('uses directory name when package.json has no name', async () => {
      const projectDir = join(testDir, 'unnamed-project');
      await mkdir(projectDir);
      await writeFile(
        join(projectDir, 'package.json'),
        JSON.stringify({
          dependencies: { '@mastra/core': '^1.0.0' },
        }),
      );

      const projects = await source.listProjects();

      expect(projects[0].name).toBe('unnamed-project');
    });

    it('generates consistent IDs for projects', async () => {
      const projectDir = join(testDir, 'my-project');
      await mkdir(projectDir);
      await writeFile(
        join(projectDir, 'package.json'),
        JSON.stringify({
          name: 'my-project',
          dependencies: { '@mastra/core': '^1.0.0' },
        }),
      );

      const projects1 = await source.listProjects();
      // Force cache expiry
      await new Promise(resolve => setTimeout(resolve, 100));
      (source as any)['#cacheExpiry'] = 0;
      const projects2 = await source.listProjects();

      expect(projects1[0].id).toBe(projects2[0].id);
    });

    it('includes metadata in discovered projects', async () => {
      const projectDir = join(testDir, 'metadata-project');
      await mkdir(projectDir);
      await writeFile(
        join(projectDir, 'package.json'),
        JSON.stringify({
          name: 'metadata-project',
          version: '1.2.3',
          dependencies: { '@mastra/core': '^1.0.0' },
        }),
      );
      await writeFile(join(projectDir, 'pnpm-lock.yaml'), '');

      const projects = await source.listProjects();

      expect(projects[0].metadata).toBeDefined();
      expect(projects[0].metadata?.packageManager).toBe('pnpm');
      expect(projects[0].metadata?.mastraVersion).toBe('^1.0.0');
    });

    it('returns cached results within TTL', async () => {
      const projectDir = join(testDir, 'cached-project');
      await mkdir(projectDir);
      await writeFile(
        join(projectDir, 'package.json'),
        JSON.stringify({
          name: 'cached-project',
          dependencies: { '@mastra/core': '^1.0.0' },
        }),
      );

      const projects1 = await source.listProjects();
      expect(projects1).toHaveLength(1);

      // Add another project while cache is valid
      const project2Dir = join(testDir, 'new-project');
      await mkdir(project2Dir);
      await writeFile(
        join(project2Dir, 'package.json'),
        JSON.stringify({
          name: 'new-project',
          dependencies: { '@mastra/core': '^1.0.0' },
        }),
      );

      // Should return cached result (only 1 project)
      const projects2 = await source.listProjects();
      expect(projects2).toHaveLength(1);
    });

    it('sets defaultBranch to main', async () => {
      const projectDir = join(testDir, 'branch-project');
      await mkdir(projectDir);
      await writeFile(
        join(projectDir, 'package.json'),
        JSON.stringify({
          name: 'branch-project',
          dependencies: { '@mastra/core': '^1.0.0' },
        }),
      );

      const projects = await source.listProjects();

      expect(projects[0].defaultBranch).toBe('main');
    });
  });

  describe('getProject', () => {
    it('returns project by ID', async () => {
      const projectDir = join(testDir, 'get-project');
      await mkdir(projectDir);
      await writeFile(
        join(projectDir, 'package.json'),
        JSON.stringify({
          name: 'get-project',
          dependencies: { '@mastra/core': '^1.0.0' },
        }),
      );

      const projects = await source.listProjects();
      const projectId = projects[0].id;

      const project = await source.getProject(projectId);

      expect(project).not.toBeNull();
      expect(project?.name).toBe('get-project');
    });

    it('returns null for non-existent project', async () => {
      const project = await source.getProject('non-existent-id');
      expect(project).toBeNull();
    });
  });

  describe('validateAccess', () => {
    it('returns true for valid Mastra project', async () => {
      const projectDir = join(testDir, 'valid-project');
      await mkdir(projectDir);
      await writeFile(
        join(projectDir, 'package.json'),
        JSON.stringify({
          name: 'valid-project',
          dependencies: { '@mastra/core': '^1.0.0' },
        }),
      );

      const projects = await source.listProjects();
      const isValid = await source.validateAccess(projects[0]);

      expect(isValid).toBe(true);
    });

    it('returns false for deleted project', async () => {
      const projectDir = join(testDir, 'deleted-project');
      await mkdir(projectDir);
      await writeFile(
        join(projectDir, 'package.json'),
        JSON.stringify({
          name: 'deleted-project',
          dependencies: { '@mastra/core': '^1.0.0' },
        }),
      );

      const projects = await source.listProjects();
      await rm(projectDir, { recursive: true });

      const isValid = await source.validateAccess(projects[0]);

      expect(isValid).toBe(false);
    });
  });

  describe('getProjectPath', () => {
    it('returns source path when no targetDir provided', async () => {
      const projectDir = join(testDir, 'source-path-project');
      await mkdir(projectDir);
      await writeFile(
        join(projectDir, 'package.json'),
        JSON.stringify({
          name: 'source-path-project',
          dependencies: { '@mastra/core': '^1.0.0' },
        }),
      );

      const projects = await source.listProjects();
      const path = await source.getProjectPath(projects[0]);

      expect(path).toBe(projectDir);
    });

    it('copies project to targetDir when provided', async () => {
      const projectDir = join(testDir, 'copy-project');
      const targetDir = join(testDir, 'build-target');

      await mkdir(projectDir);
      await writeFile(
        join(projectDir, 'package.json'),
        JSON.stringify({
          name: 'copy-project',
          dependencies: { '@mastra/core': '^1.0.0' },
        }),
      );
      await writeFile(join(projectDir, 'index.ts'), 'export const foo = 1;');

      const projects = await source.listProjects();
      const path = await source.getProjectPath(projects[0], targetDir);

      expect(path).toBe(targetDir);

      // Verify files were copied
      const packageJson = await readFile(join(targetDir, 'package.json'), 'utf-8');
      expect(JSON.parse(packageJson).name).toBe('copy-project');

      const indexTs = await readFile(join(targetDir, 'index.ts'), 'utf-8');
      expect(indexTs).toBe('export const foo = 1;');
    });

    it('excludes node_modules when copying', async () => {
      const projectDir = join(testDir, 'exclude-project');
      const targetDir = join(testDir, 'exclude-target');

      await mkdir(join(projectDir, 'node_modules'), { recursive: true });
      await mkdir(join(projectDir, 'src'), { recursive: true });
      await writeFile(
        join(projectDir, 'package.json'),
        JSON.stringify({
          name: 'exclude-project',
          dependencies: { '@mastra/core': '^1.0.0' },
        }),
      );
      await writeFile(join(projectDir, 'node_modules', 'dep.js'), 'module.exports = {}');
      await writeFile(join(projectDir, 'src', 'index.ts'), 'export {}');

      const projects = await source.listProjects();
      await source.getProjectPath(projects[0], targetDir);

      // src should be copied, node_modules should not
      const srcContent = await readFile(join(targetDir, 'src', 'index.ts'), 'utf-8');
      expect(srcContent).toBe('export {}');

      await expect(readFile(join(targetDir, 'node_modules', 'dep.js'))).rejects.toThrow();
    });
  });

  describe('watchChanges', () => {
    it('returns noop function when watchChanges is disabled', async () => {
      const projectDir = join(testDir, 'watch-project');
      await mkdir(projectDir);
      await writeFile(
        join(projectDir, 'package.json'),
        JSON.stringify({
          name: 'watch-project',
          dependencies: { '@mastra/core': '^1.0.0' },
        }),
      );

      const projects = await source.listProjects();
      const unsubscribe = source.watchChanges?.(projects[0], () => {});

      expect(typeof unsubscribe).toBe('function');
      // Should not throw
      unsubscribe?.();
    });
  });
});
