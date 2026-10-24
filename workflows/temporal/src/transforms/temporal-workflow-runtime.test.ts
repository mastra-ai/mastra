import { beforeEach, describe, expect, it, vi } from 'vitest';

const executeChild = vi.fn();
const proxyActivities = vi.fn();
const sleep = vi.fn(async () => {});
const logInfo = vi.fn();
const nonRetryable = vi.fn((message: string) => Object.assign(new Error(message), { nonRetryable: true }));
const defineQuery = vi.fn((name: string) => name);
const defineSignal = vi.fn((name: string) => name);
const signalHandlers = new Map<string, (...args: unknown[]) => void>();
const setHandler = vi.fn((signal: string, handler: (...args: unknown[]) => void) => {
  signalHandlers.set(signal, handler);
});
const condition = vi.fn(async (predicate: () => boolean) => {
  await vi.waitFor(() => expect(predicate()).toBe(true));
});

vi.mock('@temporalio/workflow', () => ({
  ApplicationFailure: { nonRetryable },
  condition,
  defineQuery,
  defineSignal,
  executeChild,
  proxyActivities,
  setHandler,
  sleep,
  log: {
    info: logInfo,
  },
}));

const succeeded = (output: unknown) =>
  expect.objectContaining({
    __temporalStepResult: true,
    status: 'success',
    output,
    startedAt: expect.any(Number),
    endedAt: expect.any(Number),
  });

