import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ModelsDevGateway } from './gateways/models-dev.js';
import { NetlifyGateway } from './gateways/netlify.js';
import {
  atomicWriteFile,
  fetchProvidersFromGateways,
  generateTypesContent,
  writeRegistryFiles,
} from './registry-generator.js';

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

    it('writes reasoning options next to the other capability data', async () => {
      const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'mastra-capabilities-'));
      tempDirs.push(dir);
      const reasoning = { 'gpt-5.5': [{ type: 'effort' as const, values: ['low', 'high'] }] };

      await writeRegistryFiles(
        path.join(dir, 'provider-registry.json'),
        path.join(dir, 'provider-types.generated.d.ts'),
        {},
        {},
        { openai: ['gpt-5.5'] },
        undefined,
        undefined,
        { openai: reasoning, groq: { 'qwen3-32b': [{ type: 'toggle' }] } },
      );

      const openai = JSON.parse(await fs.readFile(path.join(dir, 'capabilities', 'openai.json'), 'utf8'));
      const groq = JSON.parse(await fs.readFile(path.join(dir, 'capabilities', 'groq.json'), 'utf8'));
      expect(openai).toEqual({ attachment: ['gpt-5.5'], reasoning });
      expect(groq).toEqual({ reasoning: { 'qwen3-32b': [{ type: 'toggle' }] } });
    });
  });

  describe('registry JSON model lists', () => {
    // The registry used to store every provider's model list twice: under providers[id].models and
    // in a top-level `models` map. Readers now derive the map from providers, so the file must still
    // carry exactly the lists the map held, for every provider, including gateway-prefixed ones.
    async function generateRegistry(options?: { includeModelsKey?: boolean }) {
      vi.spyOn(ModelsDevGateway.prototype, 'fetchProviders').mockResolvedValue({
        openai: { name: 'OpenAI', models: ['gpt-5', 'gpt-4o', 'gpt-4.1'], gateway: 'models.dev' },
        anthropic: { name: 'Anthropic', models: ['claude-sonnet-4-5', 'claude-opus-4-1'], gateway: 'models.dev' },
      });
      vi.spyOn(NetlifyGateway.prototype, 'fetchProviders').mockResolvedValue({
        anthropic: { name: 'Anthropic', models: ['claude-sonnet-4-5', 'claude-haiku-4-5'], gateway: 'netlify' },
      });

      const generated = await fetchProvidersFromGateways([new ModelsDevGateway({}), new NetlifyGateway()]);
      vi.restoreAllMocks();

      const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'mastra-registry-models-'));
      tempDirs.push(dir);
      const jsonPath = path.join(dir, 'provider-registry.json');
      await writeRegistryFiles(
        jsonPath,
        path.join(dir, 'provider-types.generated.d.ts'),
        generated.providers,
        generated.models,
        undefined,
        undefined,
        undefined,
        undefined,
        options,
      );

      return { generated, written: JSON.parse(await fs.readFile(jsonPath, 'utf8')) };
    }

    it('stores each model list once, under its provider, with the lists the top-level map used to hold', async () => {
      const { generated, written } = await generateRegistry();

      expect(Object.keys(written)).toEqual(['providers', 'version']);
      expect(Object.keys(written.providers)).toEqual(Object.keys(generated.models));
      for (const [providerId, models] of Object.entries(generated.models)) {
        expect(written.providers[providerId].models).toEqual(models);
      }
      expect(written.providers['netlify/anthropic'].models).toEqual(['claude-haiku-4-5', 'claude-sonnet-4-5']);
      expect(written.providers.openai.models).toEqual(['gpt-4.1', 'gpt-4o', 'gpt-5']);
    });

    it('keeps the top-level map when asked, for registry files that older versions read', async () => {
      const { generated, written } = await generateRegistry({ includeModelsKey: true });

      expect(Object.keys(written)).toEqual(['providers', 'models', 'version']);
      expect(written.models).toEqual(generated.models);
    });
  });
});
