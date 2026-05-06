import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BuildBundler } from './mastra-deployer';
import { MastraPlugin } from './plugin';
import { buildTemporalActivitiesModule } from './transforms/activities';
import { buildTemporalWorkflowModule } from './transforms/workflows';

function stripInlineSourceMap(code: string): string {
  return code.replace(/\n\/\/# sourceMappingURL=data:application\/json[^\n]*\n?$/, '');
}

async function transform(source: string): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'temporal-index-workflow-'));
  const inputPath = path.join(directory, 'weather-workflow.mjs');
  await writeFile(inputPath, source);

  const { outputPath } = await buildTemporalWorkflowModule(inputPath, directory, 'workflow.mjs');
  return stripInlineSourceMap(await readFile(outputPath, 'utf-8'));
}

async function transformActivities(source: string): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'temporal-index-activities-'));
  const inputPath = path.join(directory, 'weather-workflow.mjs');
  await writeFile(inputPath, source);

  const { outputPath } = await buildTemporalActivitiesModule(inputPath, directory, 'activities.mjs');
  return stripInlineSourceMap(await readFile(outputPath, 'utf-8'));
}

function mockCompiledBundle({
  compiledEntrySource,
  compiledWorkflowSource,
  compiledWorkflowFileName = 'mastra.mjs',
}: {
  compiledEntrySource: string;
  compiledWorkflowSource: string;
  compiledWorkflowFileName?: string;
}) {
  return vi.spyOn(BuildBundler.prototype, 'bundle').mockImplementation(async (_entryFile, outputDirectory) => {
    const outputDir = path.join(outputDirectory, 'output');
    await mkdir(outputDir, { recursive: true });
    await writeFile(path.join(outputDir, 'index.mjs'), compiledEntrySource, 'utf8');
    await writeFile(path.join(outputDir, compiledWorkflowFileName), compiledWorkflowSource, 'utf8');
  });
}

afterEach(async () => {
  vi.restoreAllMocks();
  await rm(path.resolve(process.cwd(), 'node_modules/.mastra'), { recursive: true, force: true });
});

