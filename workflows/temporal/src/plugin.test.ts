import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BuildBundler } from './mastra-deployer';
import { MastraPlugin } from './plugin';

const tempDirs: string[] = [];

function moduleUrl(filePath: string): string {
  return `${pathToFileURL(filePath).href}?t=${Date.now()}-${Math.random()}`;
}

async function writeMastraCoreShim(projectRoot: string): Promise<void> {
  const coreDir = path.join(projectRoot, 'node_modules', '@mastra', 'core');
  await mkdir(coreDir, { recursive: true });
  await writeFile(
    path.join(coreDir, 'package.json'),
    JSON.stringify({
      name: '@mastra/core',
      type: 'module',
      exports: {
        './di': './di.js',
        './mastra': './mastra.js',
        './workflows': './workflows.js',
      },
    }),
  );
  await writeFile(
    path.join(coreDir, 'di.js'),
    `export class RequestContext { constructor(entries = {}) { this.entries = entries; } get(key) { return this.entries[key]; } }`,
  );
  await writeFile(
    path.join(coreDir, 'mastra.js'),
    `export class Mastra { constructor(config) { this.config = config; } }`,
  );
  await writeFile(
    path.join(coreDir, 'workflows.js'),
    `export const createStep = args => args; export const createWorkflow = config => ({ then: () => ({ parallel: () => ({ sleep: () => ({ then: () => ({ commit() {} }) }) }) }) });`,
  );
}

async function writeTemporalWorkflowShim(projectRoot: string): Promise<void> {
  const temporalWorkflowDir = path.join(projectRoot, 'node_modules', '@temporalio', 'workflow');
  await mkdir(temporalWorkflowDir, { recursive: true });
  await writeFile(
    path.join(temporalWorkflowDir, 'package.json'),
    JSON.stringify({ name: '@temporalio/workflow', type: 'module', exports: './index.js' }),
  );
  await writeFile(
    path.join(temporalWorkflowDir, 'index.js'),
    `
      const getMock = () => globalThis.__temporalWorkflowMock;
      export const executeChild = (...args) => getMock().executeChild(...args);
      export const proxyActivities = (...args) => getMock().proxyActivities(...args);
      export const sleep = (...args) => getMock().sleep(...args);
      export const log = { info: (...args) => getMock().log.info(...args) };
    `,
  );
}

function mockCompiledBundle(compiledEntrySource: string) {
  return vi.spyOn(BuildBundler.prototype, 'bundle').mockImplementation(async (_entryFile, outputDirectory) => {
    const outputDir = path.join(outputDirectory, 'output');
    await mkdir(outputDir, { recursive: true });
    await writeFile(path.join(outputDir, 'index.mjs'), compiledEntrySource, 'utf8');
    await writeFile(path.join(outputDir, 'mastra.mjs'), 'export const unused = true;', 'utf8');
  });
}

afterEach(async () => {
  vi.restoreAllMocks();
  delete (globalThis as typeof globalThis & { __temporalWorkflowMock?: unknown }).__temporalWorkflowMock;
  await Promise.all(tempDirs.map(tempDir => rm(tempDir, { recursive: true, force: true })));
  tempDirs.length = 0;
});

describe('MastraPlugin', () => {
  it('retries prebuild after a failed build', async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'mastra-temporal-prebuild-'));
    tempDirs.push(tempDir);
    const bundleSpy = vi.spyOn(BuildBundler.prototype, 'bundle').mockRejectedValue(new Error('bundle failed'));
    const plugin = new MastraPlugin(path.join(tempDir, 'index.ts'), tempDir);

    await expect(plugin.configureWorker({ taskQueue: 'mastra' } as any)).rejects.toThrow('bundle failed');
    await expect(plugin.configureWorker({ taskQueue: 'mastra' } as any)).rejects.toThrow('bundle failed');

    expect(bundleSpy).toHaveBeenCalledTimes(2);
  });
});

