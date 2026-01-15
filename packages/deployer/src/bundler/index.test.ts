import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Bundler } from './index';

// Create a concrete implementation for testing
class TestBundler extends Bundler {
  constructor() {
    super('test-bundler', 'BUNDLER');
  }
}

describe('Bundler', () => {
  let tempDir: string;
  let bundler: TestBundler;

  beforeEach(async () => {
    tempDir = join(tmpdir(), `mastra-bundler-test-${Date.now()}`);
    await mkdir(tempDir, { recursive: true });
    bundler = new TestBundler();
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('getAllToolPaths', () => {
    it('should generate default tool paths with ignore patterns for tests', () => {
      const mastraDir = '/project/src/mastra';
      const result = bundler.getAllToolPaths(mastraDir);

      expect(result).toHaveLength(1);
      // result[0] is an array of glob patterns
      const patterns = result[0] as string[];
      expect(patterns[0]).toContain('/project/src/mastra/tools/**/*.{js,ts}');
      // Should have ignore patterns for test files (negation patterns start with !)
      expect(patterns.some(p => p.startsWith('!'))).toBe(true);
    });

    it('should include user-provided tool paths along with defaults', () => {
      const mastraDir = '/project/src/mastra';
      const customPaths = [['/project/custom-tools/**/*.ts']];
      const result = bundler.getAllToolPaths(mastraDir, customPaths);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual(['/project/custom-tools/**/*.ts']);
    });
  });

  describe('listToolsInputOptions', () => {
    it('should not include files from node_modules directory', async () => {
      // Setup: Create a directory structure that mimics a real project
      const mastraDir = join(tempDir, 'src', 'mastra');
      const toolsDir = join(mastraDir, 'tools');
      const nodeModulesDir = join(tempDir, 'node_modules');
      const nodeModulesToolDir = join(nodeModulesDir, 'some-package', 'tools');

      // Create directories
      await mkdir(toolsDir, { recursive: true });
      await mkdir(nodeModulesToolDir, { recursive: true });

      // Create a legitimate tool file
      await writeFile(join(toolsDir, 'my-tool.ts'), 'export const myTool = {};');

      // Create a file in node_modules that matches the tool pattern
      // This simulates a package that has its own tools directory
      await writeFile(join(nodeModulesToolDir, 'internal-tool.ts'), 'export const internalTool = {};');

      // Use a broad glob pattern that could accidentally include node_modules
      const toolsPaths = [[join(tempDir, '**', 'tools', '**', '*.ts')]];

      const result = await bundler.listToolsInputOptions(toolsPaths);

      // The result should NOT include files from node_modules
      const toolPaths = Object.values(result);

      // Should find the legitimate tool
      expect(toolPaths.some(p => p.includes('src/mastra/tools/my-tool.ts'))).toBe(true);

      // Should NOT find tools inside node_modules
      // THIS IS THE FAILING ASSERTION - currently the bundler DOES include node_modules files
      expect(toolPaths.some(p => p.includes('node_modules'))).toBe(false);
    });

    it('should not include files from .mastra directory', async () => {
      // Setup: Create a directory structure with .mastra build output
      const mastraDir = join(tempDir, 'src', 'mastra');
      const toolsDir = join(mastraDir, 'tools');
      const dotMastraDir = join(tempDir, '.mastra');
      const dotMastraToolsDir = join(dotMastraDir, 'output', 'tools');

      // Create directories
      await mkdir(toolsDir, { recursive: true });
      await mkdir(dotMastraToolsDir, { recursive: true });

      // Create a legitimate tool file
      await writeFile(join(toolsDir, 'my-tool.ts'), 'export const myTool = {};');

      // Create a bundled tool in .mastra (from previous build)
      await writeFile(join(dotMastraToolsDir, 'bundled-tool.ts'), 'export const bundledTool = {};');

      // Use a broad glob pattern
      const toolsPaths = [[join(tempDir, '**', 'tools', '**', '*.ts')]];

      const result = await bundler.listToolsInputOptions(toolsPaths);

      const toolPaths = Object.values(result);

      // Should find the legitimate tool
      expect(toolPaths.some(p => p.includes('src/mastra/tools/my-tool.ts'))).toBe(true);

      // Should NOT find tools inside .mastra
      // THIS IS THE FAILING ASSERTION - currently the bundler DOES include .mastra files
      expect(toolPaths.some(p => p.includes('.mastra'))).toBe(false);
    });

    it('should handle large number of files in node_modules without timeout', async () => {
      // Setup: Simulate a realistic node_modules with many files
      const mastraDir = join(tempDir, 'src', 'mastra');
      const toolsDir = join(mastraDir, 'tools');
      const nodeModulesDir = join(tempDir, 'node_modules');

      await mkdir(toolsDir, { recursive: true });

      // Create a legitimate tool
      await writeFile(join(toolsDir, 'my-tool.ts'), 'export const myTool = {};');

      // Create 100 fake packages with tools directories (simulating ~43k files scenario)
      // In a real scenario this would be much larger
      const packageCount = 100;
      for (let i = 0; i < packageCount; i++) {
        const pkgToolsDir = join(nodeModulesDir, `package-${i}`, 'tools');
        await mkdir(pkgToolsDir, { recursive: true });
        await writeFile(join(pkgToolsDir, 'tool.ts'), `export const tool${i} = {};`);
      }

      // Use a broad glob pattern
      const toolsPaths = [[join(tempDir, '**', 'tools', '**', '*.ts')]];

      const startTime = Date.now();
      const result = await bundler.listToolsInputOptions(toolsPaths);
      const duration = Date.now() - startTime;

      const toolPaths = Object.values(result);

      // Performance check: should complete quickly (under 1 second)
      // because node_modules should be excluded
      expect(duration).toBeLessThan(1000);

      // Should only find the legitimate tool, not 100+ node_modules tools
      // THIS WILL FAIL - currently it finds all 101 tools
      expect(toolPaths.length).toBe(1);
      expect(toolPaths.some(p => p.includes('node_modules'))).toBe(false);
    });
  });
});
