import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { Configuration } from 'webpack';
import { MastraPlugin } from './plugin';
import { buildTemporalActivitiesModule } from './transforms/activities';
import { buildTemporalWorkflowModule, buildWorkflowEntryModuleFromRegistry } from './transforms/workflows';
import mastraTemporalWorkflowLoader from './webpack-loader';
import { WorkflowExportRegistry } from './webpack-plugin';

async function transform(source: string): Promise<string> {
  return (await buildTemporalWorkflowModule(source, '/virtual/weather-workflow.ts')).code;
}

async function transformActivities(source: string): Promise<string> {
  return buildTemporalActivitiesModule(source, '/virtual/weather-workflow.ts');
}

describe('@mastra/temporal transform exports', () => {
  it('preserves export semantics for a locally declared workflow exported later', async () => {
    const output = await transform(`
      import { createWorkflow } from '@mastra/core/workflows';

      const weatherWorkflow = createWorkflow({ id: 'weather-workflow' }).then('fetchWeather');
      weatherWorkflow.commit();

      export { weatherWorkflow };
    `);

    expect(output).toMatch(/export\s*(const\s+weatherWorkflow\s*=|\{\s*weatherWorkflow\s*\})/);
  });

  it('preserves direct workflow exports', async () => {
    const output = await transform(`
      import { createWorkflow } from '@mastra/core/workflows';

      export const weatherWorkflow = createWorkflow({ id: 'weather-workflow' }).then('fetchWeather');
    `);

    expect(output).toMatch(/export\s*(const\s+weatherWorkflow\s*=|\{\s*weatherWorkflow\s*\})/);
  });

  it('preserves non-workflow specifiers in mixed export lists', async () => {
    const output = await transform(`
      import { createWorkflow } from '@mastra/core/workflows';

      const otherValue = 42;
      const weatherWorkflow = createWorkflow({ id: 'weather-workflow' }).then('fetchWeather');
      weatherWorkflow.commit();

      export { weatherWorkflow, otherValue };
    `);

    expect(output).toContain('otherValue = 42');
    expect(output).toMatch(/export\s*\{[\s\S]*otherValue[\s\S]*weatherWorkflow[\s\S]*\}/);
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

    expect(output).toContain('createWorkflow("weather-workflow")');
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
    expect(output).toMatch(/export\s*\{\s*fetchWeather\s*\}/);
  });

  it('extracts inline createStep calls from workflow chains and strips the workflow', async () => {
    const output = await transformActivities(`
      import { createStep, createWorkflow } from '@mastra/core/workflows';

      export const weatherWorkflow = createWorkflow({ id: 'weather-workflow' })
        .then(createStep({ id: 'save-activities', execute: async () => ({}) }));

      weatherWorkflow.commit();
    `);

    expect(output).toContain('const saveActivities = createStep({');
    expect(output).toMatch(/export\s*\{\s*saveActivities\s*\}/);
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
    expect(output).toMatch(/export\s*\{\s*fetchWeather\s*\}/);
  });

  it('keeps helper code that extracted steps depend on', async () => {
    const output = await transformActivities(`
      import { z } from 'zod';
      import { createStep } from '@mastra/core/workflows';

      const forecastSchema = z.object({ city: z.string() });

      function getWeatherCondition(city: string) {
        return city.toUpperCase();
      }

      export const fetchWeather = createStep({
        id: 'fetch-weather',
        inputSchema: forecastSchema,
        execute: async ({ inputData }) => ({ city: getWeatherCondition(inputData.city) }),
      });
    `);

    expect(output).toContain('from "zod"');
    expect(output).toContain('const forecastSchema = z.object');
    expect(output).toContain('function getWeatherCondition(city)');
    expect(output).toContain('inputSchema: forecastSchema');
  });

  it('uses a local createStep helper that imports mastra from index', async () => {
    const output = await transformActivities(`
      import { createStep } from '@mastra/core/workflows';

      export const planActivities = createStep({ id: 'plan-activities', execute: async () => ({}) });
    `);

    expect(output).toContain('await import("./index")');
    expect(output).toContain('return args.execute({');
    expect(output).toContain('mastra');
  });

  it('strips createStep and createWorkflow from workflow imports while preserving other imports', async () => {
    const output = await transformActivities(`
      import { createStep, createWorkflow, LegacyStep } from '@mastra/core/workflows';

      const keepLegacyStep = LegacyStep;
      export const fetchWeather = createStep({ id: 'fetch-weather', execute: async () => keepLegacyStep });
    `);

    expect(output).toContain('import { LegacyStep } from "@mastra/core/workflows"');
    expect(output).not.toContain('createWorkflow } from');
    expect(output).not.toContain('createStep,');
  });
});

