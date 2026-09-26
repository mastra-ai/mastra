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

  it('preserves child workflows passed directly to parallel', async () => {
    const result = await transform(`
      import { createStep, createWorkflow } from '@mastra/core/workflows';

      const childStep = createStep({ id: 'child-step', execute: async () => ({}) });
      const child = createWorkflow({ id: 'child' }).then(childStep).commit();
      export const parent = createWorkflow({ id: 'parent' }).parallel([child]).commit();
    `);

    expect(result).toContain('type: "childWorkflow"');
    expect(result).toContain('workflowType: "childWorkflow"');
    expect(result).not.toContain('.parallel(["child"])');
  });

  it('resolves steps returned by factory functions', async () => {
    const result = await transform(`
      import { createStep, createWorkflow } from '@mastra/core/workflows';

      function createPlanActivities() {
        return createStep({ id: 'plan-activities', execute: async () => ({}) });
      }

      const planActivities = createPlanActivities();
      export const weatherWorkflow = createWorkflow({ id: 'weather-workflow' })
        .then(planActivities)
        .then(createPlanActivities());
    `);

    expect(result).toContain('.then("plan-activities").then("plan-activities")');
    expect(result).not.toContain('.then("planActivities")');
    expect(result).not.toContain('.then("createPlanActivities")');
  });

  it('recognizes aliased workflow and step factories from bundled Temporal helpers', async () => {
    const result = await transform(`
      const { createWorkflow: createWorkflow$1, createStep: createStep$1 } = init({});
      const readResource = createStep$1({ id: 'read-resource', execute: async () => ({}) });
      export const mappedWorkflow = createWorkflow$1({ id: 'mapped-workflow' }).then(readResource);
    `);

    expect(result).toContain('const mappedWorkflow =');
    expect(result).toContain('.then("read-resource")');
    expect(result).not.toContain('createWorkflow$1');
    expect(result).not.toContain('createStep$1');
  });

  it('rewrites callback mappings as generated activity steps', async () => {
    const result = await transform(`
      import { createWorkflow } from '@mastra/core/workflows';
      import { z } from 'zod';

      export const mappedWorkflow = createWorkflow({
        id: 'mapped-workflow',
        inputSchema: z.object({ value: z.number() }),
        outputSchema: z.object({ doubled: z.number() }),
      })
        .map(({ inputData }) => ({ doubled: inputData.value * 2 }))
        .commit();
    `);

    expect(result).toContain('.map("mapping_mapped-workflow_0")');
  });

  it('keeps mapping order and assigns stable ordinal ids', async () => {
    const result = await transform(`
      import { createWorkflow } from '@mastra/core/workflows';

      const mapValue = ({ inputData }) => ({ value: inputData.value + 1 });
      export const mappedWorkflow = createWorkflow({ id: 'mapped-workflow' })
        .then('before')
        .map(mapValue)
        .then('between')
        .map(async ({ inputData }) => ({ value: inputData.value * 2 }))
        .then('after')
        .commit();
    `);

    expect(result).toContain(
      '.then("before").map("mapping_mapped-workflow_0").then("between").map("mapping_mapped-workflow_1").then("after").commit()',
    );
  });

  it('rejects unsupported mapping forms with actionable errors', async () => {
    await expect(
      transform(`
        import { createWorkflow } from '@mastra/core/workflows';
        export const mappedWorkflow = createWorkflow({ id: 'mapped-workflow' })
          .map({ value: { path: 'inputData.value' } })
          .commit();
      `),
    ).rejects.toThrow('does not yet support declarative object mappings');

    await expect(
      transform(`
        import { createWorkflow } from '@mastra/core/workflows';
        const getMapping = () => ({ inputData }) => inputData;
        export const mappedWorkflow = createWorkflow({ id: 'mapped-workflow' })
          .map(getMapping())
          .commit();
      `),
    ).rejects.toThrow('requires an inline function or a statically declared function identifier');
  });

  it('forwards mapping options while retaining the generated mapping activity id', async () => {
    const result = await transform(`
      import { createWorkflow } from '@mastra/core/workflows';
      export const mappedWorkflow = createWorkflow({ id: 'mapped-workflow' })
        .map(({ inputData }) => inputData, {
          id: 'custom-mapping',
          description: 'Custom mapping',
          metadata: { source: 'test' },
        })
        .commit();
    `);

    expect(result).toContain(
      ".map(\"mapping_mapped-workflow_0\", {\n    id: 'custom-mapping',\n    description: 'Custom mapping',\n    metadata: {\n      source: 'test'\n    }\n  })",
    );
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
    expect(output).toContain('function createWorkflow(workflowId, options)');
  });

  it('injects the configured activity timeout into transformed workflows', async () => {
    const output = await transform(`
      import { init } from '@mastra/temporal';

      const { createWorkflow } = init({
        client: undefined,
        taskQueue: 'mastra',
        startToCloseTimeout: '5 minutes',
      });

      export const weatherWorkflow = createWorkflow({ id: 'weather-workflow' }).then('fetch-weather');
    `);

    expect(output).toMatch(/createWorkflow\('weather-workflow',\s*\{\s*startToCloseTimeout: '5 minutes'\s*\}\)/);
  });
});
