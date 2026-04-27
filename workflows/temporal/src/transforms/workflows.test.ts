import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildTemporalWorkflowModule, buildWorkflowEntryModuleFromRegistry } from './workflows';

async function transform(source: string): Promise<string> {
  return (await buildTemporalWorkflowModule(source, '/virtual/weather-workflow.ts')).code;
}

describe('workflow transform', () => {
  it.each(['weather-workflow'])('matches fixture output for %s', async fixtureName => {
    const inputPath = fileURLToPath(new URL(`./__fixtures__/workflow/${fixtureName}/input.ts`, import.meta.url));
    const outputPath = fileURLToPath(new URL(`./__fixtures__/workflow/${fixtureName}/output.js`, import.meta.url));
    const source = await readFile(inputPath, 'utf-8');
    const expected = await readFile(outputPath, 'utf-8');

    const result = await buildTemporalWorkflowModule(source, inputPath);

    expect(result.code).toBe(expected);
    expect(result.workflows).toEqual([{ exportName: 'weatherWorkflow', workflowId: 'weather-workflow' }]);
  });

  it('exports workflows using the normalized workflow id name', async () => {
    const result = await buildTemporalWorkflowModule(
      `
        import { createWorkflow } from '@mastra/core/workflows';

        export const customName = createWorkflow({ id: 'weather-forecast' }).then('fetch-weather');
      `,
      '/virtual/weather-workflow.ts',
    );

    expect(result.workflows).toEqual([
      {
        exportName: 'weatherForecastWorkflow',
        workflowId: 'weather-forecast',
      },
    ]);
    expect(result.code).toMatch(/export\s*(const\s+weatherForecastWorkflow\s*=|\{\s*weatherForecastWorkflow\s*\})/);
    expect(result.code).toContain('createWorkflow("weather-forecast")');
    expect(result.code).not.toContain('const customName =');
  });

  it('injects the helper runtime from the dedicated module into transformed output', async () => {
    const output = await transform(`
      import { createWorkflow } from '@mastra/core/workflows';

      export const weatherWorkflow = createWorkflow({ id: 'weather-workflow' }).then('fetch-weather');
    `);

    expect(output).toContain('@temporalio/workflow');
    expect(output).toContain('proxyActivities');
    expect(output).toContain('log');
    expect(output).toContain('sleep');
    expect(output).toContain('class TemporalExecutionEngine');
    expect(output).toContain('function createWorkflow(workflowId)');
  });

  it('rewrites entry exports from the workflow registry', async () => {
    const fixturePath = fileURLToPath(new URL('../__tests__/__fixtures__/before/index.ts', import.meta.url));
    const workflowPath = fileURLToPath(
      new URL('../__tests__/__fixtures__/before/weather-workflow.ts', import.meta.url),
    );
    const source = await readFile(fixturePath, 'utf-8');

    const output = await buildWorkflowEntryModuleFromRegistry(
      source,
      fixturePath,
      new Map([[workflowPath, ['weatherWorkflow']]]),
    );

    expect(output).toMatch(/export\s*\{\s*weatherWorkflow\s*\}\s*from\s*['"]\.\/weather-workflow['"]/);
    expect(output).not.toContain('Mastra');
  });
});