describe('@mastra/temporal workflow entry module transform', () => {
  it('rewrites the fixture entry file to re-export workflows', async () => {
    const fixturePath = fileURLToPath(new URL('./__tests__/__fixtures__/before/index.ts', import.meta.url));
    const source = await readFile(fixturePath, 'utf-8');
    const workflowPath = fileURLToPath(new URL('./__tests__/__fixtures__/before/weather-workflow.ts', import.meta.url));

    const output = await buildWorkflowEntryModuleFromRegistry(
      source,
      fixturePath,
      new Map([[workflowPath, ['weatherWorkflow']]]),
    );

    expect(output).toMatch(/export\s*\{\s*weatherWorkflow\s*\}\s*from\s*['"]\.\/weather-workflow['"]/);
    expect(output).not.toContain('mastra');
  });

  it('supports multiple workflow imports and explicit workflow property aliases', async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'mastra-temporal-entry-'));
    const entryPath = path.join(tempDir, 'index.ts');
    const weatherPath = path.join(tempDir, 'weather-workflow.ts');
    const activityPath = path.join(tempDir, 'activity-workflow.ts');

    await writeFile(weatherPath, 'export const weatherWorkflow = () => null;', 'utf8');
    await writeFile(activityPath, 'export const activityWorkflow = () => null;', 'utf8');

    const output = await buildWorkflowEntryModuleFromRegistry(
      `
      import { Mastra } from '@mastra/core/mastra';
      import { weatherWorkflow } from './weather-workflow';
      import { activityWorkflow as forecastWorkflow } from './activity-workflow';
      import { otherValue } from './constants';

      export const mastra = new Mastra({
        workflows: {
          weatherWorkflow,
          forecast: forecastWorkflow,
        },
      });
    `,
      entryPath,
      new Map([
        [weatherPath, ['weatherWorkflow']],
        [activityPath, ['forecastWorkflow']],
      ]),
    );

    expect(output).toMatch(/export\s*\{\s*weatherWorkflow\s*\}\s*from\s*['"]\.\/weather-workflow['"]/);
    expect(output).toMatch(/export\s*\{\s*forecastWorkflow\s*\}\s*from\s*['"]\.\/activity-workflow['"]/);
    expect(output).not.toContain('otherValue');
    expect(output).not.toContain('@mastra/core/mastra');
  });
});

describe('@mastra/temporal configureWorker activities', () => {
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
          constructor(_config: unknown) {}
        }

        export const mastra = { marker: 'ok' };
        export default new Mastra({ workflows: { weatherWorkflow } });
      `,
    );

    const plugin = new MastraPlugin({ src: entryPath });
    const workerOptions = plugin.configureWorker({ taskQueue: 'mastra' } as any);
    const fetchWeather = (workerOptions.activities as Record<string, (...args: any[]) => Promise<unknown>>)[
      'fetch-weather'
    ];

    expect(workerOptions.workflowsPath).toBe(entryPath);
    expect(fetchWeather).toBeTypeOf('function');
    await expect(fetchWeather({ inputData: { city: 'SF' } })).resolves.toEqual({
      inputData: { city: 'SF' },
      marker: 'ok',
    });
    await expect(
      readFile(path.join(tempDir, 'src', 'workflows', '.weather-workflow.temporal.activities.mjs'), 'utf8'),
    ).resolves.toContain('function createStep(args)');
  });
});

describe('@mastra/temporal debug output', () => {
  it('wires debug output into the webpack loader and bundle config', async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'mastra-temporal-bundler-'));
    const entryFile = path.join(tempDir, 'src', 'index.ts');
    const workflowFile = path.join(tempDir, 'src', 'workflows', 'weather-workflow.ts');

    await mkdir(path.dirname(workflowFile), { recursive: true });
    await writeFile(
      entryFile,
      `
        import { Mastra } from '@mastra/core/mastra';
        import { weatherWorkflow } from './workflows/weather-workflow';

        export const mastra = new Mastra({ workflows: { weatherWorkflow } });
      `,
      'utf8',
    );
    await writeFile(
      workflowFile,
      `
        import { createWorkflow } from '@mastra/core/workflows';

        export const weatherWorkflow = createWorkflow({ id: 'weather-workflow' }).then('fetch-weather');
      `,
      'utf8',
    );

    const plugin = new MastraPlugin({ src: entryFile, debug: true });
    const bundleOptions = plugin.configureBundler({ workflowsPath: entryFile });
    const webpackConfig = bundleOptions.webpackConfigHook?.({ module: { rules: [] }, plugins: [] } as Configuration);

    expect(webpackConfig).toBeDefined();

    const rules = webpackConfig?.module?.rules ?? [];
    const loaderRule = rules.find(rule => typeof rule === 'object' && rule && 'use' in rule) as
      | { use?: { options?: { entryFile?: string; debugOutputDir?: string | null } } }
      | undefined;

    expect(loaderRule?.use?.options?.entryFile).toBe(entryFile);
    expect(loaderRule?.use?.options?.debugOutputDir).toBe(path.resolve(process.cwd(), '.mastra/temporal'));
    expect(webpackConfig?.plugins).toHaveLength(1);
  });

  it('writes emitted webpack bundle assets from assetEmitted content', async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'mastra-temporal-bundler-'));
    const entryFile = path.join(tempDir, 'src', 'index.ts');
    const workflowFile = path.join(tempDir, 'src', 'workflows', 'weather-workflow.ts');

    await mkdir(path.dirname(workflowFile), { recursive: true });
    await writeFile(
      entryFile,
      `
        import { Mastra } from '@mastra/core/mastra';
        import { weatherWorkflow } from './workflows/weather-workflow';

        export const mastra = new Mastra({ workflows: { weatherWorkflow } });
      `,
      'utf8',
    );
    await writeFile(
      workflowFile,
      `
        import { createWorkflow } from '@mastra/core/workflows';

        export const weatherWorkflow = createWorkflow({ id: 'weather-workflow' }).then('fetch-weather');
      `,
      'utf8',
    );

    const plugin = new MastraPlugin({ src: entryFile, debug: true });
    const bundleOptions = plugin.configureBundler({ workflowsPath: entryFile });
    const webpackConfig = bundleOptions.webpackConfigHook?.({ module: { rules: [] }, plugins: [] } as Configuration);
    const debugPlugin = webpackConfig?.plugins?.find(
      plugin => plugin && plugin.constructor?.name === 'WriteWebpackBundleDebugPlugin',
    ) as { apply: (compiler: any) => void };
    let emitAsset: ((filename: string, info: { content: Buffer }) => Promise<void>) | undefined;

    debugPlugin.apply({
      hooks: {
        assetEmitted: {
          tapPromise: (_name: string, handler: (filename: string, info: { content: Buffer }) => Promise<void>) => {
            emitAsset = handler;
          },
        },
      },
    });

    expect(emitAsset).toBeDefined();

    await emitAsset?.('workflow-bundle-test.js', { content: Buffer.from('module.exports = {};') });

    const writtenBundle = await readFile(
      path.join(process.cwd(), '.mastra/temporal/bundle/workflow-bundle-test.js'),
      'utf-8',
    );
    expect(writtenBundle).toBe('module.exports = {};');
  });

  it('rewrites the entry module before webpack builds the dependency graph', async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'mastra-temporal-loader-'));
    const entryFile = path.join(tempDir, 'src', 'index.ts');
    const workflowFile = path.join(tempDir, 'src', 'workflows', 'weather-workflow.ts');
    const registry = new WorkflowExportRegistry();

    await mkdir(path.dirname(workflowFile), { recursive: true });
    await writeFile(
      entryFile,
      `
        import { Mastra } from '@mastra/core/mastra';
        import { weatherWorkflow } from './workflows/weather-workflow';
        import { weatherAgent } from './agents/weather-agent';

        export const mastra = new Mastra({
          workflows: { weatherWorkflow },
          agents: { weatherAgent },
        });
      `,
      'utf8',
    );
    await writeFile(workflowFile, 'export const weatherWorkflow = null;', 'utf8');
    registry.register(workflowFile, ['weatherWorkflow']);
    const entrySource = await readFile(entryFile, 'utf8');

    const output = await new Promise<string>((resolve, reject) => {
      mastraTemporalWorkflowLoader.call(
        {
          resourcePath: entryFile,
          getOptions: () => ({ entryFile, registry }),
          async: () => (err: unknown, code?: string) => {
            if (err) {
              reject(err);
              return;
            }

            resolve(code ?? '');
          },
        },
        entrySource,
      );
    });

    expect(output).toContain('export { weatherWorkflow } from "./workflows/weather-workflow";');
    expect(output).not.toContain('weatherAgent');
    expect(output).not.toContain('@mastra/core/mastra');
  });

  it('writes transformed workflow modules when debug output is enabled', async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'mastra-temporal-debug-'));
    const entryFile = path.join(tempDir, 'src', 'index.ts');
    const workflowFile = path.join(tempDir, 'src', 'workflows', 'weather-workflow.ts');
    const debugOutputDir = path.join(tempDir, '.mastra', 'temporal');
    const source = `
      import { createWorkflow } from '@mastra/core/workflows';

      export const weatherWorkflow = createWorkflow({ id: 'weather-workflow' }).then('fetch-weather');
    `;

    const output = await new Promise<string>((resolve, reject) => {
      mastraTemporalWorkflowLoader.call(
        {
          resourcePath: workflowFile,
          getOptions: () => ({ entryFile, debugOutputDir }),
          async: () => (err: unknown, code?: string) => {
            if (err) {
              reject(err);
              return;
            }

            resolve(code ?? '');
          },
        },
        source,
      );
    });

    const debugModulePath = path.join(debugOutputDir, 'modules', 'workflows', 'weather-workflow.ts');
    const writtenDebugModule = await readFile(debugModulePath, 'utf-8');

    expect(writtenDebugModule).toBe(output);
    expect(writtenDebugModule).toContain('.then("fetch-weather")');
  });
});
