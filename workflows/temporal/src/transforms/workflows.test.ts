import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildTemporalWorkflowModule } from './workflows';

function stripInlineSourceMap(code: string): string {
  return code.replace(/\n\/\/# sourceMappingURL=data:application\/json[^\n]*\n?$/, '');
}

async function transform(source: string): Promise<string> {
  const directory = await mkdtemp(path.join(tmpdir(), 'temporal-workflow-transform-'));
  const inputPath = path.join(directory, 'weather-workflow.mjs');
  await writeFile(inputPath, source);

  const { outputPath } = await buildTemporalWorkflowModule(inputPath, directory, 'workflow.mjs');
  return stripInlineSourceMap(await readFile(outputPath, 'utf-8'));
}

describe('workflow transform', () => {
  it.each(['weather-workflow'])('matches fixture output for %s', async fixtureName => {
    const inputPath = fileURLToPath(new URL(`./__fixtures__/workflow/${fixtureName}/input.mjs`, import.meta.url));
    const outputPath = fileURLToPath(new URL(`./__fixtures__/workflow/${fixtureName}/output.js`, import.meta.url));
    const expected = await readFile(outputPath, 'utf-8');
    const directory = await mkdtemp(path.join(tmpdir(), 'temporal-workflow-fixture-'));

    const { outputPath: resultPath } = await buildTemporalWorkflowModule(inputPath, directory, 'workflow.mjs');
    const result = stripInlineSourceMap(await readFile(resultPath, 'utf-8'));

    expect(result).toBe(expected);
    expect(result).toContain('export { weatherWorkflow };');
    expect(result).toContain("createWorkflow('weather-workflow')");
  });

  it('exports workflows using the normalized workflow id name', async () => {
    const result = await transform(`
      import { createWorkflow } from '@mastra/core/workflows';

      export const customName = createWorkflow({ id: 'weather-forecast' }).then('fetch-weather');
    `);

    expect(result).toMatch(/export\s*(const\s+weatherForecastWorkflow\s*=|\{\s*weatherForecastWorkflow\s*\})/);
    expect(result).toContain("createWorkflow('weather-forecast')");
    expect(result).not.toContain('const customName =');
  });

  it('rewrites named workflow exports to reference normalized bindings', async () => {
    const result = await transform(`
      import { createWorkflow } from '@mastra/core/workflows';

      const customName = createWorkflow({ id: 'weather-forecast' }).then('fetch-weather');
      export { customName as defaultWorkflow };
      export default customName;
    `);

    expect(result).toContain('const weatherForecastWorkflow =');
    expect(result).toContain('weatherForecastWorkflow as default');
    expect(result).toContain('weatherForecastWorkflow as defaultWorkflow');
    expect(result).not.toContain('export { customName as defaultWorkflow };');
    expect(result).not.toContain('export default customName;');
  });

  it('rewrites nested workflow references as child workflow calls', async () => {
    const result = await transform(`
      import { createStep, createWorkflow } from '@mastra/core/workflows';

      const fetchWeather = createStep({ id: 'fetch-weather', execute: async () => ({}) });
      const subWorkflow = createWorkflow({ id: 'fetch-weather' }).then(fetchWeather);
      export const weatherWorkflow = createWorkflow({ id: 'weather-workflow' }).then(subWorkflow);
    `);

    expect(result).toContain('const fetchWeatherWorkflow =');
    expect(result).toContain('const weatherWorkflow =');
    expect(result).toContain('.thenWorkflow("fetchWeatherWorkflow")');
    expect(result).not.toContain('.then("subWorkflow")');
  });

  it('injects the helper runtime from the dedicated module into transformed output', async () => {
    const output = await transform(`
      import { createWorkflow } from '@mastra/core/workflows';

      export const weatherWorkflow = createWorkflow({ id: 'weather-workflow' }).then('fetch-weather');
    `);

    expect(output).toContain('@temporalio/workflow');
    expect(output).toContain('executeChild');
    expect(output).toContain('proxyActivities');
    expect(output).toContain('log');
    expect(output).toContain('sleep');
    expect(output).toContain('class TemporalExecutionEngine');
    expect(output).toContain('function createWorkflow(workflowId)');
  });
});
