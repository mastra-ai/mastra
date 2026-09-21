import { beforeEach, describe, expect, it, vi } from 'vitest';

const executeChild = vi.fn();
const proxyActivities = vi.fn();
const sleep = vi.fn(async () => {});
const logInfo = vi.fn();

vi.mock('@temporalio/workflow', () => ({
  executeChild,
  proxyActivities,
  sleep,
  log: {
    info: logInfo,
  },
}));

describe('temporal workflow runtime helper module', () => {
  beforeEach(() => {
    executeChild.mockReset();
    proxyActivities.mockReset();
    sleep.mockClear();
    logInfo.mockClear();
  });

  it('executes chained workflow steps through proxy activities', async () => {
    const fetchWeather = vi.fn(async ({ inputData }) => ({ ...inputData, weather: 'sunny' }));
    proxyActivities.mockReturnValue({
      'fetch-weather': fetchWeather,
    });

    const { createWorkflow } = await import('./temporal-workflow-runtime.mjs');
    const workflow = createWorkflow('weather-workflow').then('fetch-weather').commit();
    const result = await workflow({
      inputData: { city: 'SF' },
      initialState: { started: true },
      requestContext: { tenantId: 'tenant-1' },
      runId: 'run-1',
      resourceId: 'resource-1',
    });

    expect(proxyActivities).toHaveBeenCalledWith({ startToCloseTimeout: '1 minute' });
    expect(fetchWeather).toHaveBeenCalledWith({
      inputData: { city: 'SF' },
      requestContext: { tenantId: 'tenant-1' },
      runId: 'run-1',
      resourceId: 'resource-1',
    });
    expect(result).toEqual({
      status: 'success',
      input: { city: 'SF' },
      result: { city: 'SF', weather: 'sunny' },
      state: { started: true },
      steps: {
        'fetch-weather': { city: 'SF', weather: 'sunny' },
      },
    });
  });

  it('executes mapping entries through proxy activities', async () => {
    const mappingId = 'mapping_mapped-workflow_0';
    const mapping = vi.fn(async ({ inputData, initData }) => ({
      doubled: inputData.value * 2,
      initialValue: initData.value,
    }));
    proxyActivities.mockReturnValue({ [mappingId]: mapping });

    const { createWorkflow } = await import('./temporal-workflow-runtime.mjs');
    const workflow = createWorkflow('mapped-workflow').map(mappingId).commit();
    const result = await workflow({
      inputData: { value: 21 },
      requestContext: { tenantId: 'tenant-1' },
      runId: 'run-1',
      resourceId: 'resource-1',
    });

    expect(mapping).toHaveBeenCalledWith({
      inputData: { value: 21 },
      initData: { value: 21 },
      requestContext: { tenantId: 'tenant-1' },
      runId: 'run-1',
      resourceId: 'resource-1',
    });
    expect(result).toEqual({
      status: 'success',
      input: { value: 21 },
      result: { doubled: 42, initialValue: 21 },
      state: undefined,
      steps: {
        [mappingId]: { doubled: 42, initialValue: 21 },
      },
    });
  });

  it('propagates mapping activity failures', async () => {
    const mappingId = 'mapping_mapped-workflow_0';
    const error = new Error('mapping failed');
    proxyActivities.mockReturnValue({
      [mappingId]: vi.fn(async () => {
        throw error;
      }),
    });

    const { createWorkflow } = await import('./temporal-workflow-runtime.mjs');
    const workflow = createWorkflow('mapped-workflow').map(mappingId).commit();

    await expect(workflow({ inputData: { value: 21 } })).rejects.toBe(error);
  });

  it('uses the configured activity timeout', async () => {
    proxyActivities.mockReturnValue({});

    const { createWorkflow } = await import('./temporal-workflow-runtime.mjs');
    const workflow = createWorkflow('weather-workflow', { startToCloseTimeout: '5 minutes' }).commit();
    await workflow({ inputData: { city: 'SF' } });

    expect(proxyActivities).toHaveBeenCalledWith({ startToCloseTimeout: '5 minutes' });
  });

  it('executes child workflow entries through executeChild', async () => {
    proxyActivities.mockReturnValue({});
    executeChild.mockResolvedValue({ result: { city: 'SF', child: true } });

    const { createWorkflow } = await import('./temporal-workflow-runtime.mjs');
    const workflow = createWorkflow('weather-workflow').thenWorkflow('childWorkflow').commit();
    const result = await workflow({
      inputData: { city: 'SF' },
      requestContext: { tenantId: 'tenant-1' },
      runId: 'run-1',
      resourceId: 'resource-1',
    });

    expect(executeChild).toHaveBeenCalledWith('childWorkflow', {
      args: [
        {
          inputData: { city: 'SF' },
          requestContext: { tenantId: 'tenant-1' },
          runId: 'run-1',
          resourceId: 'resource-1',
        },
      ],
    });
    expect(result).toEqual({
      status: 'success',
      input: { city: 'SF' },
      result: { city: 'SF', child: true },
      state: undefined,
      steps: {
        childWorkflow: { city: 'SF', child: true },
      },
    });
  });

  it('supports delay entries in the workflow graph', async () => {
    proxyActivities.mockReturnValue({
      'fetch-weather': vi.fn(async ({ inputData }) => inputData),
    });

    const { createWorkflow } = await import('./temporal-workflow-runtime.mjs');
    const workflow = createWorkflow('weather-workflow').then('fetch-weather').sleep(250).commit();
    await workflow({ inputData: { city: 'SF' } });

    expect(sleep).toHaveBeenCalledWith(250);
    expect(logInfo).toHaveBeenCalledWith('sleep', expect.objectContaining({ duration: 250 }));
  });

  it('executes parallel entries and merges results by step id', async () => {
    const first = vi.fn(async ({ inputData }) => ({ first: inputData.value + 1 }));
    const second = vi.fn(async ({ inputData }) => ({ second: inputData.value + 2 }));
    proxyActivities.mockReturnValue({ first, second });

    const { createWorkflow } = await import('./temporal-workflow-runtime.mjs');
    const workflow = createWorkflow('parallel-workflow')
      .parallel([
        { type: 'step', step: { id: 'first' } },
        { type: 'step', step: { id: 'second' } },
      ])
      .commit();
    const result = await workflow({ inputData: { value: 1 } });

    expect(first).toHaveBeenCalledWith({ inputData: { value: 1 } });
    expect(second).toHaveBeenCalledWith({ inputData: { value: 1 } });
    expect(result).toEqual({
      status: 'success',
      input: { value: 1 },
      result: {
        first: { first: 2 },
        second: { second: 3 },
      },
      state: undefined,
      steps: {
        first: { first: 2 },
        second: { second: 3 },
      },
    });
  });

  it('executes parallel child workflow entries through executeChild', async () => {
    proxyActivities.mockReturnValue({});
    executeChild.mockResolvedValue({ result: { value: 'child-output' } });

    const { createWorkflow } = await import('./temporal-workflow-runtime.mjs');
    const workflow = createWorkflow('parallel-child-workflow')
      .parallel([{ type: 'childWorkflow', workflowType: 'childWorkflow' }])
      .commit();
    const result = await workflow({ inputData: { value: 'parent-input' } });

    expect(executeChild).toHaveBeenCalledWith('childWorkflow', {
      args: [{ inputData: { value: 'parent-input' } }],
    });
    expect(result).toEqual({
      status: 'success',
      input: { value: 'parent-input' },
      result: {
        childWorkflow: { value: 'child-output' },
      },
      state: undefined,
      steps: {
        childWorkflow: { value: 'child-output' },
      },
    });
  });

  it('executes mixed parallel step and child workflow entries', async () => {
    const activity = vi.fn(async ({ inputData }) => ({ value: `${inputData.value}-activity` }));
    proxyActivities.mockReturnValue({ activity });
    executeChild.mockResolvedValue({ result: { value: 'child-output' } });

    const { createWorkflow } = await import('./temporal-workflow-runtime.mjs');
    const workflow = createWorkflow('mixed-parallel-workflow')
      .parallel([
        { type: 'step', step: { id: 'activity' } },
        { type: 'childWorkflow', workflowType: 'childWorkflow' },
      ])
      .commit();
    const result = await workflow({ inputData: { value: 'parent-input' } });

    expect(activity).toHaveBeenCalledWith({ inputData: { value: 'parent-input' } });
    expect(executeChild).toHaveBeenCalledWith('childWorkflow', {
      args: [{ inputData: { value: 'parent-input' } }],
    });
    expect(result).toMatchObject({
      result: {
        activity: { value: 'parent-input-activity' },
        childWorkflow: { value: 'child-output' },
      },
      steps: {
        activity: { value: 'parent-input-activity' },
        childWorkflow: { value: 'child-output' },
      },
    });
  });

  it('executes foreach entries with configured concurrency', async () => {
    const map = vi.fn(async ({ inputData }) => ({ value: inputData.value + 10 }));
    proxyActivities.mockReturnValue({ map });

    const { createWorkflow } = await import('./temporal-workflow-runtime.mjs');
    const workflow = createWorkflow('foreach-workflow').foreach('map', { concurrency: 2 }).commit();
    const result = await workflow({ inputData: [{ value: 1 }, { value: 2 }, { value: 3 }] });

    expect(map).toHaveBeenCalledTimes(3);
    expect(map).toHaveBeenNthCalledWith(1, { inputData: { value: 1 } });
    expect(map).toHaveBeenNthCalledWith(2, { inputData: { value: 2 } });
    expect(map).toHaveBeenNthCalledWith(3, { inputData: { value: 3 } });
    expect(result).toMatchObject({
      result: [{ value: 11 }, { value: 12 }, { value: 13 }],
      steps: {
        map: [{ value: 11 }, { value: 12 }, { value: 13 }],
      },
    });
  });

  it('executes foreach entries with a concurrency resolver evaluated per run', async () => {
    // Gate activity completion so we can observe how many calls run concurrently:
    // with a resolved concurrency of 2, two calls must be in flight before any finishes.
    let active = 0;
    let maxActive = 0;
    const releases: (() => void)[] = [];
    const map = vi.fn(async ({ inputData }: { inputData: { value: number } }) => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise<void>(resolve => releases.push(resolve));
      active -= 1;
      return { value: inputData.value + 10 };
    });
    proxyActivities.mockReturnValue({ map });

    const resolverCalls: { inputData: unknown; initData: unknown }[] = [];
    const { createWorkflow } = await import('./temporal-workflow-runtime.mjs');
    const workflow = createWorkflow('foreach-resolver-workflow')
      .foreach('map', {
        concurrency: (ctx: { inputData: unknown; getInitData: () => unknown }) => {
          resolverCalls.push({ inputData: ctx.inputData, initData: ctx.getInitData() });
          return 2;
        },
      })
      .commit();
    const input = [{ value: 1 }, { value: 2 }, { value: 3 }];
    const run = workflow({ inputData: input });

    // The resolved concurrency (2) caps in-flight calls: the third only starts after a release.
    await vi.waitFor(() => expect(releases).toHaveLength(2));
    expect(map).toHaveBeenCalledTimes(2);
    releases.shift()!();
    await vi.waitFor(() => expect(releases).toHaveLength(2));
    while (releases.length) releases.shift()!();
    const result = await run;

    expect(map).toHaveBeenCalledTimes(3);
    expect(maxActive).toBe(2);
    expect(result).toMatchObject({
      result: [{ value: 11 }, { value: 12 }, { value: 13 }],
    });
    // Resolver is invoked at execution time with the foreach input and the run's init data.
    expect(resolverCalls).toEqual([{ inputData: input, initData: input }]);
  });

  it('executes conditional entries for truthy conditions only', async () => {
    const isSmall = vi.fn(async () => true);
    const isLarge = vi.fn(async () => false);
    const smallStep = vi.fn(async ({ inputData }) => ({ path: 'small', value: inputData.value }));
    const largeStep = vi.fn(async ({ inputData }) => ({ path: 'large', value: inputData.value }));
    proxyActivities.mockReturnValue({ isSmall, isLarge, smallStep, largeStep });

    const { createWorkflow } = await import('./temporal-workflow-runtime.mjs');
    const workflow = createWorkflow('branch-workflow')
      .branch([
        ['isSmall', 'smallStep'],
        ['isLarge', 'largeStep'],
      ])
      .commit();
    const result = await workflow({ inputData: { value: 3 } });

    expect(isSmall).toHaveBeenCalledWith({ inputData: { value: 3 } });
    expect(isLarge).toHaveBeenCalledWith({ inputData: { value: 3 } });
    expect(smallStep).toHaveBeenCalledWith({ inputData: { value: 3 } });
    expect(largeStep).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      result: {
        smallStep: { path: 'small', value: 3 },
      },
      steps: {
        smallStep: { path: 'small', value: 3 },
      },
    });
  });

  it('executes dowhile and dountil loops until their break conditions are met', async () => {
    const incrementWhile = vi.fn(async ({ inputData }) => ({ value: inputData.value + 1 }));
    const continueWhile = vi.fn(async ({ inputData }) => inputData.value < 2);
    const incrementUntil = vi.fn(async ({ inputData }) => ({ value: inputData.value + 1 }));
    const stopUntil = vi.fn(async ({ inputData }) => inputData.value >= 2);
    proxyActivities.mockReturnValue({ incrementWhile, continueWhile, incrementUntil, stopUntil });

    const { createWorkflow } = await import('./temporal-workflow-runtime.mjs');
    const doWhileWorkflow = createWorkflow('dowhile-workflow').dowhile('incrementWhile', 'continueWhile').commit();
    const doUntilWorkflow = createWorkflow('dountil-workflow').dountil('incrementUntil', 'stopUntil').commit();

    await expect(doWhileWorkflow({ inputData: { value: 0 } })).resolves.toMatchObject({
      result: { value: 2 },
      steps: {
        incrementWhile: { value: 2 },
      },
    });
    await expect(doUntilWorkflow({ inputData: { value: 0 } })).resolves.toMatchObject({
      result: { value: 2 },
      steps: {
        incrementUntil: { value: 2 },
      },
    });
    expect(incrementWhile).toHaveBeenCalledTimes(2);
    expect(continueWhile).toHaveBeenCalledTimes(2);
    expect(incrementUntil).toHaveBeenCalledTimes(2);
    expect(stopUntil).toHaveBeenCalledTimes(2);
  });
});
