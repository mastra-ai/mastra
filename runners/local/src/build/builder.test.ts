import * as path from 'node:path';
import * as os from 'node:os';
import * as fs from 'node:fs/promises';
import type { Build, Project } from '@mastra/admin';
import { BuildStatus } from '@mastra/admin';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ProjectBuilder } from './builder';

// Mock the spawner module
vi.mock('../process/spawner', () => ({
  runCommand: vi.fn(),
}));

describe('ProjectBuilder', () => {
  let testDir: string;
  let builder: ProjectBuilder;
  let mockProject: Project;
  let mockBuild: Build;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'builder-test-'));
    builder = new ProjectBuilder();

    mockProject = {
      id: 'project-1',
      name: 'test-project',
      slug: 'test-project',
      sourceType: 'local',
      sourceConfig: { path: testDir },
      createdAt: new Date(),
      updatedAt: new Date(),
    } as Project;

    mockBuild = {
      id: 'build-1',
      projectId: 'project-1',
      status: BuildStatus.BUILDING,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as Build;

    vi.clearAllMocks();
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('constructor', () => {
    it('should use default configuration', () => {
      const b = new ProjectBuilder();
      expect(b).toBeDefined();
    });

    it('should merge custom configuration', () => {
      const b = new ProjectBuilder({
        defaultTimeoutMs: 300000,
        buildDir: '/custom/build',
        globalEnvVars: { CUSTOM: 'value' },
      });
      expect(b).toBeDefined();
    });
  });

  describe('build', () => {
    it('should detect package manager and run install', async () => {
      const { runCommand } = await import('../process/spawner');

      // Create package.json with pnpm lock file
      await fs.writeFile(path.join(testDir, 'package.json'), JSON.stringify({ name: 'test' }));
      await fs.writeFile(path.join(testDir, 'pnpm-lock.yaml'), '');

      // Create output directory with entry point
      const outputDir = path.join(testDir, '.mastra/output');
      await fs.mkdir(outputDir, { recursive: true });
      await fs.writeFile(path.join(outputDir, 'index.mjs'), 'export default {}');

      (runCommand as ReturnType<typeof vi.fn>).mockResolvedValue({ exitCode: 0, output: [] });

      const logs: string[] = [];
      const result = await builder.build(mockProject, mockBuild, testDir, undefined, log => logs.push(log));

      expect(result.status).toBe(BuildStatus.SUCCEEDED);
      expect(runCommand).toHaveBeenCalledWith(
        'pnpm',
        expect.arrayContaining(['install']),
        expect.objectContaining({ cwd: testDir }),
      );
    });

    it('should skip install when skipInstall is true', async () => {
      const { runCommand } = await import('../process/spawner');

      // Create package.json without build script
      await fs.writeFile(path.join(testDir, 'package.json'), JSON.stringify({ name: 'test' }));

      // Create output directory with entry point
      const outputDir = path.join(testDir, '.mastra/output');
      await fs.mkdir(outputDir, { recursive: true });
      await fs.writeFile(path.join(outputDir, 'index.mjs'), 'export default {}');

      (runCommand as ReturnType<typeof vi.fn>).mockResolvedValue({ exitCode: 0, output: [] });

      const result = await builder.build(mockProject, mockBuild, testDir, { skipInstall: true });

      expect(result.status).toBe(BuildStatus.SUCCEEDED);
      // Should not have called runCommand for install
      expect(runCommand).not.toHaveBeenCalledWith(
        expect.anything(),
        expect.arrayContaining(['install']),
        expect.anything(),
      );
    });

    it('should run build script when present', async () => {
      const { runCommand } = await import('../process/spawner');

      // Create package.json with build script
      await fs.writeFile(
        path.join(testDir, 'package.json'),
        JSON.stringify({ name: 'test', scripts: { build: 'tsc' } }),
      );

      // Create output directory with entry point
      const outputDir = path.join(testDir, '.mastra/output');
      await fs.mkdir(outputDir, { recursive: true });
      await fs.writeFile(path.join(outputDir, 'index.mjs'), 'export default {}');

      (runCommand as ReturnType<typeof vi.fn>).mockResolvedValue({ exitCode: 0, output: [] });

      const result = await builder.build(mockProject, mockBuild, testDir);

      expect(result.status).toBe(BuildStatus.SUCCEEDED);
      expect(runCommand).toHaveBeenCalledWith(
        expect.anything(),
        expect.arrayContaining(['run', 'build']),
        expect.anything(),
      );
    });

    it('should skip build step when no build script', async () => {
      const { runCommand } = await import('../process/spawner');

      // Create package.json without build script
      await fs.writeFile(path.join(testDir, 'package.json'), JSON.stringify({ name: 'test' }));

      // Create output directory with entry point
      const outputDir = path.join(testDir, '.mastra/output');
      await fs.mkdir(outputDir, { recursive: true });
      await fs.writeFile(path.join(outputDir, 'index.mjs'), 'export default {}');

      (runCommand as ReturnType<typeof vi.fn>).mockResolvedValue({ exitCode: 0, output: [] });

      const logs: string[] = [];
      const result = await builder.build(mockProject, mockBuild, testDir, undefined, log => logs.push(log));

      expect(result.status).toBe(BuildStatus.SUCCEEDED);
      expect(logs.some(l => l.includes('No build script found'))).toBe(true);
    });

    it('should fail when install fails', async () => {
      const { runCommand } = await import('../process/spawner');

      await fs.writeFile(path.join(testDir, 'package.json'), JSON.stringify({ name: 'test' }));

      (runCommand as ReturnType<typeof vi.fn>).mockResolvedValue({ exitCode: 1, output: ['Error'] });

      const result = await builder.build(mockProject, mockBuild, testDir);

      expect(result.status).toBe(BuildStatus.FAILED);
      expect(result.errorMessage).toContain('Dependency installation failed');
    });

    it('should fail when build script fails', async () => {
      const { runCommand } = await import('../process/spawner');

      await fs.writeFile(
        path.join(testDir, 'package.json'),
        JSON.stringify({ name: 'test', scripts: { build: 'exit 1' } }),
      );

      // First call (install) succeeds, second call (build) fails
      (runCommand as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({ exitCode: 0, output: [] })
        .mockResolvedValueOnce({ exitCode: 1, output: ['Build error'] });

      const result = await builder.build(mockProject, mockBuild, testDir);

      expect(result.status).toBe(BuildStatus.FAILED);
      expect(result.errorMessage).toContain('Build failed with exit code');
    });

    it('should fail when output directory does not exist', async () => {
      const { runCommand } = await import('../process/spawner');

      await fs.writeFile(path.join(testDir, 'package.json'), JSON.stringify({ name: 'test' }));

      (runCommand as ReturnType<typeof vi.fn>).mockResolvedValue({ exitCode: 0, output: [] });

      const result = await builder.build(mockProject, mockBuild, testDir);

      expect(result.status).toBe(BuildStatus.FAILED);
      expect(result.errorMessage).toContain('Build output not found');
    });

    it('should fail when entry point does not exist', async () => {
      const { runCommand } = await import('../process/spawner');

      await fs.writeFile(path.join(testDir, 'package.json'), JSON.stringify({ name: 'test' }));

      // Create output directory but no entry point
      const outputDir = path.join(testDir, '.mastra/output');
      await fs.mkdir(outputDir, { recursive: true });

      (runCommand as ReturnType<typeof vi.fn>).mockResolvedValue({ exitCode: 0, output: [] });

      const result = await builder.build(mockProject, mockBuild, testDir);

      expect(result.status).toBe(BuildStatus.FAILED);
      expect(result.errorMessage).toContain('Build output not found');
    });

    it('should pass environment variables', async () => {
      const { runCommand } = await import('../process/spawner');

      await fs.writeFile(path.join(testDir, 'package.json'), JSON.stringify({ name: 'test' }));

      // Create output directory with entry point
      const outputDir = path.join(testDir, '.mastra/output');
      await fs.mkdir(outputDir, { recursive: true });
      await fs.writeFile(path.join(outputDir, 'index.mjs'), 'export default {}');

      (runCommand as ReturnType<typeof vi.fn>).mockResolvedValue({ exitCode: 0, output: [] });

      await builder.build(mockProject, mockBuild, testDir, { envVars: { CUSTOM_VAR: 'value' } });

      expect(runCommand).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.objectContaining({
          env: expect.objectContaining({
            CUSTOM_VAR: 'value',
            NODE_ENV: 'production',
          }),
        }),
      );
    });

    it('should set completedAt on success', async () => {
      const { runCommand } = await import('../process/spawner');

      await fs.writeFile(path.join(testDir, 'package.json'), JSON.stringify({ name: 'test' }));

      // Create output directory with entry point
      const outputDir = path.join(testDir, '.mastra/output');
      await fs.mkdir(outputDir, { recursive: true });
      await fs.writeFile(path.join(outputDir, 'index.mjs'), 'export default {}');

      (runCommand as ReturnType<typeof vi.fn>).mockResolvedValue({ exitCode: 0, output: [] });

      const before = new Date();
      const result = await builder.build(mockProject, mockBuild, testDir);
      const after = new Date();

      expect(result.completedAt).toBeDefined();
      expect(result.completedAt!.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(result.completedAt!.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it('should set completedAt on failure', async () => {
      const { runCommand } = await import('../process/spawner');

      await fs.writeFile(path.join(testDir, 'package.json'), JSON.stringify({ name: 'test' }));

      (runCommand as ReturnType<typeof vi.fn>).mockResolvedValue({ exitCode: 1, output: [] });

      const result = await builder.build(mockProject, mockBuild, testDir);

      expect(result.completedAt).toBeDefined();
    });

    it('should stream logs to callback', async () => {
      const { runCommand } = await import('../process/spawner');

      await fs.writeFile(path.join(testDir, 'package.json'), JSON.stringify({ name: 'test' }));

      // Create output directory with entry point
      const outputDir = path.join(testDir, '.mastra/output');
      await fs.mkdir(outputDir, { recursive: true });
      await fs.writeFile(path.join(outputDir, 'index.mjs'), 'export default {}');

      (runCommand as ReturnType<typeof vi.fn>).mockResolvedValue({ exitCode: 0, output: [] });

      const logs: string[] = [];
      await builder.build(mockProject, mockBuild, testDir, undefined, log => logs.push(log));

      expect(logs.length).toBeGreaterThan(0);
      expect(logs.some(l => l.includes('Detected package manager'))).toBe(true);
      expect(logs.some(l => l.includes('Installing dependencies'))).toBe(true);
    });

    it('should use global env vars from config', async () => {
      const { runCommand } = await import('../process/spawner');

      const customBuilder = new ProjectBuilder({
        globalEnvVars: { GLOBAL_VAR: 'global-value' },
      });

      await fs.writeFile(path.join(testDir, 'package.json'), JSON.stringify({ name: 'test' }));

      // Create output directory with entry point
      const outputDir = path.join(testDir, '.mastra/output');
      await fs.mkdir(outputDir, { recursive: true });
      await fs.writeFile(path.join(outputDir, 'index.mjs'), 'export default {}');

      (runCommand as ReturnType<typeof vi.fn>).mockResolvedValue({ exitCode: 0, output: [] });

      await customBuilder.build(mockProject, mockBuild, testDir);

      expect(runCommand).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.objectContaining({
          env: expect.objectContaining({
            GLOBAL_VAR: 'global-value',
          }),
        }),
      );
    });
  });
});
