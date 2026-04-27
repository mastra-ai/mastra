import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildTemporalActivitiesModule, collectTemporalActivityBindings } from './activities';

describe('activity transform', () => {
  it.each(['weather-workflow'])('matches fixture output for %s', async fixtureName => {
    const inputPath = fileURLToPath(new URL(`./__fixtures__/activities/${fixtureName}/input.ts`, import.meta.url));
    const outputPath = fileURLToPath(new URL(`./__fixtures__/activities/${fixtureName}/output.js`, import.meta.url));
    const entryPath = fileURLToPath(new URL('./__fixtures__/activities/index.ts', import.meta.url));
    const source = await readFile(inputPath, 'utf-8');
    const expected = await readFile(outputPath, 'utf-8');

    const output = await buildTemporalActivitiesModule(source, inputPath, { entryFilePath: entryPath });

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
      '/virtual/weather-workflow.ts',
    );

    expect(bindings).toEqual([
      { exportName: 'fetchWeather', stepId: 'fetch-weather' },
      { exportName: 'saveActivities', stepId: 'save-activities' },
    ]);
  });

  it('uses the configured entry file path in the injected helper', async () => {
    const output = await buildTemporalActivitiesModule(
      `
        import { createStep } from '@mastra/core/workflows';

        export const fetchWeather = createStep({ id: 'fetch-weather', execute: async () => ({ ok: true }) });
      `,
      '/virtual/workflows/weather-workflow.ts',
      { entryFilePath: '/virtual/index.ts' },
    );

    expect(output).toMatch(/const\s*\{\s*mastra\s*\}\s*=\s*await import\(["']\.\.\/index["']\)/);
    expect(output).toContain('const fetchWeather = createStep({');
  });

  it('keeps supporting declarations needed by extracted activities while stripping workflow setup', async () => {
    const output = await buildTemporalActivitiesModule(
      `
        import { z } from 'zod';
        import { createStep, createWorkflow } from '@mastra/core/workflows';
        import { init } from '@mastra/temporal';

        const schema = z.object({ city: z.string() });
        function formatCity(city: string) {
          return city.toUpperCase();
        }

        const { createWorkflow: fromInit } = init({});
        export const fetchWeather = createStep({
          id: 'fetch-weather',
          inputSchema: schema,
          execute: async ({ inputData }) => ({ city: formatCity(inputData.city) }),
        });
        export const weatherWorkflow = createWorkflow({ id: 'weather-workflow' }).then(fetchWeather);
      `,
      '/virtual/weather-workflow.ts',
    );

    expect(output).toMatch(/import\s*\{\s*z\s*\}\s*from\s*["']zod["']/);
    expect(output).toContain('const schema = z.object');
    expect(output).toContain('function formatCity(city)');
    expect(output).toContain('const fetchWeather = createStep({');
    expect(output).not.toContain('@mastra/temporal');
    expect(output).not.toContain('createWorkflow({ id: "weather-workflow" })');
  });
});
