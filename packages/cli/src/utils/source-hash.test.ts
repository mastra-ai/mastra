import { mkdir, mkdtemp, open, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { describe, it, expect, beforeEach, afterEach, afterAll } from 'vitest';
import { computeSourceHash, writeBuildManifest, readBuildManifest, checkBuildStaleness } from './source-hash';

// Use a local .test-tmp dir instead of os.tmpdir() — some CI runners
// (e.g. starsling-ubuntu) have flaky /tmp behaviour with rapid write/read cycles.
const TEST_TMP_ROOT = join(__dirname, '.test-tmp');

/**
 * Write a file and fsync to disk. Some CI runners (starsling-ubuntu under
 * memory pressure) return stale page-cache content after rapid write/read
 * cycles unless we explicitly fsync.
 */
async function writeFileSynced(path: string, content: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const fh = await open(path, 'w');
  try {
    await fh.writeFile(content);
    await fh.sync();
  } finally {
    await fh.close();
  }
}

describe.sequential('source-hash', () => {
  let testDir: string;
  let mastraDir: string;
  let outputDir: string;

  beforeEach(async () => {
    await mkdir(TEST_TMP_ROOT, { recursive: true });
    testDir = await mkdtemp(join(TEST_TMP_ROOT, 'source-hash-test-'));
    mastraDir = join(testDir, 'src', 'mastra');
    outputDir = join(testDir, '.mastra');

    await mkdir(mastraDir, { recursive: true });
    await mkdir(outputDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  afterAll(async () => {
    await rm(TEST_TMP_ROOT, { recursive: true, force: true });
  });

  describe('computeSourceHash', () => {
    it('should compute a deterministic hash for source files', async () => {
      await writeFileSynced(join(mastraDir, 'index.ts'), 'export const mastra = {}');
      await writeFileSynced(join(testDir, 'package.json'), '{"name": "test"}');

      const hash1 = await computeSourceHash(testDir, mastraDir);
      const hash2 = await computeSourceHash(testDir, mastraDir);

      expect(hash1).toBe(hash2);
      expect(hash1).toMatch(/^sha256:[a-f0-9]{64}$/);
    });

    it('should produce different hash when file content changes', async () => {
      await writeFileSynced(join(mastraDir, 'index.ts'), 'export const mastra = {}');
      await writeFileSynced(join(testDir, 'package.json'), '{"name": "test"}');

      const hash1 = await computeSourceHash(testDir, mastraDir);

      await writeFileSynced(join(mastraDir, 'index.ts'), 'export const mastra = { changed: true }');

      const hash2 = await computeSourceHash(testDir, mastraDir);

      expect(hash1).not.toBe(hash2);
    });

    it('should produce different hash when file is added', async () => {
      await writeFileSynced(join(mastraDir, 'index.ts'), 'export const mastra = {}');
      await writeFileSynced(join(testDir, 'package.json'), '{"name": "test"}');

      const hash1 = await computeSourceHash(testDir, mastraDir);

      await writeFileSynced(join(mastraDir, 'agent.ts'), 'export const agent = {}');

      const hash2 = await computeSourceHash(testDir, mastraDir);

      expect(hash1).not.toBe(hash2);
    });

    it('should exclude test files from hash', async () => {
      await writeFileSynced(join(mastraDir, 'index.ts'), 'export const mastra = {}');
      await writeFileSynced(join(testDir, 'package.json'), '{"name": "test"}');

      const hash1 = await computeSourceHash(testDir, mastraDir);

      await writeFileSynced(join(mastraDir, 'index.test.ts'), 'test()');

      const hash2 = await computeSourceHash(testDir, mastraDir);

      expect(hash1).toBe(hash2);
    });

    it('should include workspace root lockfile in hash for monorepos', async () => {
      const workspaceRoot = await mkdtemp(join(TEST_TMP_ROOT, 'workspace-root-test-'));
      const projectDir = join(workspaceRoot, 'packages', 'my-app');
      const projectMastraDir = join(projectDir, 'src', 'mastra');

      await mkdir(projectMastraDir, { recursive: true });

      await writeFileSynced(join(workspaceRoot, 'pnpm-lock.yaml'), 'lockfileVersion: 1');

      await writeFileSynced(join(projectMastraDir, 'index.ts'), 'export const mastra = {}');
      await writeFileSynced(join(projectDir, 'package.json'), '{"name": "my-app"}');

      const hash1 = await computeSourceHash(projectDir, projectMastraDir);

      await writeFileSynced(join(workspaceRoot, 'pnpm-lock.yaml'), 'lockfileVersion: 2');

      const hash2 = await computeSourceHash(projectDir, projectMastraDir);

      expect(hash1).not.toBe(hash2);

      await rm(workspaceRoot, { recursive: true, force: true });
    });

    it('should include Factory UI inputs when projectType is factory', async () => {
      // Set up a Factory-style project with UI source outside src/mastra
      await writeFileSynced(join(mastraDir, 'index.ts'), 'export const mastra = {}');
      await writeFileSynced(join(testDir, 'package.json'), '{"name": "test"}');
      await writeFileSynced(join(testDir, 'src', 'web', 'ui', 'App.tsx'), 'export const App = () => null');

      const hash1 = await computeSourceHash(testDir, mastraDir, 'software-factory');

      // Change a UI file — hash must change
      await writeFileSynced(join(testDir, 'src', 'web', 'ui', 'App.tsx'), 'export const App = () => <div/>');

      const hash2 = await computeSourceHash(testDir, mastraDir, 'software-factory');

      expect(hash1).not.toBe(hash2);
    });

    it('should include Vite config when projectType is factory', async () => {
      await writeFileSynced(join(mastraDir, 'index.ts'), 'export const mastra = {}');
      await writeFileSynced(join(testDir, 'package.json'), '{"name": "test"}');
      await writeFileSynced(join(testDir, 'src', 'web', 'vite.config.ts'), 'export default {}');

      const hash1 = await computeSourceHash(testDir, mastraDir, 'software-factory');

      await writeFileSynced(join(testDir, 'src', 'web', 'vite.config.ts'), 'export default { changed: true }');

      const hash2 = await computeSourceHash(testDir, mastraDir, 'software-factory');

      expect(hash1).not.toBe(hash2);
    });

    it('should NOT include Factory UI inputs when projectType is undefined', async () => {
      await writeFileSynced(join(mastraDir, 'index.ts'), 'export const mastra = {}');
      await writeFileSynced(join(testDir, 'package.json'), '{"name": "test"}');
      await writeFileSynced(join(testDir, 'src', 'web', 'ui', 'App.tsx'), 'export const App = () => null');

      const hash1 = await computeSourceHash(testDir, mastraDir);

      // Change a UI file — hash must NOT change (UI inputs not included)
      await writeFileSynced(join(testDir, 'src', 'web', 'ui', 'App.tsx'), 'export const App = () => <div/>');

      const hash2 = await computeSourceHash(testDir, mastraDir);

      expect(hash1).toBe(hash2);
    });

    it('should NOT hash generated src/mastra/public/factory output', async () => {
      await writeFileSynced(join(mastraDir, 'index.ts'), 'export const mastra = {}');
      await writeFileSynced(join(testDir, 'package.json'), '{"name": "test"}');
      // Simulate generated Factory UI output
      await writeFileSynced(join(mastraDir, 'public', 'factory', 'index.html'), '<html></html>');

      const hash1 = await computeSourceHash(testDir, mastraDir, 'software-factory');

      // Change generated output — hash must NOT change
      await writeFileSynced(join(mastraDir, 'public', 'factory', 'index.html'), '<html><body>changed</body></html>');

      const hash2 = await computeSourceHash(testDir, mastraDir, 'software-factory');

      expect(hash1).toBe(hash2);
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
      await writeFileSynced(join(outputDir, 'build-manifest.json'), 'not json');
      const manifest = await readBuildManifest(outputDir);
      expect(manifest).toBeNull();
    });
  });

  describe('checkBuildStaleness', () => {
    it('should return isStale=true with reason=no-build when no build exists', async () => {
      await writeFileSynced(join(mastraDir, 'index.ts'), 'export const mastra = {}');
      await writeFileSynced(join(testDir, 'package.json'), '{"name": "test"}');

      const result = await checkBuildStaleness(testDir, mastraDir, outputDir);

      expect(result.isStale).toBe(true);
      expect(result.reason).toBe('no-build');
    });

    it('should return isStale=true with reason=no-manifest when build exists but no manifest', async () => {
      await writeFileSynced(join(mastraDir, 'index.ts'), 'export const mastra = {}');
      await writeFileSynced(join(testDir, 'package.json'), '{"name": "test"}');
      await writeFileSynced(join(outputDir, 'output', 'index.mjs'), 'built code');

      const result = await checkBuildStaleness(testDir, mastraDir, outputDir);

      expect(result.isStale).toBe(true);
      expect(result.reason).toBe('no-manifest');
    });

    it('should return isStale=true with reason=hash-mismatch when source changed', async () => {
      await writeFileSynced(join(mastraDir, 'index.ts'), 'export const mastra = {}');
      await writeFileSynced(join(testDir, 'package.json'), '{"name": "test"}');
      await writeFileSynced(join(outputDir, 'output', 'index.mjs'), 'built code');

      await writeBuildManifest(outputDir, 'sha256:old-hash');

      const result = await checkBuildStaleness(testDir, mastraDir, outputDir);

      expect(result.isStale).toBe(true);
      expect(result.reason).toBe('hash-mismatch');
      expect(result.currentHash).toMatch(/^sha256:[a-f0-9]{64}$/);
      expect(result.manifestHash).toBe('sha256:old-hash');
    });

    it('should return isStale=false with reason=up-to-date when hashes match', async () => {
      await writeFileSynced(join(mastraDir, 'index.ts'), 'export const mastra = {}');
      await writeFileSynced(join(testDir, 'package.json'), '{"name": "test"}');
      await writeFileSynced(join(outputDir, 'output', 'index.mjs'), 'built code');

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
