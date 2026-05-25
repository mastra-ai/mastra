import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildTemporalActivitiesModule, collectTemporalActivityBindings } from './activities';

function stripInlineSourceMap(code: string): string {
  return code.replace(/\n\/\/# sourceMappingURL=data:application\/json[^\n]*\n?$/, '');
}

async function transform(source: string): Promise<string> {
  const directory = await mkdtemp(path.join(tmpdir(), 'temporal-activities-transform-'));
  const inputPath = path.join(directory, 'activities.mjs');
  await writeFile(inputPath, source);

  const { outputPath } = await buildTemporalActivitiesModule(inputPath, directory, 'activities.mjs');
  return stripInlineSourceMap(await readFile(outputPath, 'utf-8'));
}

describe('activity transform', () => {
  it.each(['weather-workflow'])('matches fixture output for %s', async fixtureName => {
    const inputPath = fileURLToPath(new URL(`./__fixtures__/activities/${fixtureName}/input.mjs`, import.meta.url));
    const outputPath = fileURLToPath(new URL(`./__fixtures__/activities/${fixtureName}/output.js`, import.meta.url));
    const expected = await readFile(outputPath, 'utf-8');
    const directory = await mkdtemp(path.join(tmpdir(), 'temporal-activities-fixture-'));

    const { outputPath: resultPath } = await buildTemporalActivitiesModule(inputPath, directory, 'activities.mjs');
    const output = stripInlineSourceMap(await readFile(resultPath, 'utf-8'));

    expect(output).toBe(expected);
  });

  it('collects hoisted and inline activity bindings by export name and step id', () => {
    const bindings = collectTemporalActivityBindings(
      `
        import { createStep, createWorkflow } from '@mastra/core/workflows';

        const fetchWeather = createStep({ id: 'fetch-weather', execute: async () => ({}) });
        export const weatherWorkflow = createWorkflow({ id: 'weather-workflow' }).then(fetchWeather).then(
          createStep({ id: 'save-activities', execute: async () => ({}) }),
        );
      `,
      '/virtual/weather-workflow.mjs',
    );

    expect(bindings).toEqual([
      { exportName: 'fetchWeather', stepId: 'fetch-weather' },
      { exportName: 'saveActivities', stepId: 'save-activities' },
    ]);
  });

  it('uses a local mastra binding in the injected helper', async () => {
    const output = await transform(`
      import { createStep } from '@mastra/core/workflows';

      const mastra = { getAgent() { return null; } };
      export const fetchWeather = createStep({ id: 'fetch-weather', execute: async () => ({ ok: true }) });
    `);

    expect(output).toMatch(/args\.execute\(\{[\s\S]*\.\.\.params,[\s\S]*mastra[\s\S]*\}\)/);
    expect(output).not.toMatch(/await import\(/);
    expect(output).toContain('const fetchWeather = createStep({');
  });

  it('keeps supporting declarations needed by extracted activities while stripping workflow setup', async () => {
    const output = await transform(`
      import { z } from 'zod';
      import { createStep, createWorkflow } from '@mastra/core/workflows';
      import { init } from '@mastra/temporal';

      const mastra = { getAgent() { return null; } };
      const schema = z.object({ city: z.string() });
      function formatCity(city) {
        return city.toUpperCase();
      }

      const { createWorkflow: fromInit } = init({});
      export const fetchWeather = createStep({
        id: 'fetch-weather',
        inputSchema: schema,
        execute: async ({ inputData }) => ({ city: formatCity(inputData.city) }),
      });
      export const weatherWorkflow = createWorkflow({ id: 'weather-workflow' }).then(fetchWeather);
    `);

    expect(output).toMatch(/import\s*\{\s*z\s*\}\s*from\s*["']zod["']/);
    expect(output).toContain('const schema = z.object');
    expect(output).toContain('function formatCity(city)');
    expect(output).toContain('const fetchWeather = createStep({');
    expect(output).not.toContain('@mastra/temporal');
    expect(output).not.toContain('createWorkflow({ id: "weather-workflow" })');
  });

  it('removes workflow exports and other references from generated activities modules', async () => {
    const output = await transform(`
      import { createStep, createWorkflow } from '@mastra/core/workflows';

      const mastra = { getAgent() { return null; } };
      const fetchWeather = createStep({ id: 'fetch-weather', execute: async () => ({ ok: true }) });
      const weatherWorkflow = createWorkflow({ id: 'weather-workflow' }).then(fetchWeather);

      export { fetchWeather, weatherWorkflow };
    `);

    expect(output).toContain('const fetchWeather = createStep({');
    expect(output).toMatch(/export\s*(const\s+fetchWeather\s*=|\{[\s\S]*fetchWeather[\s\S]*\})/);
    expect(output).not.toContain('weatherWorkflow');
    expect(output).not.toContain('createWorkflow');
  });

  it('keeps a local mastra binding without exporting it', async () => {
    const output = await transform(`
      import { createStep } from '@mastra/core/workflows';

      export const mastra = { getAgent() { return null; } };
      export const fetchWeather = createStep({ id: 'fetch-weather', execute: async () => ({ ok: true }) });
    `);

    expect(output).toContain('const mastra =');
    expect(output).not.toMatch(/export\s+(const|\{)\s*mastra/);
    expect(output).toMatch(/args\.execute\(\{[\s\S]*\.\.\.params,[\s\S]*mastra[\s\S]*\}\)/);
  });
});
