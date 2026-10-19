import { rollup } from 'rollup';
import { describe, it, expect } from 'vitest';
import { getToolUIComponentId } from '../babel/extract-tool-ui';
import { extractToolUI } from './extract-tool-ui';
import type { ToolUIRegistry } from './extract-tool-ui';

const TOOL_FILE = '/project/src/mastra/tools/weather.js';

async function bundleTool(code: string) {
  const registry: ToolUIRegistry = new Map();
  const warnings: string[] = [];
  const resolved: string[] = [];

  const bundle = await rollup({
    logLevel: 'silent',
    input: TOOL_FILE,
    treeshake: false,
    plugins: [
      {
        name: 'virtual-tool',
        resolveId(id) {
          if (id === TOOL_FILE) return id;
          resolved.push(id);
          return { id, external: true };
        },
        load(id) {
          if (id === TOOL_FILE) return code;
        },
      },
      extractToolUI({ registry, onWarning: message => warnings.push(message) }),
    ],
  });

  const { output } = await bundle.generate({ format: 'esm' });
  return { code: output[0].code, registry, warnings, resolved };
}

describe('extractToolUI', () => {
  describe('when the component is a named import', () => {
    it('replaces the component with its id and drops the import', async () => {
      const result = await bundleTool(`
        import { createTool } from '@mastra/core/tools';
        import { WeatherCard } from './weather-card';
        export const weatherTool = createTool({ id: 'weather', ui: { studioComponent: WeatherCard } });
      `);

      const id = getToolUIComponentId(TOOL_FILE, './weather-card', 'WeatherCard');
      expect(result.code).toContain(`studioComponent: "${id}"`);
      expect(result.resolved).not.toContain('./weather-card');
      expect([...result.registry.values()]).toEqual([
        { id, importer: TOOL_FILE, source: './weather-card', exportName: 'WeatherCard' },
      ]);
    });
  });

  describe('when the component is a default import', () => {
    it('records the default export', async () => {
      const result = await bundleTool(`
        import WeatherCard from './weather-card';
        export const ui = { ui: { studioComponent: WeatherCard } };
      `);

      expect([...result.registry.values()][0]?.exportName).toBe('default');
      expect(result.resolved).not.toContain('./weather-card');
    });
  });

  describe('when the component is an aliased import', () => {
    it('records the original export name', async () => {
      const result = await bundleTool(`
        import { WeatherCard as Card } from './weather-card';
        export const tool = { ui: { studioComponent: Card } };
      `);

      expect([...result.registry.values()][0]?.exportName).toBe('WeatherCard');
      expect(result.resolved).not.toContain('./weather-card');
    });
  });

  describe('when other specifiers share the import declaration', () => {
    it('keeps the remaining specifiers', async () => {
      const result = await bundleTool(`
        import { WeatherCard, formatTemp } from './weather-card';
        export const tool = { ui: { studioComponent: WeatherCard }, format: formatTemp };
      `);

      expect(result.code).toContain('formatTemp');
      expect(result.code).not.toMatch(/import\s*\{[^}]*WeatherCard/);
    });
  });

  describe('when the component is still referenced elsewhere', () => {
    it('keeps the import', async () => {
      const result = await bundleTool(`
        import { WeatherCard } from './weather-card';
        export const tool = { ui: { studioComponent: WeatherCard } };
        export { WeatherCard };
      `);

      expect(result.resolved).toContain('./weather-card');
      expect(result.registry.size).toBe(1);
    });
  });

  describe('when the component is declared in the same file', () => {
    it('leaves it untouched and warns', async () => {
      const result = await bundleTool(`
        const WeatherCard = () => null;
        export const tool = { ui: { studioComponent: WeatherCard } };
      `);

      expect(result.code).toContain('studioComponent: WeatherCard');
      expect(result.registry.size).toBe(0);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]).toContain(TOOL_FILE);
    });
  });

  describe('when studioComponent is not inside a ui object', () => {
    it('leaves the module untouched', async () => {
      const result = await bundleTool(`
        import { WeatherCard } from './weather-card';
        export const config = { studioComponent: WeatherCard };
      `);

      expect(result.resolved).toContain('./weather-card');
      expect(result.registry.size).toBe(0);
      expect(result.warnings).toHaveLength(0);
    });
  });
});