describe('temporal workflow runtime helper module', () => {
  beforeEach(() => {
    executeChild.mockReset();
    proxyActivities.mockReset();
    sleep.mockClear();
    logInfo.mockClear();
    defineQuery.mockClear();
    defineSignal.mockClear();
    setHandler.mockClear();
    condition.mockClear();
    nonRetryable.mockClear();
    signalHandlers.clear();
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
      initData: { city: 'SF' },
      requestContext: { tenantId: 'tenant-1' },
      runId: 'run-1',
      resourceId: 'resource-1',
      workflowId: 'weather-workflow',
    });
    expect(result).toEqual({
      status: 'success',
      input: { city: 'SF' },
      result: { city: 'SF', weather: 'sunny' },
      state: { started: true },
      steps: {
        'fetch-weather': {
          __temporalStepResult: true,
          status: 'success',
          payload: { city: 'SF' },
          output: { city: 'SF', weather: 'sunny' },
          startedAt: expect.any(Number),
          endedAt: expect.any(Number),
        },
      },
    });
  });

  it('executes a seeded sequential time-travel replacement from the target step', async () => {
    const first = vi.fn();
    const second = vi.fn(async ({ inputData }) => ({ value: inputData.value + 1 }));
    const third = vi.fn(async ({ inputData }) => ({ value: inputData.value + 1 }));
    proxyActivities.mockReturnValue({ first, second, third });

    const seededFirst = {
      __temporalStepResult: true,
      status: 'success',
      payload: { value: 1 },
      output: { value: 2 },
      startedAt: 1,
      endedAt: 2,
    };
    const { createWorkflow } = await import('./temporal-workflow-runtime.mjs');
    const workflow = createWorkflow('time-travel-workflow').then('first').then('second').then('third').commit();
    const result = await workflow({
      inputData: { value: 100 },
      initialState: { preserved: true },
      runId: 'run-1',
      timeTravel: {
        inputData: { value: 20 },
        state: { preserved: true },
        executionPath: [1],
        steps: ['second'],
        stepResults: {
          input: { value: 1 },
          first: seededFirst,
          second: { status: 'running', payload: { value: 2 }, startedAt: 3 },
        },
      },
      timeTravelLineage: {
        previousTemporalRunId: 'temporal-run-1',
        target: ['second'],
      },
    });

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledWith({
      inputData: { value: 20 },
      initData: { value: 20 },
      runId: 'run-1',
      workflowId: 'time-travel-workflow',
    });
    expect(third).toHaveBeenCalledWith({
      inputData: { value: 21 },
      initData: { value: 20 },
      runId: 'run-1',
      workflowId: 'time-travel-workflow',
    });
    expect(result).toEqual({
      status: 'success',
      input: { value: 20 },
      result: { value: 22 },
      state: { preserved: true },
      steps: {
        input: { value: 1 },
        first: seededFirst,
        second: succeeded({ value: 21 }),
        third: succeeded({ value: 22 }),
      },
    });
  });

  it('allows a seeded time-travel replacement to suspend and resume', async () => {
    const first = vi.fn();
    const approval = vi
      .fn()
      .mockResolvedValueOnce({ __temporalSuspension: true, suspendPayload: { reason: 'review again' } })
      .mockResolvedValueOnce({ approved: true });
    proxyActivities.mockReturnValue({ first, approval });

    const { createWorkflow } = await import('./temporal-workflow-runtime.mjs');
    const workflow = createWorkflow('time-travel-workflow').then('first').then('approval').commit();
    const run = workflow({
      inputData: { orderId: 'replacement' },
      runId: 'run-1',
      timeTravel: {
        inputData: { orderId: 'original' },
        state: { attempts: 1 },
        executionPath: [1],
        steps: ['approval'],
        stepResults: {
          input: { orderId: 'original' },
          first: {
            status: 'success',
            payload: { orderId: 'original' },
            output: { orderId: 'order-1' },
            startedAt: 1,
            endedAt: 2,
          },
          approval: { status: 'running', payload: { orderId: 'order-1' }, startedAt: 3 },
        },
      },
    });

    await vi.waitFor(() => expect(condition).toHaveBeenCalledOnce());
    expect(first).not.toHaveBeenCalled();
    expect(approval).toHaveBeenCalledTimes(1);

    const statusHandler = setHandler.mock.calls.find(([name]) => name === 'mastra.status')?.[1];
    expect(statusHandler?.()).toMatchObject({
      status: 'suspended',
      state: { attempts: 1 },
      suspended: [['approval']],
      steps: {
        first: expect.objectContaining({ status: 'success' }),
        approval: expect.objectContaining({ status: 'suspended' }),
      },
    });

    signalHandlers.get('mastra.resume')?.({ step: 'approval', resumeData: { approved: true } });
    await expect(run).resolves.toMatchObject({
      status: 'success',
      result: { approved: true },
      state: { attempts: 1 },
      steps: {
        first: expect.objectContaining({ status: 'success' }),
        approval: expect.objectContaining({ status: 'success', resumeData: { approved: true } }),
      },
    });
  });

  it.each([
    { name: 'parallel', executionPath: [0, 0] },
    { name: 'conditional', executionPath: [0, 0] },
    { name: 'loop', executionPath: [0, 0] },
    { name: 'foreach', executionPath: [0] },
  ])('rejects a seeded time-travel target inside $name control flow non-retryably', async ({ name, executionPath }) => {
    proxyActivities.mockReturnValue({ target: vi.fn(), condition: vi.fn() });
    const { createWorkflow } = await import('./temporal-workflow-runtime.mjs');
    const base = createWorkflow('time-travel-workflow');
    const workflow =
      name === 'parallel'
        ? base.parallel([{ type: 'step', step: { id: 'target' } }]).commit()
        : name === 'conditional'
          ? base.branch([['condition', 'target']]).commit()
          : name === 'loop'
            ? base.dowhile('target', 'condition').commit()
            : base.foreach('target').commit();

    await expect(
      workflow({
        inputData: { value: 1 },
        timeTravel: {
          inputData: { value: 1 },
          state: {},
          executionPath,
          steps: ['target'],
          stepResults: { target: { status: 'running', payload: { value: 1 }, startedAt: 1 } },
        },
      }),
    ).rejects.toMatchObject({ nonRetryable: true });
    expect(nonRetryable).toHaveBeenCalledWith(
      'Temporal time travel currently supports only top-level sequential step targets.',
    );
  });

  it('rejects malformed seeded execution paths before running activities', async () => {
    const first = vi.fn();
    proxyActivities.mockReturnValue({ first });

    const { createWorkflow } = await import('./temporal-workflow-runtime.mjs');
    const workflow = createWorkflow('time-travel-workflow').then('first').commit();

    await expect(
      workflow({
        inputData: { value: 1 },
        timeTravel: {
          inputData: { value: 1 },
          state: {},
          executionPath: [4],
          steps: ['first'],
          stepResults: { first: { status: 'running', payload: { value: 1 }, startedAt: 1 } },
        },
      }),
    ).rejects.toMatchObject({ nonRetryable: true });
    expect(first).not.toHaveBeenCalled();
  });

  it('durably waits for a resume signal when a step suspends', async () => {
    const approval = vi
      .fn()
      .mockResolvedValueOnce({
        __temporalSuspension: true,
        suspendPayload: { reason: 'needs approval' },
      })
      .mockResolvedValueOnce({ approved: true });
    proxyActivities.mockReturnValue({ approval });

    const { createWorkflow } = await import('./temporal-workflow-runtime.mjs');
    const workflow = createWorkflow('approval-workflow').then('approval').commit();
    const run = workflow({ inputData: { orderId: 'order-1' }, runId: 'run-1' });

    await vi.waitFor(() => expect(condition).toHaveBeenCalledOnce());
    expect(approval).toHaveBeenCalledTimes(1);
    expect(setHandler).toHaveBeenCalledWith('mastra.resume', expect.any(Function));

    signalHandlers.get('mastra.resume')?.({ step: 'approval', resumeData: { approved: true } });

    await expect(run).resolves.toMatchObject({
      status: 'success',
      result: { approved: true },
      steps: {
        approval: expect.objectContaining({
          status: 'success',
          payload: { orderId: 'order-1' },
          output: { approved: true },
          suspendPayload: { reason: 'needs approval' },
          resumeData: { approved: true },
        }),
      },
    });
    expect(approval).toHaveBeenNthCalledWith(2, {
      inputData: { orderId: 'order-1' },
      initData: { orderId: 'order-1' },
      resumeData: { approved: true },
      runId: 'run-1',
      workflowId: 'approval-workflow',
    });
  });

  it('waits again when a resumed step suspends again', async () => {
    const approval = vi
      .fn()
      .mockResolvedValueOnce({
        __temporalSuspension: true,
        suspendPayload: { reason: 'first review' },
      })
      .mockResolvedValueOnce({
        __temporalSuspension: true,
        suspendPayload: { reason: 'second review' },
      })
      .mockResolvedValueOnce({ approved: true });
    proxyActivities.mockReturnValue({ approval });

    const { createWorkflow } = await import('./temporal-workflow-runtime.mjs');
    const workflow = createWorkflow('approval-workflow').then('approval').commit();
    const run = workflow({ inputData: { orderId: 'order-1' }, runId: 'run-1' });

    await vi.waitFor(() => expect(condition).toHaveBeenCalledTimes(1));
    signalHandlers.get('mastra.resume')?.({ step: 'approval', resumeData: { attempt: 1 } });
    await vi.waitFor(() => expect(condition).toHaveBeenCalledTimes(2));
    signalHandlers.get('mastra.resume')?.({ step: 'approval', resumeData: { approved: true } });

    await expect(run).resolves.toMatchObject({
      status: 'success',
      result: { approved: true },
      steps: {
        approval: expect.objectContaining({
          status: 'success',
          output: { approved: true },
          suspendPayload: { reason: 'second review' },
          resumeData: { approved: true },
        }),
      },
    });
    expect(approval).toHaveBeenNthCalledWith(2, expect.objectContaining({ resumeData: { attempt: 1 } }));
    expect(approval).toHaveBeenNthCalledWith(3, expect.objectContaining({ resumeData: { approved: true } }));
  });

  it('preserves resume signals per concurrently suspended step', async () => {
    const approval = vi
      .fn()
      .mockResolvedValueOnce({ __temporalSuspension: true, suspendPayload: { reason: 'approval' } })
      .mockResolvedValueOnce({ approved: true });
    const review = vi
      .fn()
      .mockResolvedValueOnce({ __temporalSuspension: true, suspendPayload: { reason: 'review' } })
      .mockResolvedValueOnce({ reviewed: true });
    proxyActivities.mockReturnValue({ approval, review });

    const { createWorkflow } = await import('./temporal-workflow-runtime.mjs');
    const workflow = createWorkflow('approval-workflow')
      .parallel([
        { type: 'step', step: { id: 'approval' } },
        { type: 'step', step: { id: 'review' } },
      ])
      .commit();
    const run = workflow({ inputData: { orderId: 'order-1' }, runId: 'run-1' });

    signalHandlers.get('mastra.resume')?.({ step: 'approval', resumeData: { stale: true } });
    await vi.waitFor(() => expect(condition).toHaveBeenCalledTimes(2));
    signalHandlers.get('mastra.resume')?.({ step: 'approval', resumeData: { approved: true } });
    signalHandlers.get('mastra.resume')?.({ step: 'approval', resumeData: { duplicate: true } });
    signalHandlers.get('mastra.resume')?.({ step: 'review', resumeData: { reviewed: true } });

    await expect(run).resolves.toMatchObject({
      status: 'success',
      result: {
        approval: { approved: true },
        review: { reviewed: true },
      },
      steps: {
        approval: expect.objectContaining({ resumeData: { approved: true } }),
        review: expect.objectContaining({ resumeData: { reviewed: true } }),
      },
    });
    expect(approval).toHaveBeenNthCalledWith(2, expect.objectContaining({ resumeData: { approved: true } }));
    expect(review).toHaveBeenNthCalledWith(2, expect.objectContaining({ resumeData: { reviewed: true } }));
  });

  it('routes keyless and labeled resume signals to active suspended steps', async () => {
    const approval = vi
      .fn()
      .mockResolvedValueOnce({
        __temporalSuspension: true,
        suspendPayload: { reason: 'approval' },
        resumeLabels: { approveOrder: { stepId: 'approval' } },
      })
      .mockResolvedValueOnce({ first: true })
      .mockResolvedValueOnce({
        __temporalSuspension: true,
        suspendPayload: { reason: 'second approval' },
        resumeLabels: { approveOrder: { stepId: 'approval' } },
      })
      .mockResolvedValueOnce({ second: true });
    proxyActivities.mockReturnValue({ approval });

    const { createWorkflow } = await import('./temporal-workflow-runtime.mjs');
    const workflow = createWorkflow('approval-workflow').then('approval').commit();

    const firstRun = workflow({ inputData: { orderId: 'order-1' } });
    await vi.waitFor(() => expect(condition).toHaveBeenCalledTimes(1));
    signalHandlers.get('mastra.resume')?.({ resumeData: { first: true } });
    await expect(firstRun).resolves.toMatchObject({ result: { first: true } });

    const secondRun = workflow({ inputData: { orderId: 'order-2' } });
    await vi.waitFor(() => expect(condition).toHaveBeenCalledTimes(2));
    signalHandlers.get('mastra.resume')?.({ label: 'approveOrder', resumeData: { second: true } });
    await expect(secondRun).resolves.toMatchObject({ result: { second: true } });
  });

  it('reports all currently suspended parallel steps in status queries', async () => {
    const approval = vi
      .fn()
      .mockResolvedValueOnce({ __temporalSuspension: true, suspendPayload: { reason: 'approval' } })
      .mockResolvedValueOnce({ approved: true });
    const review = vi
      .fn()
      .mockResolvedValueOnce({ __temporalSuspension: true, suspendPayload: { reason: 'review' } })
      .mockResolvedValueOnce({ reviewed: true });
    proxyActivities.mockReturnValue({ approval, review });

    const { createWorkflow } = await import('./temporal-workflow-runtime.mjs');
    const workflow = createWorkflow('approval-workflow')
      .parallel([
        { type: 'step', step: { id: 'approval' } },
        { type: 'step', step: { id: 'review' } },
      ])
      .commit();
    const run = workflow({ inputData: { orderId: 'order-1' } });

    await vi.waitFor(() => expect(condition).toHaveBeenCalledTimes(2));
    expect(signalHandlers.get('mastra.status')?.()).toMatchObject({
      status: 'suspended',
      suspended: expect.arrayContaining([['approval'], ['review']]),
      suspendPayload: {
        approval: { reason: 'approval' },
        review: { reason: 'review' },
      },
    });

    signalHandlers.get('mastra.resume')?.({ step: 'approval', resumeData: { approved: true } });
    await vi.waitFor(() => expect(approval).toHaveBeenCalledTimes(2));
    expect(signalHandlers.get('mastra.status')?.()).toMatchObject({
      status: 'suspended',
      suspended: [['review']],
      suspendPayload: { review: { reason: 'review' } },
    });

    signalHandlers.get('mastra.resume')?.({ step: 'review', resumeData: { reviewed: true } });
    await expect(run).resolves.toMatchObject({ status: 'success' });
  });

  it('fails non-retryably when a foreach item suspends', async () => {
    const approveItem = vi.fn().mockResolvedValue({ __temporalSuspension: true, suspendPayload: { reason: 'item' } });
    proxyActivities.mockReturnValue({ approveItem });

    const { createWorkflow } = await import('./temporal-workflow-runtime.mjs');
    const workflow = createWorkflow('approval-workflow').foreach('approveItem').commit();

    await expect(workflow({ inputData: [{ id: 1 }] })).rejects.toMatchObject({
      message: 'Temporal workflows do not support suspending inside foreach steps yet.',
      nonRetryable: true,
    });
    expect(nonRetryable).toHaveBeenCalledWith('Temporal workflows do not support suspending inside foreach steps yet.');
  });

  it('fails non-retryably when a child workflow suspends', async () => {
    proxyActivities.mockReturnValue({});
    executeChild.mockResolvedValue({ status: 'suspended', suspended: [['approval']] });

    const { createWorkflow } = await import('./temporal-workflow-runtime.mjs');
    const workflow = createWorkflow('parent-workflow').thenWorkflow('child-workflow').commit();

    await expect(workflow({ inputData: { orderId: 'order-1' } })).rejects.toMatchObject({
      message: 'Temporal workflows do not support suspending inside child workflows yet.',
      nonRetryable: true,
    });
    expect(nonRetryable).toHaveBeenCalledWith(
      'Temporal workflows do not support suspending inside child workflows yet.',
    );
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
      workflowId: 'mapped-workflow',
    });
    expect(result).toEqual({
      status: 'success',
      input: { value: 21 },
      result: { doubled: 42, initialValue: 21 },
      state: undefined,
      steps: {
        [mappingId]: succeeded({ doubled: 42, initialValue: 21 }),
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

  it.each([1, 5, 0])('forwards an activity retry policy with maximumAttempts %s', async maximumAttempts => {
    const retry = {
      initialInterval: '5 seconds',
      backoffCoefficient: 2,
      maximumInterval: '5 minutes',
      maximumAttempts,
      nonRetryableErrorTypes: ['ValidationError'],
    };
    const failure = new Error('permanent failure');
    const failingStep = vi.fn().mockRejectedValue(failure);
    proxyActivities.mockReturnValue({ failing: failingStep });

    const { createWorkflow } = await import('./temporal-workflow-runtime.mjs');
    const workflow = createWorkflow('failing-workflow', { retry }).then('failing').commit();

    await expect(workflow({ inputData: {} })).rejects.toBe(failure);
    expect(proxyActivities).toHaveBeenCalledWith({ startToCloseTimeout: '1 minute', retry });
    expect(failingStep).toHaveBeenCalledTimes(1);
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
          workflowId: 'weather-workflow',
        },
      ],
    });
    expect(result).toEqual({
      status: 'success',
      input: { city: 'SF' },
      result: { city: 'SF', child: true },
      state: undefined,
      steps: {
        childWorkflow: succeeded({ city: 'SF', child: true }),
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

    expect(first).toHaveBeenCalledWith({
      inputData: { value: 1 },
      initData: { value: 1 },
      workflowId: 'parallel-workflow',
    });
    expect(second).toHaveBeenCalledWith({
      inputData: { value: 1 },
      initData: { value: 1 },
      workflowId: 'parallel-workflow',
    });
    expect(result).toEqual({
      status: 'success',
      input: { value: 1 },
      result: {
        first: { first: 2 },
        second: { second: 3 },
      },
      state: undefined,
      steps: {
        first: succeeded({ first: 2 }),
        second: succeeded({ second: 3 }),
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
      args: [{ inputData: { value: 'parent-input' }, workflowId: 'parallel-child-workflow' }],
    });
    expect(result).toEqual({
      status: 'success',
      input: { value: 'parent-input' },
      result: {
        childWorkflow: { value: 'child-output' },
      },
      state: undefined,
      steps: {
        childWorkflow: succeeded({ value: 'child-output' }),
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

    expect(activity).toHaveBeenCalledWith({
      inputData: { value: 'parent-input' },
      initData: { value: 'parent-input' },
      workflowId: 'mixed-parallel-workflow',
    });
    expect(executeChild).toHaveBeenCalledWith('childWorkflow', {
      args: [{ inputData: { value: 'parent-input' }, workflowId: 'mixed-parallel-workflow' }],
    });
    expect(result).toMatchObject({
      result: {
        activity: { value: 'parent-input-activity' },
        childWorkflow: { value: 'child-output' },
      },
      steps: {
        activity: succeeded({ value: 'parent-input-activity' }),
        childWorkflow: succeeded({ value: 'child-output' }),
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
    const initData = [{ value: 1 }, { value: 2 }, { value: 3 }];
    expect(map).toHaveBeenNthCalledWith(1, {
      inputData: { value: 1 },
      initData,
      workflowId: 'foreach-workflow',
    });
    expect(map).toHaveBeenNthCalledWith(2, {
      inputData: { value: 2 },
      initData,
      workflowId: 'foreach-workflow',
    });
    expect(map).toHaveBeenNthCalledWith(3, {
      inputData: { value: 3 },
      initData,
      workflowId: 'foreach-workflow',
    });
    expect(result).toMatchObject({
      result: [{ value: 11 }, { value: 12 }, { value: 13 }],
      steps: {
        map: succeeded([{ value: 11 }, { value: 12 }, { value: 13 }]),
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

    expect(isSmall).toHaveBeenCalledWith({ inputData: { value: 3 }, workflowId: 'branch-workflow' });
    expect(isLarge).toHaveBeenCalledWith({ inputData: { value: 3 }, workflowId: 'branch-workflow' });
    expect(smallStep).toHaveBeenCalledWith({
      inputData: { value: 3 },
      initData: { value: 3 },
      workflowId: 'branch-workflow',
    });
    expect(largeStep).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      result: {
        smallStep: { path: 'small', value: 3 },
      },
      steps: {
        smallStep: succeeded({ path: 'small', value: 3 }),
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
        incrementWhile: succeeded({ value: 2 }),
      },
    });
    await expect(doUntilWorkflow({ inputData: { value: 0 } })).resolves.toMatchObject({
      result: { value: 2 },
      steps: {
        incrementUntil: succeeded({ value: 2 }),
      },
    });
    expect(incrementWhile).toHaveBeenNthCalledWith(1, {
      inputData: { value: 0 },
      initData: { value: 0 },
      workflowId: 'dowhile-workflow',
    });
    expect(continueWhile).toHaveBeenNthCalledWith(1, {
      inputData: { value: 1 },
      workflowId: 'dowhile-workflow',
    });
    expect(incrementUntil).toHaveBeenNthCalledWith(1, {
      inputData: { value: 0 },
      initData: { value: 0 },
      workflowId: 'dountil-workflow',
    });
    expect(stopUntil).toHaveBeenNthCalledWith(1, {
      inputData: { value: 1 },
      workflowId: 'dountil-workflow',
    });
    expect(incrementWhile).toHaveBeenCalledTimes(2);
    expect(continueWhile).toHaveBeenCalledTimes(2);
    expect(incrementUntil).toHaveBeenCalledTimes(2);
    expect(stopUntil).toHaveBeenCalledTimes(2);
  });
});
