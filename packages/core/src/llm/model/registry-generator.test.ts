import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { atomicWriteFile, generateTypesContent, writeRegistryFiles } from './registry-generator.js';

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map(dir => fs.rm(dir, { recursive: true, force: true })));
});

describe('registry-generator', () => {
  describe('generateTypesContent', () => {
    it('should not quote valid JS identifiers', () => {
      const models = {
        openai: ['gpt-4'],
        _private: ['model-1'],
        $provider: ['model-2'],
        provider123: ['model-3'],
      };

      const content = generateTypesContent(models);

      expect(content).toContain('readonly openai:');
      expect(content).toContain('readonly _private:');
      expect(content).toContain('readonly $provider:');
      expect(content).toContain('readonly provider123:');
    });

    it('should quote provider names with special characters', () => {
      const models = {
        'fireworks-ai': ['llama-v3-70b'],
      };

      const content = generateTypesContent(models);

      expect(content).toContain("readonly 'fireworks-ai':");
    });

    it('should quote provider names starting with digits', () => {
      const models = {
        '302ai': ['model-1'],
      };

      const content = generateTypesContent(models);

      expect(content).toContain("readonly '302ai':");
      expect(content).not.toMatch(/readonly\s+\d/);
    });
  });

  describe('atomicWriteFile', () => {
    it('retries a transient Windows replacement lock', async () => {
      const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'mastra-atomic-write-'));
      tempDirs.push(dir);
      const target = path.join(dir, 'provider-registry.json');
      const originalPlatform = process.platform;
      const originalRename = fs.rename;
      let attempts = 0;

      Object.defineProperty(process, 'platform', { value: 'win32' });
      vi.spyOn(fs, 'rename').mockImplementation(async (source, destination) => {
        attempts += 1;
        if (attempts < 3) {
          const error = new Error('destination temporarily locked') as NodeJS.ErrnoException;
          error.code = 'EPERM';
          throw error;
        }
        return originalRename(source, destination);
      });

      try {
        await atomicWriteFile(target, '{"ok":true}');

        expect(attempts).toBe(3);
        await expect(fs.readFile(target, 'utf8')).resolves.toBe('{"ok":true}');
      } finally {
        Object.defineProperty(process, 'platform', { value: originalPlatform });
        vi.restoreAllMocks();
      }
    });

    it('does not retry non-Windows replacement locks', async () => {
      const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'mastra-atomic-write-'));
      tempDirs.push(dir);
      const target = path.join(dir, 'provider-registry.json');
      const originalPlatform = process.platform;
      let attempts = 0;

      Object.defineProperty(process, 'platform', { value: 'linux' });
      vi.spyOn(fs, 'rename').mockImplementation(async () => {
        attempts += 1;
        const error = new Error('destination temporarily locked') as NodeJS.ErrnoException;
        error.code = 'EPERM';
        throw error;
      });

      try {
        await expect(atomicWriteFile(target, '{"ok":true}')).rejects.toMatchObject({ code: 'EPERM' });
        expect(attempts).toBe(1);
      } finally {
        Object.defineProperty(process, 'platform', { value: originalPlatform });
        vi.restoreAllMocks();
      }
    });
  });

  describe('writeRegistryFiles capability files', () => {
    it('writes structured output data for gateway-prefixed providers using reversible flat filenames', async () => {
      const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'mastra-capabilities-'));
      tempDirs.push(dir);

      await writeRegistryFiles(
        path.join(dir, 'provider-registry.json'),
        path.join(dir, 'provider-types.generated.d.ts'),
        {},
        {},
        undefined,
        undefined,
        { 'netlify/anthropic': ['claude-sonnet-4'] },
      );

      const capabilityPath = path.join(dir, 'capabilities', 'netlify%2Fanthropic.json');
      await expect(fs.readFile(capabilityPath, 'utf8')).resolves.toContain('claude-sonnet-4');
      await expect(fs.stat(path.join(dir, 'capabilities', 'netlify'))).rejects.toMatchObject({ code: 'ENOENT' });
    });

    it('removes stale flat capability files and legacy nested paths on regeneration', async () => {
      const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'mastra-capabilities-'));
      tempDirs.push(dir);
      const jsonPath = path.join(dir, 'provider-registry.json');
      const typesPath = path.join(dir, 'provider-types.generated.d.ts');
      const stalePath = path.join(dir, 'capabilities', 'stale.json');
      const legacyPath = path.join(dir, 'capabilities', 'netlify', 'anthropic.json');

      await fs.mkdir(path.dirname(legacyPath), { recursive: true });
      await fs.writeFile(stalePath, '{}');
      await fs.writeFile(legacyPath, '{}');
      await writeRegistryFiles(jsonPath, typesPath, {}, {}, undefined, undefined, { openai: ['gpt-4o'] });

      await expect(fs.stat(stalePath)).rejects.toMatchObject({ code: 'ENOENT' });
      await expect(fs.stat(legacyPath)).rejects.toMatchObject({ code: 'ENOENT' });
      await expect(fs.readFile(path.join(dir, 'capabilities', 'openai.json'), 'utf8')).resolves.toContain('gpt-4o');
    });

    it('removes capability files when regenerated without capability data', async () => {
      const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'mastra-capabilities-'));
      tempDirs.push(dir);
      const jsonPath = path.join(dir, 'provider-registry.json');
      const typesPath = path.join(dir, 'provider-types.generated.d.ts');
      const capabilityDir = path.join(dir, 'capabilities');
      const capabilityPath = path.join(capabilityDir, 'openai.json');

      await writeRegistryFiles(jsonPath, typesPath, {}, {}, undefined, undefined, { openai: ['gpt-4o'] });
      await expect(fs.readFile(capabilityPath, 'utf8')).resolves.toContain('gpt-4o');

      await writeRegistryFiles(jsonPath, typesPath, {}, {}, {}, {}, {});

      await expect(fs.stat(capabilityPath)).rejects.toMatchObject({ code: 'ENOENT' });
      await expect(fs.stat(capabilityDir)).rejects.toMatchObject({ code: 'ENOENT' });
    });
  });
});
