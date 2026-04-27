import { beforeEach, describe, expect, it, vi } from 'vitest';

const proxyActivities = vi.fn();
const sleep = vi.fn(async () => {});
const logInfo = vi.fn();

vi.mock('@temporalio/workflow', () => ({
  proxyActivities,
  sleep,
  log: {
    info: logInfo,
  },
}));

describe('temporal workflow runtime helper module', () => {
  beforeEach(() => {
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
});
