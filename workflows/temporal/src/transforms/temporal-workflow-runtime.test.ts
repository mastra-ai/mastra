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
    const result = await workflow({ inputData: { city: 'SF' }, initialState: { started: true } });

    expect(proxyActivities).toHaveBeenCalledWith({ startToCloseTimeout: '1 minute' });
    expect(fetchWeather).toHaveBeenCalledWith({ inputData: { city: 'SF' } });
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

  it('executes child workflow entries through executeChild', async () => {
    proxyActivities.mockReturnValue({});
    executeChild.mockResolvedValue({ result: { city: 'SF', child: true } });

    const { createWorkflow } = await import('./temporal-workflow-runtime.mjs');
    const workflow = createWorkflow('weather-workflow').thenWorkflow('childWorkflow').commit();
    const result = await workflow({ inputData: { city: 'SF' } });

    expect(executeChild).toHaveBeenCalledWith('childWorkflow', { args: [{ inputData: { city: 'SF' } }] });
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
    const workflow = createWorkflow('parallel-workflow').parallel(['first', 'second']).commit();
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