describe('Temporal prebuild integration', () => {
  it('executes generated workflows with generated activities through proxyActivities', async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'mastra-temporal-prebuild-'));
    tempDirs.push(tempDir);

    const fixtureDir = path.join(import.meta.dirname, '__tests__', 'integration', 'fixtures');
    const projectSrcDir = path.join(tempDir, 'src');
    await cp(fixtureDir, projectSrcDir, { recursive: true });
    await writeMastraCoreShim(tempDir);
    await writeTemporalWorkflowShim(tempDir);

    const entryFile = path.join(projectSrcDir, 'index.ts');
    const compiledEntrySource = `
      import { init } from '@mastra/temporal';

      class Mastra {
        constructor(config) {
          this.config = config;
        }
      }

      const { createWorkflow, createStep } = init({
        client: undefined,
        taskQueue: 'mastra',
        startToCloseTimeout: '5 minutes',
      });

      const step1 = createStep({
        id: 'step1',
        execute: async ({ inputData }) => ({ value: inputData.input + '-step1' }),
      });

      const innerStep = createStep({
        id: 'inner-step',
        execute: async ({ inputData }) => ({ value: inputData.value + '-inner' }),
      });

      const innerWorkflow = createWorkflow({ id: 'inner-workflow' }).then(innerStep);

      const step2 = createStep({
        id: 'step2',
        execute: async ({ inputData }) => ({ step2: inputData.value + '-step2' }),
      });

      const step3 = createStep({
        id: 'step3',
        execute: async ({ inputData }) => ({ step3: inputData.value + '-step3' }),
      });

      const step4 = createStep({
        id: 'step4',
        execute: async ({ inputData }) => ({ result: inputData.step2.step2 + '|' + inputData.step3.step3 + '|final' }),
      });

      export const complexWorkflow = createWorkflow({ id: 'complex-workflow' })
        .then(step1)
        .then(innerWorkflow)
        .parallel([step2, step3])
        .sleep(1000)
        .then(step4)
        .commit();

      const double = value => value * 2;
      export const mappedWorkflow = createWorkflow({ id: 'mapped-workflow' })
        .map(({ inputData }) => ({ doubled: double(inputData.value) }))
        .commit();

      export const mastra = new Mastra({ workflows: { complexWorkflow, mappedWorkflow } });
    `;
    const bundleSpy = mockCompiledBundle(compiledEntrySource);
    const customActivity = vi.fn(async () => undefined);
    const conflictingActivity = vi.fn(async () => undefined);

    const plugin = new MastraPlugin(entryFile, tempDir);
    const [workerOptions] = await Promise.all([
      plugin.configureWorker({
        taskQueue: 'mastra',
        activities: { customActivity, step1: conflictingActivity },
      } as any),
      plugin.configureWorker({ taskQueue: 'mastra' } as any),
    ]);

    const temporalOutputDir = path.join(tempDir, 'node_modules', '.mastra');
    const workflowPath = path.join(temporalOutputDir, 'workflow.mjs');
    const activitiesPath = path.join(temporalOutputDir, 'activities.mjs');
    const activityBindingsPath = path.join(temporalOutputDir, 'activity-bindings.json');

    expect(workerOptions.workflowsPath).toBe(workflowPath);
    expect(workerOptions.activities).toMatchObject({ customActivity });
    expect(Object.values(workerOptions.activities ?? {})).not.toContain(conflictingActivity);
    expect(bundleSpy).toHaveBeenCalledTimes(1);
    expect(bundleSpy).toHaveBeenCalledWith(entryFile, temporalOutputDir, {
      toolsPaths: [],
      projectRoot: tempDir,
    });

    const [workflowSource, activitiesSource, activityBindingsSource] = await Promise.all([
      readFile(workflowPath, 'utf8'),
      readFile(activitiesPath, 'utf8'),
      readFile(activityBindingsPath, 'utf8'),
    ]);
    const activityBindings = JSON.parse(activityBindingsSource) as { exportName: string; stepId: string }[];

    const normalizedWorkflowSource = workflowSource.replace(/\s+/g, ' ');
    expect(workflowSource).toContain('const complexWorkflow =');
    expect(workflowSource).toContain('const innerWorkflow =');
    expect(workflowSource).toContain('.then("step1")');
    expect(workflowSource).toContain('.thenWorkflow("innerWorkflow")');
    expect(normalizedWorkflowSource).toContain(
      '.parallel([{ type: "step", step: { id: "step2" } }, { type: "step", step: { id: "step3" } }])',
    );
    expect(workflowSource).toContain('.sleep(1000)');
    expect(workflowSource).toContain('.then("step4")');
    expect(workflowSource).toContain('.map("mapping_mapped-workflow_0")');
    expect(workflowSource).not.toContain('inputData.value * 2');
    expect(workflowSource).not.toContain('export const mastra');
    expect(workflowSource).not.toContain('createStep({');
    expect(workflowSource).toContain("startToCloseTimeout: '5 minutes'");

    expect(activitiesSource).toContain('function createStep(args)');
    expect(activitiesSource).toContain('const step1 = createStep({');
    expect(activitiesSource).toContain('const innerStep = createStep({');
    expect(activitiesSource).toContain('const step2 = createStep({');
    expect(activitiesSource).toContain('const step3 = createStep({');
    expect(activitiesSource).toContain('const step4 = createStep({');
    expect(activitiesSource).toMatch(/const mappingMappedWorkflow0[\s\S]*export \{[^}]*mappingMappedWorkflow0/);
    expect(activitiesSource).toContain('const double =');
    expect(activitiesSource).not.toContain('const innerWorkflow =');
    expect(activitiesSource).not.toContain('const complexWorkflow =');
    expect(activitiesSource).not.toContain('const mappedWorkflow =');
    expect(activityBindings).toEqual([
      { exportName: 'step1', stepId: 'step1' },
      { exportName: 'innerStep', stepId: 'inner-step' },
      { exportName: 'step2', stepId: 'step2' },
      { exportName: 'step3', stepId: 'step3' },
      { exportName: 'step4', stepId: 'step4' },
      { exportName: 'mappingMappedWorkflow0', stepId: 'mapping_mapped-workflow_0' },
    ]);

    const activitiesModule = (await import(moduleUrl(activitiesPath))) as Record<string, unknown>;
    const activitiesByStepId = Object.fromEntries(
      activityBindings.map(binding => [binding.stepId, activitiesModule[binding.exportName]]),
    );
    const sleep = vi.fn(async () => {});
    const executeChild = vi.fn(async (workflowType: string, options: { args: [{ inputData: unknown }] }) => {
      const childWorkflow = workflowModule[workflowType];
      if (typeof childWorkflow !== 'function') {
        throw new Error(`Missing child workflow ${workflowType}`);
      }
      return childWorkflow(...options.args);
    });
    const proxyActivities = vi.fn(() => activitiesByStepId);
    const logInfo = vi.fn();
    let workflowModule: Record<string, unknown>;
    (globalThis as typeof globalThis & { __temporalWorkflowMock: unknown }).__temporalWorkflowMock = {
      executeChild,
      proxyActivities,
      sleep,
      log: {
        info: logInfo,
      },
    };

    workflowModule = (await import(moduleUrl(workflowPath))) as Record<string, unknown>;
    const complexWorkflow = workflowModule.complexWorkflow;
    expect(complexWorkflow).toBeTypeOf('function');

    const result = await (complexWorkflow as (args: { inputData: { input: string } }) => Promise<unknown>)({
      inputData: { input: 'test' },
    });

    expect(result).toEqual({
      status: 'success',
      input: { input: 'test' },
      result: { result: 'test-step1-inner-step2|test-step1-inner-step3|final' },
      state: undefined,
      steps: {
        step1: { value: 'test-step1' },
        innerWorkflow: { value: 'test-step1-inner' },
        step2: { step2: 'test-step1-inner-step2' },
        step3: { step3: 'test-step1-inner-step3' },
        step4: { result: 'test-step1-inner-step2|test-step1-inner-step3|final' },
      },
    });
    const mappedWorkflow = workflowModule.mappedWorkflow;
    expect(mappedWorkflow).toBeTypeOf('function');
    await expect(
      (mappedWorkflow as (args: { inputData: { value: number } }) => Promise<unknown>)({
        inputData: { value: 21 },
      }),
    ).resolves.toEqual({
      status: 'success',
      input: { value: 21 },
      result: { doubled: 42 },
      state: undefined,
      steps: {
        'mapping_mapped-workflow_0': { doubled: 42 },
      },
    });

    expect(proxyActivities).toHaveBeenCalledWith({ startToCloseTimeout: '5 minutes' });
    expect(executeChild).toHaveBeenCalledWith('innerWorkflow', {
      args: [{ inputData: { value: 'test-step1' }, workflowId: 'complex-workflow' }],
    });
    expect(sleep).toHaveBeenCalledWith(1000);
  });

  it('excludes Node dependencies used inside activities from generated workflows', async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'mastra-temporal-node-isolation-'));
    tempDirs.push(tempDir);
    const entryFile = path.join(tempDir, 'src', 'index.ts');
    await mkdir(path.dirname(entryFile), { recursive: true });
    await writeFile(entryFile, 'export {};');

    mockCompiledBundle(`
      import { readFileSync } from 'node:fs';
      import { createStep, createWorkflow } from '@mastra/core/workflows';

      const readResource = createStep({
        id: 'read-resource',
        execute: async () => ({
          size: readFileSync(new URL(import.meta.url)).byteLength,
          fs: await import('node:fs'),
        }),
      });
      export const resourceWorkflow = createWorkflow({ id: 'resource-workflow' })
        .then(readResource)
        .commit();
    `);

    const plugin = new MastraPlugin(entryFile, tempDir);
    await plugin.configureWorker({ taskQueue: 'mastra' } as any);

    const outputDir = path.join(tempDir, 'node_modules', '.mastra');
    const workflowSource = await readFile(path.join(outputDir, 'workflow.mjs'), 'utf8');
    const activitiesSource = await readFile(path.join(outputDir, 'activities.mjs'), 'utf8');

    expect(workflowSource).toContain('const resourceWorkflow =');
    expect(workflowSource).toContain('.then("read-resource")');
    expect(workflowSource).not.toContain('node:fs');
    expect(workflowSource).not.toContain('readFileSync');
    expect(activitiesSource).toContain("from 'node:fs'");
    expect(activitiesSource).toContain("import('node:fs')");
    expect(activitiesSource).toContain('readFileSync');
  });

  it('rejects Node dependencies that remain after workflow tree-shaking', async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'mastra-temporal-node-rejection-'));
    tempDirs.push(tempDir);
    const entryFile = path.join(tempDir, 'src', 'index.ts');
    await mkdir(path.dirname(entryFile), { recursive: true });
    await writeFile(entryFile, 'export {};');

    mockCompiledBundle(`
      import { readFileSync } from 'node:fs';
      import { createStep, createWorkflow } from '@mastra/core/workflows';

      readFileSync(new URL(import.meta.url));
      const readResource = createStep({
        id: 'read-resource',
        execute: async () => readFileSync(new URL(import.meta.url)).byteLength,
      });
      export const resourceWorkflow = createWorkflow({ id: 'resource-workflow' })
        .then(readResource)
        .commit();
    `);

    const plugin = new MastraPlugin(entryFile, tempDir);

    await expect(plugin.configureWorker({ taskQueue: 'mastra' } as any)).rejects.toThrow(
      "Temporal workflow bundle cannot depend on Node.js builtin 'node:fs'",
    );
  });

  it('rejects dynamic Node dependencies that remain after workflow tree-shaking', async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'mastra-temporal-dynamic-node-rejection-'));
    tempDirs.push(tempDir);
    const entryFile = path.join(tempDir, 'src', 'index.ts');
    await mkdir(path.dirname(entryFile), { recursive: true });
    await writeFile(entryFile, 'export {};');

    mockCompiledBundle(`
      import { createWorkflow } from '@mastra/core/workflows';

      await import('node:fs');
      export const resourceWorkflow = createWorkflow({ id: 'resource-workflow' }).commit();
    `);

    const plugin = new MastraPlugin(entryFile, tempDir);

    await expect(plugin.configureWorker({ taskQueue: 'mastra' } as any)).rejects.toThrow(
      "Temporal workflow bundle cannot depend on Node.js builtin 'node:fs'",
    );
  });
});
