import { mkdtemp, readFile, readdir, rm, writeFile, mkdir } from 'node:fs/promises';
import Module from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import * as React from 'react';
import * as jsxRuntime from 'react/jsx-runtime';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ToolUIRegistry } from '../plugins/extract-tool-ui';
import { buildToolUI, STUDIO_SHARED_MODULES_GLOBAL } from './build-tool-ui';

const fixturesDir = join(import.meta.dirname, '__fixtures__');
const importer = join(fixturesDir, 'tool.ts');
const projectRoot = join(import.meta.dirname, '..', '..', '..');

// Node's private hook to re-read NODE_PATH, which Vitest sets and which would otherwise let any directory resolve react.
const reloadGlobalPaths = () => (Module as unknown as { _initPaths: () => void })._initPaths();

async function readOutput(dir: string) {
  const files = await readdir(dir, { recursive: true });
  const contents = await Promise.all(
    files.filter(file => file.endsWith('.js')).map(file => readFile(join(dir, file), 'utf-8')),
  );
  return contents.join('\n');
}

describe('buildToolUI', () => {
  let outDir: string;

  beforeEach(async () => {
    outDir = await mkdtemp(join(tmpdir(), 'mastra-tool-ui-'));
  });

  afterEach(async () => {
    await rm(outDir, { recursive: true, force: true });
    delete (globalThis as Record<string, unknown>)[STUDIO_SHARED_MODULES_GLOBAL];
  });

  describe('when components are registered', () => {
    const registry: ToolUIRegistry = new Map([
      ['aaaaaaaaaaaaaaaa', { id: 'aaaaaaaaaaaaaaaa', importer, source: './weather-card', exportName: 'WeatherCard' }],
      ['bbbbbbbbbbbbbbbb', { id: 'bbbbbbbbbbbbbbbb', importer, source: './weather-card', exportName: 'default' }],
    ]);

    it('emits one ESM file per component id', async () => {
      await buildToolUI({ registry, outDir, projectRoot });

      const files = await readdir(outDir);
      expect(files).toEqual(expect.arrayContaining(['aaaaaaaaaaaaaaaa.js', 'bbbbbbbbbbbbbbbb.js']));
    });

    it('reads React from the Studio shared modules instead of bundling it', async () => {
      await buildToolUI({ registry, outDir, projectRoot });

      const code = await readOutput(outDir);
      expect(code).toContain(STUDIO_SHARED_MODULES_GLOBAL);
      expect(code).not.toContain('react.production');
      expect(code).not.toContain('react.development');
    });

    it('exposes the component as the default export, rendered with the shared React', async () => {
      await buildToolUI({ registry, outDir, projectRoot });
      (globalThis as Record<string, unknown>)[STUDIO_SHARED_MODULES_GLOBAL] = {
        react: React,
        'react/jsx-runtime': jsxRuntime,
      };

      const named = await import(pathToFileURL(join(outDir, 'aaaaaaaaaaaaaaaa.js')).href);
      const fallback = await import(pathToFileURL(join(outDir, 'bbbbbbbbbbbbbbbb.js')).href);

      expect(renderToStaticMarkup(React.createElement(named.default, { output: { temperature: 21 } }))).toBe(
        '<div data-testid="weather-card">21°C</div>',
      );
      expect(renderToStaticMarkup(React.createElement(fallback.default))).toBe('<span>default</span>');
    });

    it('removes files from previous builds', async () => {
      await writeFile(join(outDir, 'stale.js'), '');

      await buildToolUI({ registry, outDir, projectRoot });

      expect(await readdir(outDir)).not.toContain('stale.js');
    });
  });

  describe('when no components are registered', () => {
    it('clears the output directory', async () => {
      await mkdir(outDir, { recursive: true });
      await writeFile(join(outDir, 'stale.js'), '');

      await buildToolUI({ registry: new Map(), outDir, projectRoot });

      await expect(readdir(outDir)).rejects.toThrow();
    });
  });

  describe('when a component uses @mastra/react hooks', () => {
    const registry: ToolUIRegistry = new Map([
      ['cccccccccccccccc', { id: 'cccccccccccccccc', importer, source: './agent-name', exportName: 'AgentName' }],
    ]);

    it('reads @mastra/react and React Query from the Studio shared modules instead of bundling them', async () => {
      await buildToolUI({ registry, outDir, projectRoot });

      const code = await readOutput(outDir);
      expect(code).toContain('"@mastra/react/hooks/agents"');
      expect(code).toContain('"@tanstack/react-query"');
      expect(code).not.toContain('QueryClientProvider');
    });

    it('renders with the hooks Studio provides', async () => {
      await buildToolUI({ registry, outDir, projectRoot });
      (globalThis as Record<string, unknown>)[STUDIO_SHARED_MODULES_GLOBAL] = {
        react: React,
        'react/jsx-runtime': jsxRuntime,
        '@mastra/react/hooks/agents': { useAgent: () => ({ data: { name: 'Weather Agent' } }) },
        '@tanstack/react-query': { useQueryClient: () => ({}) },
      };

      const mod = await import(pathToFileURL(join(outDir, 'cccccccccccccccc.js')).href);

      expect(renderToStaticMarkup(React.createElement(mod.default, { agentId: 'weather' }))).toBe(
        '<p data-shared-client="true">Weather Agent</p>',
      );
    });
  });

  describe('when react is not installed in the project', () => {
    beforeEach(() => {
      vi.stubEnv('NODE_PATH', '');
      reloadGlobalPaths();
    });

    afterEach(() => {
      vi.unstubAllEnvs();
      reloadGlobalPaths();
    });

    it('still builds, since Studio provides React at runtime', async () => {
      const registry: ToolUIRegistry = new Map([
        ['aaaaaaaaaaaaaaaa', { id: 'aaaaaaaaaaaaaaaa', importer, source: './weather-card', exportName: 'WeatherCard' }],
      ]);

      await buildToolUI({ registry, outDir, projectRoot: tmpdir() });

      expect(await readdir(outDir)).toContain('aaaaaaaaaaaaaaaa.js');
    });
  });
});
