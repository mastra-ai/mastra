import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import * as MastraReact from '@mastra/react';
import * as MastraReactAgents from '@mastra/react/hooks/agents';
import * as ReactQuery from '@tanstack/react-query';
import * as React from 'react';
import * as jsxRuntime from 'react/jsx-runtime';
import * as ReactDOM from 'react-dom';
import * as ReactDOMClient from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { exposeStudioSharedModules, toolStudioComponentUrl } from './tool-studio-components';

describe('toolStudioComponentUrl', () => {
  afterEach(() => {
    window.MASTRA_STUDIO_BASE_PATH = undefined;
  });

  describe('when Studio is served at the root', () => {
    it('points at the tool UI bundle next to Studio', () => {
      expect(toolStudioComponentUrl('0123456789abcdef')).toBe(`${window.location.origin}/tool-ui/0123456789abcdef.js`);
    });
  });

  describe('when Studio is served under a base path', () => {
    it('points at the tool UI bundle under the base path', () => {
      window.MASTRA_STUDIO_BASE_PATH = '/studio';

      expect(toolStudioComponentUrl('0123456789abcdef')).toBe(
        `${window.location.origin}/studio/tool-ui/0123456789abcdef.js`,
      );
    });
  });
});

describe('exposeStudioSharedModules', () => {
  afterEach(() => {
    globalThis.__MASTRA_STUDIO_SHARED_MODULES__ = undefined;
  });

  describe('when Studio boots', () => {
    it('shares its React instance with tool UI bundles', () => {
      exposeStudioSharedModules();

      expect(globalThis.__MASTRA_STUDIO_SHARED_MODULES__).toMatchObject({
        react: React,
        'react/jsx-runtime': jsxRuntime,
        'react-dom': ReactDOM,
        'react-dom/client': ReactDOMClient,
      });
    });

    it('shares its Mastra client and query cache so tool components can use @mastra/react hooks', () => {
      exposeStudioSharedModules();

      expect(globalThis.__MASTRA_STUDIO_SHARED_MODULES__).toMatchObject({
        '@mastra/react': MastraReact,
        '@mastra/react/hooks/agents': MastraReactAgents,
        '@tanstack/react-query': ReactQuery,
      });
    });

    it('shares every public @mastra/react hooks entry point', () => {
      exposeStudioSharedModules();

      const hooksDir = join(import.meta.dirname, '../../../../client-sdks/react/src/hooks');
      const entryPoints = readdirSync(hooksDir, { withFileTypes: true })
        .filter(entry => entry.isDirectory() && entry.name !== 'shared' && entry.name !== '__tests__')
        .map(entry => `@mastra/react/hooks/${entry.name}`);

      expect(Object.keys(globalThis.__MASTRA_STUDIO_SHARED_MODULES__ ?? {})).toEqual(
        expect.arrayContaining(entryPoints),
      );
    });
  });
});