describe('@mastra/temporal transform exports', () => {
  it('preserves export semantics for a locally declared workflow exported later', async () => {
    const output = await transform(`
      import { createWorkflow } from '@mastra/core/workflows';

      const weatherWorkflow = createWorkflow({ id: 'weather-workflow' }).then('fetchWeather');
      weatherWorkflow.commit();

      export { weatherWorkflow };
    `);

    expect(output).toMatch(/export\s*(const\s+weatherWorkflow\s*=|\{\s*weatherWorkflow\s*\})/);
    expect(output).not.toContain('weatherWorkflow.commit()');
  });

  it('preserves direct workflow exports', async () => {
    const output = await transform(`
      import { createWorkflow } from '@mastra/core/workflows';

      export const weatherWorkflow = createWorkflow({ id: 'weather-workflow' }).then('fetchWeather');
    `);

    expect(output).toMatch(/export\s*(const\s+weatherWorkflow\s*=|\{\s*weatherWorkflow\s*\})/);
    expect(output).not.toContain('weatherWorkflow.commit()');
  });

  it('removes non-workflow exports from mixed export lists', async () => {
    const output = await transform(`
      import { createWorkflow } from '@mastra/core/workflows';

      const otherValue = 42;
      const weatherWorkflow = createWorkflow({ id: 'weather-workflow' }).then('fetchWeather');
      weatherWorkflow.commit();

      export { weatherWorkflow, otherValue };
    `);

    expect(output).not.toContain('otherValue');
    expect(output).toMatch(/export\s*(const\s+weatherWorkflow\s*=|\{[\s\S]*weatherWorkflow[\s\S]*\})/);
  });

  it('preserves default workflow exports', async () => {
    const output = await transform(`
      import { createWorkflow } from '@mastra/core/workflows';

      const weatherWorkflow = createWorkflow({ id: 'weather-workflow' }).then('fetchWeather');

      export { weatherWorkflow as default };
    `);

    expect(output).toContain('const weatherWorkflow =');
    expect(output).toMatch(/export\s+(default\s+weatherWorkflow|\{[\s\S]*weatherWorkflow\s+as\s+default[\s\S]*\})/);
  });

  it('supports inline createStep calls in then', async () => {
    const output = await transform(`
      import { createStep, createWorkflow } from '@mastra/core/workflows';

      export const weatherWorkflow = createWorkflow({ id: 'weather-workflow' }).then(
        createStep({ id: 'fetch-weather', execute: async () => ({}) }),
      );
    `);

    expect(output).toContain('.then("fetch-weather")');
  });

  it('supports inline createStep calls in parallel', async () => {
    const output = await transform(`
      import { createStep, createWorkflow } from '@mastra/core/workflows';

      export const weatherWorkflow = createWorkflow({ id: 'weather-workflow' }).parallel([
        createStep({ id: 'fetch-weather', execute: async () => ({}) }),
        createStep({ id: 'plan-activities', execute: async () => ({}) }),
      ]);
    `);

    expect(output).toContain('.parallel(["fetch-weather", "plan-activities"])');
  });

  it('removes hoisted createStep declarations and their imports', async () => {
    const output = await transform(`
      import { z } from 'zod';
      import { createStep, createWorkflow } from '@mastra/core/workflows';

      const inputSchema = z.object({ city: z.string() });
      const fetchWeather = createStep({
        id: 'fetch-weather',
        inputSchema,
        execute: async () => ({}),
      });

      export const weatherWorkflow = createWorkflow({ id: 'weather-workflow' }).then(fetchWeather);
    `);

    expect(output).toContain('.then("fetch-weather")');
    expect(output).not.toContain('createStep');
    expect(output).not.toContain('fetchWeather =');
    expect(output).not.toContain("from 'zod'");
  });

  it('rewrites nested workflow references as child workflow calls', async () => {
    const workflowOutput = await transform(`
      import { createStep, createWorkflow } from '@mastra/core/workflows';

      const fetchWeather = createStep({ id: 'fetch-weather', execute: async () => ({}) });
      const subWorkflow = createWorkflow({ id: 'fetch-weather' }).then(fetchWeather);
      export const weatherWorkflow = createWorkflow({ id: 'weather-workflow' }).then(subWorkflow);
    `);
    expect(workflowOutput).toContain('const fetchWeatherWorkflow =');
    expect(workflowOutput).toContain('const weatherWorkflow =');
    expect(workflowOutput).toContain('.thenWorkflow("fetchWeatherWorkflow")');
    expect(workflowOutput).not.toContain('.then("subWorkflow")');
  });

  it('keeps only the workflow id from createWorkflow config', async () => {
    const output = await transform(`
      import { z } from 'zod';
      import { createWorkflow } from '@mastra/core/workflows';

      export const weatherWorkflow = createWorkflow({
        id: 'weather-workflow',
        inputSchema: z.object({ city: z.string() }),
        outputSchema: z.object({ activities: z.string() }),
      }).then('fetch-weather');
    `);

    expect(output).toContain("createWorkflow('weather-workflow')");
    expect(output).not.toContain('inputSchema');
    expect(output).not.toContain('outputSchema');
    expect(output).not.toContain("from 'zod'");
  });
});

