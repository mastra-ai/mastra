import { mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { computeSourceHash, writeBuildManifest, readBuildManifest, checkBuildStaleness } from './source-hash';

describe('source-hash', () => {
  let testDir: string;
  let mastraDir: string;
  let outputDir: string;

  beforeEach(async () => {
    // Create a unique temp directory for each test
    testDir = join(tmpdir(), `source-hash-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mastraDir = join(testDir, 'src', 'mastra');
    outputDir = join(testDir, '.mastra');

    await mkdir(mastraDir, { recursive: true });
    await mkdir(join(outputDir, 'output'), { recursive: true });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  describe('computeSourceHash', () => {
    it('should compute a deterministic hash for source files', async () => {
      // Create some source files
      await writeFile(join(mastraDir, 'index.ts'), 'export const mastra = {}');
      await writeFile(join(testDir, 'package.json'), '{"name": "test"}');

      const hash1 = await computeSourceHash(testDir, mastraDir);
      const hash2 = await computeSourceHash(testDir, mastraDir);

      expect(hash1).toBe(hash2);
      expect(hash1).toMatch(/^sha256:[a-f0-9]{64}$/);
    });

    it('should produce different hash when file content changes', async () => {
      await writeFile(join(mastraDir, 'index.ts'), 'export const mastra = {}');
      await writeFile(join(testDir, 'package.json'), '{"name": "test"}');

      const hash1 = await computeSourceHash(testDir, mastraDir);

      // Change the content
      await writeFile(join(mastraDir, 'index.ts'), 'export const mastra = { changed: true }');

      const hash2 = await computeSourceHash(testDir, mastraDir);

      expect(hash1).not.toBe(hash2);
    });

    it('should produce different hash when file is added', async () => {
      await writeFile(join(mastraDir, 'index.ts'), 'export const mastra = {}');
      await writeFile(join(testDir, 'package.json'), '{"name": "test"}');

      const hash1 = await computeSourceHash(testDir, mastraDir);

      // Add a new file
      await writeFile(join(mastraDir, 'agent.ts'), 'export const agent = {}');

      const hash2 = await computeSourceHash(testDir, mastraDir);

      expect(hash1).not.toBe(hash2);
    });

    it('should exclude test files from hash', async () => {
      await writeFile(join(mastraDir, 'index.ts'), 'export const mastra = {}');
      await writeFile(join(testDir, 'package.json'), '{"name": "test"}');

      const hash1 = await computeSourceHash(testDir, mastraDir);

      // Add a test file (should be ignored)
      await writeFile(join(mastraDir, 'index.test.ts'), 'test()');

      const hash2 = await computeSourceHash(testDir, mastraDir);

      expect(hash1).toBe(hash2);
    });

    it('should include workspace root lockfile in hash for monorepos', async () => {
      // Create a nested project structure simulating a monorepo
      const workspaceRoot = join(tmpdir(), `workspace-root-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
      const projectDir = join(workspaceRoot, 'packages', 'my-app');
      const projectMastraDir = join(projectDir, 'src', 'mastra');

      await mkdir(projectMastraDir, { recursive: true });

      // Create workspace root lockfile
      await writeFile(join(workspaceRoot, 'pnpm-lock.yaml'), 'lockfileVersion: 1');

      // Create project files
      await writeFile(join(projectMastraDir, 'index.ts'), 'export const mastra = {}');
      await writeFile(join(projectDir, 'package.json'), '{"name": "my-app"}');

      const hash1 = await computeSourceHash(projectDir, projectMastraDir);

      // Change workspace root lockfile
      await writeFile(join(workspaceRoot, 'pnpm-lock.yaml'), 'lockfileVersion: 2');

      const hash2 = await computeSourceHash(projectDir, projectMastraDir);

      expect(hash1).not.toBe(hash2);

      // Cleanup
      await rm(workspaceRoot, { recursive: true, force: true });
    });
  });

  describe('writeBuildManifest / readBuildManifest', () => {
    it('should write and read a manifest correctly', async () => {
      const sourceHash = 'sha256:abc123';

      await writeBuildManifest(outputDir, sourceHash);
      const manifest = await readBuildManifest(outputDir);

      expect(manifest).not.toBeNull();
      expect(manifest!.sourceHash).toBe(sourceHash);
      expect(manifest!.buildTime).toBeDefined();
    });

    it('should return null for missing manifest', async () => {
      const manifest = await readBuildManifest(outputDir);
      expect(manifest).toBeNull();
    });

    it('should return null for invalid manifest', async () => {
      await writeFile(join(outputDir, 'build-manifest.json'), 'not json');
      const manifest = await readBuildManifest(outputDir);
      expect(manifest).toBeNull();
    });
  });

  describe('checkBuildStaleness', () => {
    it('should return isStale=true with reason=no-build when no build exists', async () => {
      await writeFile(join(mastraDir, 'index.ts'), 'export const mastra = {}');
      await writeFile(join(testDir, 'package.json'), '{"name": "test"}');

      // Remove the output dir to simulate no build
      await rm(join(outputDir, 'output'), { recursive: true });

      const result = await checkBuildStaleness(testDir, mastraDir, outputDir);

      expect(result.isStale).toBe(true);
      expect(result.reason).toBe('no-build');
    });

    it('should return isStale=true with reason=no-manifest when build exists but no manifest', async () => {
      await writeFile(join(mastraDir, 'index.ts'), 'export const mastra = {}');
      await writeFile(join(testDir, 'package.json'), '{"name": "test"}');
      await writeFile(join(outputDir, 'output', 'index.mjs'), 'built code');

      const result = await checkBuildStaleness(testDir, mastraDir, outputDir);

      expect(result.isStale).toBe(true);
      expect(result.reason).toBe('no-manifest');
    });

    it('should return isStale=true with reason=hash-mismatch when source changed', async () => {
      await writeFile(join(mastraDir, 'index.ts'), 'export const mastra = {}');
      await writeFile(join(testDir, 'package.json'), '{"name": "test"}');
      await writeFile(join(outputDir, 'output', 'index.mjs'), 'built code');

      // Write manifest with old hash
      await writeBuildManifest(outputDir, 'sha256:old-hash');

      const result = await checkBuildStaleness(testDir, mastraDir, outputDir);

      expect(result.isStale).toBe(true);
      expect(result.reason).toBe('hash-mismatch');
      expect(result.currentHash).toMatch(/^sha256:[a-f0-9]{64}$/);
      expect(result.manifestHash).toBe('sha256:old-hash');
    });

    it('should return isStale=false with reason=up-to-date when hashes match', async () => {
      await writeFile(join(mastraDir, 'index.ts'), 'export const mastra = {}');
      await writeFile(join(testDir, 'package.json'), '{"name": "test"}');
      await writeFile(join(outputDir, 'output', 'index.mjs'), 'built code');

      // Compute current hash and write manifest with it
      const currentHash = await computeSourceHash(testDir, mastraDir);
      await writeBuildManifest(outputDir, currentHash);

      const result = await checkBuildStaleness(testDir, mastraDir, outputDir);

      expect(result.isStale).toBe(false);
      expect(result.reason).toBe('up-to-date');
      expect(result.currentHash).toBe(currentHash);
      expect(result.manifestHash).toBe(currentHash);
    });
  });
});