describe('@mastra/temporal activities module transform', () => {
  it('extracts hoisted createStep declarations as named exports', async () => {
    const output = await transformActivities(`
      import { createStep } from '@mastra/core/workflows';

      const fetchWeather = createStep({
        id: 'fetch-weather',
        execute: async () => ({ ok: true }),
      });
    `);

    expect(output).toContain('function createStep(args)');
    expect(output).toContain('const fetchWeather = createStep({');
    expect(output).toMatch(/export\s*(const\s+fetchWeather\s*=|\{\s*fetchWeather\s*\})/);
  });

  it('extracts inline createStep calls from workflow chains and strips the workflow', async () => {
    const output = await transformActivities(`
      import { createStep, createWorkflow } from '@mastra/core/workflows';

      export const weatherWorkflow = createWorkflow({ id: 'weather-workflow' })
        .then(createStep({ id: 'save-activities', execute: async () => ({}) }));

      weatherWorkflow.commit();
    `);

    expect(output).toContain('const saveActivities = createStep({');
    expect(output).toMatch(/export\s*(const\s+saveActivities\s*=|\{\s*saveActivities\s*\})/);
    expect(output).not.toContain('weatherWorkflow');
    expect(output).not.toContain('.commit()');
  });

  it('strips temporal helper imports and workflow destructures', async () => {
    const output = await transformActivities(`
      import { Client, Connection } from '@temporalio/client';
      import { loadClientConnectConfig } from '@temporalio/envconfig';
      import { init } from '@mastra/temporal';

      const config = loadClientConnectConfig();
      const connection = await Connection.connect(config);
      const client = new Client({ connection });
      const { createWorkflow, createStep } = init({ client, taskQueue: 'mastra' });

      export const fetchWeather = createStep({ id: 'fetch-weather', execute: async () => ({}) });
    `);

    expect(output).not.toContain('@temporalio/client');
    expect(output).not.toContain('@temporalio/envconfig');
    expect(output).not.toContain('loadClientConnectConfig');
    expect(output).not.toContain('const { createWorkflow, createStep }');
    expect(output).toContain('const fetchWeather = createStep({');
    expect(output).toMatch(/export\s*(const\s+fetchWeather\s*=|\{\s*fetchWeather\s*\})/);
  });

  it('keeps helper code that extracted steps depend on', async () => {
    const output = await transformActivities(`
      import { z } from 'zod';
      import { createStep } from '@mastra/core/workflows';

      const forecastSchema = z.object({ city: z.string() });

      function getWeatherCondition(city) {
        return city.toUpperCase();
      }

      export const fetchWeather = createStep({
        id: 'fetch-weather',
        inputSchema: forecastSchema,
        execute: async ({ inputData }) => ({ city: getWeatherCondition(inputData.city) }),
      });
    `);

    expect(output).toMatch(/from ['"]zod['"]/);
    expect(output).toContain('const forecastSchema = z.object');
    expect(output).toContain('function getWeatherCondition(city)');
    expect(output).toContain('inputSchema: forecastSchema');
  });

  it('uses a local createStep helper with mastra', async () => {
    const output = await transformActivities(`
      import { createStep } from '@mastra/core/workflows';

      const mastra = { getAgent() { return null; } };
      export const planActivities = createStep({ id: 'plan-activities', execute: async () => ({}) });
    `);

    expect(output).not.toMatch(/await import\(/);
    expect(output).toContain('return args.execute({');
    expect(output).toContain('mastra');
  });

  it('keeps mastra declarations that reference stripped workflow bindings', async () => {
    const output = await transformActivities(`
      import { Mastra } from '@mastra/core/mastra';
      import { createStep, createWorkflow } from '@mastra/core/workflows';

      const fetchWeather = createStep({ id: 'fetch-weather', execute: async () => ({}) });
      const weatherWorkflow = createWorkflow({ id: 'weather-workflow' }).then(fetchWeather).commit();
      const mastra = new Mastra({ workflows: { weatherWorkflow } });

      export { mastra };
    `);

    expect(output).toContain('const mastra = new Mastra({');
    expect(output).not.toContain('weatherWorkflow');
    expect(output).toContain('return args.execute({');
  });

  it('strips createStep and createWorkflow from workflow imports while preserving other imports', async () => {
    const output = await transformActivities(`
      import { createStep, createWorkflow, LegacyStep } from '@mastra/core/workflows';

      const keepLegacyStep = LegacyStep;
      export const fetchWeather = createStep({ id: 'fetch-weather', execute: async () => keepLegacyStep });
    `);

    expect(output).toContain("import { LegacyStep } from '@mastra/core/workflows'");
    expect(output).not.toContain('createWorkflow } from');
    expect(output).not.toContain('createStep,');
  });
});

describe('@mastra/temporal configureWorker activities', () => {
  it('requires prebuild output before configureWorker', () => {
    const plugin = new MastraPlugin({});

    expect(() => plugin.configureWorker({ taskQueue: 'mastra' } as any)).toThrow(
      'MastraPlugin.prebuild() must be called before use',
    );
  });

  it('compiles workflow activities and wires them into worker options by step id', async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'mastra-temporal-worker-'));
    const entryPath = path.join(tempDir, 'src', 'index.ts');
    const workflowPath = path.join(tempDir, 'src', 'workflows', 'weather-workflow.ts');

    await mkdir(path.dirname(workflowPath), { recursive: true });
    await mkdir(path.join(tempDir, 'node_modules', '@mastra', 'core'), { recursive: true });
    await writeFile(
      path.join(tempDir, 'node_modules', '@mastra', 'core', 'package.json'),
      JSON.stringify({ name: '@mastra/core', type: 'module', exports: { './workflows': './workflows.js' } }),
    );
    await writeFile(
      path.join(tempDir, 'node_modules', '@mastra', 'core', 'workflows.js'),
      'export const createStep = (args) => args; export const createWorkflow = () => ({ then: () => ({}) });',
    );

    await writeFile(
      workflowPath,
      `
        import { createStep, createWorkflow } from '@mastra/core/workflows';

        const fetchWeather = createStep({
          id: 'fetch-weather',
          execute: async ({ inputData, mastra }) => ({ inputData, marker: mastra.marker }),
        });

        export const weatherWorkflow = createWorkflow({ id: 'weather-workflow' }).then(fetchWeather);
      `,
    );

    await writeFile(
      entryPath,
      `
        import { weatherWorkflow } from './workflows/weather-workflow';

        class Mastra {
          constructor(_config) {}
        }

        export const mastra = { marker: 'ok' };
        export default new Mastra({ workflows: { weatherWorkflow } });
      `,
    );

    const compiledEntrySource = `
      const init = () => ({
        createStep: args => args,
        createWorkflow: config => ({
          then: step => ({
            step,
            commit() {},
          }),
        }),
      });

      const { createWorkflow, createStep } = init();

      const fetchWeather = createStep({
        id: 'fetch-weather',
        execute: async ({ inputData, mastra }) => ({ inputData, marker: mastra.marker }),
      });

      export const weatherWorkflow = createWorkflow({ id: 'weather-workflow' }).then(fetchWeather);
      export const mastra = { marker: 'ok' };
    `;
    const compiledWorkflowSource = 'export const unused = true;';
    const bundleSpy = mockCompiledBundle({ compiledEntrySource, compiledWorkflowSource });

    const workerPlugin = new MastraPlugin({});
    await workerPlugin.prebuild({ entryFile: entryPath });

    await expect(
      readFile(path.resolve(process.cwd(), 'node_modules/.mastra/activity-bindings.json'), 'utf8'),
    ).resolves.toContain('fetch-weather');

    const workerOptions = workerPlugin.configureWorker({ taskQueue: 'mastra' } as any);
    const fetchWeather = (workerOptions.activities as Record<string, (...args: any[]) => Promise<unknown>>)[
      'fetch-weather'
    ];

    expect(bundleSpy).toHaveBeenCalledWith(entryPath, path.resolve(process.cwd(), 'node_modules/.mastra'), {
      toolsPaths: [],
      projectRoot: process.cwd(),
    });
    expect(workerOptions.workflowsPath).toBe(path.resolve(process.cwd(), 'node_modules/.mastra/workflow.mjs'));
    expect(fetchWeather).toBeTypeOf('function');
    await expect(fetchWeather({ inputData: { city: 'SF' } })).resolves.toEqual({
      inputData: { city: 'SF' },
      marker: 'ok',
    });
    const workflowModule = await readFile(path.resolve(process.cwd(), 'node_modules/.mastra/workflow.mjs'), 'utf8');
    expect(workflowModule).toContain('weatherWorkflow');
    expect(workflowModule).not.toContain('export { mastra');
    expect(workflowModule).not.toContain('export const mastra');
    await expect(
      readFile(path.resolve(process.cwd(), 'node_modules/.mastra/activities.mjs'), 'utf8'),
    ).resolves.toContain('function createStep(args)');
    await expect(
      readFile(path.resolve(process.cwd(), 'node_modules/.mastra/activities.mjs'), 'utf8'),
    ).resolves.not.toContain('./output/index.mjs');
  });

  it('bundles local mastra bindings into the generated activities module', async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'mastra-temporal-plugin-'));
    const entryPath = path.join(tempDir, 'src', 'index.ts');
    const compiledEntrySource = `
      import { createWorkflow, createStep } from '@mastra/core/workflows';

      const mastra = { marker: 'ok' };
      const fetchWeather = createStep({
        id: 'fetch-weather',
        execute: async ({ inputData, mastra }) => ({ inputData, marker: mastra.marker }),
      });

      export const weatherWorkflow = createWorkflow({ id: 'weather-workflow' }).then(fetchWeather);
    `;
    const compiledWorkflowSource = `export const unused = true;`;
    mockCompiledBundle({ compiledEntrySource, compiledWorkflowSource });

    const workerPlugin = new MastraPlugin({});
    await workerPlugin.prebuild({ entryFile: entryPath });

    const workerOptions = workerPlugin.configureWorker({ taskQueue: 'mastra' } as any);
    const fetchWeather = (workerOptions.activities as Record<string, (...args: any[]) => Promise<unknown>>)[
      'fetch-weather'
    ];
    const activitiesModule = await readFile(path.resolve(process.cwd(), 'node_modules/.mastra/activities.mjs'), 'utf8');

    await expect(fetchWeather({ inputData: { city: 'SF' } })).resolves.toEqual({
      inputData: { city: 'SF' },
      marker: 'ok',
    });
    expect(activitiesModule).toContain('const mastra = {');
    expect(activitiesModule).not.toContain("await import('./activities.mjs')");
  });
});
