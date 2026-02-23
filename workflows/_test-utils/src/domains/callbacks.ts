/**
 * onFinish and onError callbacks tests for workflows
 *
 * Uses MockRegistry pattern to decouple mocks from workflow definitions,
 * enabling proper test isolation via resetMocks().
 */

import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import type { WorkflowTestContext, WorkflowRegistry, WorkflowCreatorContext } from '../types';
import { MockRegistry } from '../mock-registry';

/**
 * Create all workflows needed for callbacks tests.
 */
export function createCallbacksWorkflows(ctx: WorkflowCreatorContext) {
  const { createWorkflow, createStep } = ctx;
  const workflows: WorkflowRegistry = {};

  // Create a mock registry for this domain
  const mockRegistry = new MockRegistry();

  // Test: should call onFinish callback when workflow succeeds
  {
    // Register mock factories
    mockRegistry.register('callback-test-workflow:onFinish', () => vi.fn());
    mockRegistry.register('callback-test-workflow:execute', () => vi.fn().mockResolvedValue({ result: 'success' }));

    const step1 = createStep({
      id: 'step1',
      execute: async ctx => mockRegistry.get('callback-test-workflow:execute')(ctx),
      inputSchema: z.object({}),
      outputSchema: z.object({ result: z.string() }),
    });

    const workflow = createWorkflow({
      id: 'callback-test-workflow',
      inputSchema: z.object({}),
      outputSchema: z.object({ result: z.string() }),
      steps: [step1],
      options: {
        onFinish: (...args) => mockRegistry.get('callback-test-workflow:onFinish')(...args),
      },
    });

    workflow.then(step1).commit();

    workflows['callback-test-workflow'] = {
      workflow,
      mocks: {
        get onFinishCallback() {
          return mockRegistry.get('callback-test-workflow:onFinish');
        },
      },
      resetMocks: () => mockRegistry.reset(),
    };
  }

  // Test: should call onError callback when workflow fails
  {
    // Register mock factories
    mockRegistry.register('error-callback-test-workflow:onError', () => vi.fn());
    mockRegistry.register('error-callback-test-workflow:execute', () =>
      vi.fn().mockRejectedValue(new Error('Test error')),
    );

    const step1 = createStep({
      id: 'step1',
      execute: async ctx => mockRegistry.get('error-callback-test-workflow:execute')(ctx),
      inputSchema: z.object({}),
      outputSchema: z.object({ result: z.string() }),
    });

    const workflow = createWorkflow({
      id: 'error-callback-test-workflow',
      inputSchema: z.object({}),
      outputSchema: z.object({ result: z.string() }),
      steps: [step1],
      options: {
        onError: (...args) => mockRegistry.get('error-callback-test-workflow:onError')(...args),
      },
    });

    workflow.then(step1).commit();

    workflows['error-callback-test-workflow'] = {
      workflow,
      mocks: {
        get onErrorCallback() {
          return mockRegistry.get('error-callback-test-workflow:onError');
        },
      },
      resetMocks: () => mockRegistry.reset(),
    };
  }

  // Test: should pass workflow result to onFinish callback
  {
    // Register mock factories
    mockRegistry.register('result-callback-workflow:receivedResult', () => vi.fn());
    mockRegistry.register('result-callback-workflow:execute', () => vi.fn().mockResolvedValue({ value: 'test-value' }));

    const step1 = createStep({
      id: 'step1',
      execute: async ctx => mockRegistry.get('result-callback-workflow:execute')(ctx),
      inputSchema: z.object({}),
      outputSchema: z.object({ value: z.string() }),
    });

    const workflow = createWorkflow({
      id: 'result-callback-workflow',
      inputSchema: z.object({}),
      outputSchema: z.object({ value: z.string() }),
      steps: [step1],
      options: {
        onFinish: result => {
          mockRegistry.get('result-callback-workflow:receivedResult')(result);
        },
      },
    });

    workflow.then(step1).commit();

    workflows['result-callback-workflow'] = {
      workflow,
      mocks: {},
      getReceivedResult: () => {
        const mock = mockRegistry.get('result-callback-workflow:receivedResult');
        return mock.mock.calls.length > 0 ? mock.mock.calls[0]![0] : undefined;
      },
      resetMocks: () => mockRegistry.reset(),
    };
  }

  // Test: should not call onError callback when workflow succeeds
  {
    // Register mock factories
    mockRegistry.register('no-error-callback-workflow:onError', () => vi.fn());
    mockRegistry.register('no-error-callback-workflow:execute', () => vi.fn().mockResolvedValue({ result: 'success' }));

    const step1 = createStep({
      id: 'step1',
      execute: async (ctx: any) => mockRegistry.get('no-error-callback-workflow:execute')(ctx),
      inputSchema: z.object({}),
      outputSchema: z.object({ result: z.string() }),
    });

    const workflow = createWorkflow({
      id: 'no-error-callback-workflow',
      inputSchema: z.object({}),
      outputSchema: z.object({ result: z.string() }),
      steps: [step1],
      options: {
        onError: (...args: any[]) => mockRegistry.get('no-error-callback-workflow:onError')(...args),
      },
    });

    workflow.then(step1).commit();

    workflows['no-error-callback-workflow'] = {
      workflow,
      mocks: {
        get onErrorCallback() {
          return mockRegistry.get('no-error-callback-workflow:onError');
        },
      },
      resetMocks: () => mockRegistry.reset(),
    };
  }

  // Test: should call both onFinish and onError when workflow fails
  {
    // Register mock factories
    mockRegistry.register('both-callbacks-workflow:onFinish', () => vi.fn());
    mockRegistry.register('both-callbacks-workflow:onError', () => vi.fn());
    mockRegistry.register('both-callbacks-workflow:execute', () =>
      vi.fn().mockRejectedValue(new Error('Step execution failed')),
    );

    const failingStep = createStep({
      id: 'failing-step',
      execute: async (ctx: any) => mockRegistry.get('both-callbacks-workflow:execute')(ctx),
      inputSchema: z.object({}),
      outputSchema: z.object({}),
    });

    const workflow = createWorkflow({
      id: 'both-callbacks-workflow',
      inputSchema: z.object({}),
      outputSchema: z.object({}),
      steps: [failingStep],
      options: {
        onFinish: (...args: any[]) => mockRegistry.get('both-callbacks-workflow:onFinish')(...args),
        onError: (...args: any[]) => mockRegistry.get('both-callbacks-workflow:onError')(...args),
      },
    });

    workflow.then(failingStep).commit();

    workflows['both-callbacks-workflow'] = {
      workflow,
      mocks: {
        get onFinishCallback() {
          return mockRegistry.get('both-callbacks-workflow:onFinish');
        },
        get onErrorCallback() {
          return mockRegistry.get('both-callbacks-workflow:onError');
        },
      },
      resetMocks: () => mockRegistry.reset(),
    };
  }

  // Test: should support async onFinish callback
  {
    // Track callback completion via closure
    const state = { callbackCompleted: false };

    // Register mock factories
    mockRegistry.register('async-onfinish-workflow:onFinish', () =>
      vi.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        state.callbackCompleted = true;
      }),
    );
    mockRegistry.register('async-onfinish-workflow:execute', () => vi.fn().mockResolvedValue({ result: 'success' }));

    const step1 = createStep({
      id: 'step1',
      execute: async (ctx: any) => mockRegistry.get('async-onfinish-workflow:execute')(ctx),
      inputSchema: z.object({}),
      outputSchema: z.object({ result: z.string() }),
    });

    const workflow = createWorkflow({
      id: 'async-onfinish-workflow',
      inputSchema: z.object({}),
      outputSchema: z.object({ result: z.string() }),
      steps: [step1],
      options: {
        onFinish: (...args: any[]) => mockRegistry.get('async-onfinish-workflow:onFinish')(...args),
      },
    });

    workflow.then(step1).commit();

    workflows['async-onfinish-workflow'] = {
      workflow,
      mocks: {
        get onFinishCallback() {
          return mockRegistry.get('async-onfinish-workflow:onFinish');
        },
      },
      getCallbackCompleted: () => state.callbackCompleted,
      resetMocks: () => {
        state.callbackCompleted = false;
        mockRegistry.reset();
      },
    };
  }

  // Test: should support async onError callback
  {
    // Track callback completion via closure
    const state = { callbackCompleted: false };

    // Register mock factories
    mockRegistry.register('async-onerror-workflow:onError', () =>
      vi.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        state.callbackCompleted = true;
      }),
    );
    mockRegistry.register('async-onerror-workflow:execute', () =>
      vi.fn().mockRejectedValue(new Error('Step execution failed')),
    );

    const failingStep = createStep({
      id: 'failing-step',
      execute: async (ctx: any) => mockRegistry.get('async-onerror-workflow:execute')(ctx),
      inputSchema: z.object({}),
      outputSchema: z.object({}),
    });

    const workflow = createWorkflow({
      id: 'async-onerror-workflow',
      inputSchema: z.object({}),
      outputSchema: z.object({}),
      steps: [failingStep],
      options: {
        onError: (...args: any[]) => mockRegistry.get('async-onerror-workflow:onError')(...args),
      },
    });

    workflow.then(failingStep).commit();

    workflows['async-onerror-workflow'] = {
      workflow,
      mocks: {
        get onErrorCallback() {
          return mockRegistry.get('async-onerror-workflow:onError');
        },
      },
      getCallbackCompleted: () => state.callbackCompleted,
      resetMocks: () => {
        state.callbackCompleted = false;
        mockRegistry.reset();
      },
    };
  }

  // Test: should provide runId in onFinish callback
  {
    mockRegistry.register('callback-runid-workflow:receivedRunId', () => vi.fn());
    mockRegistry.register('callback-runid-workflow:execute', () => vi.fn().mockResolvedValue({ result: 'success' }));

    const step1 = createStep({
      id: 'step1',
      execute: async (ctx: any) => mockRegistry.get('callback-runid-workflow:execute')(ctx),
      inputSchema: z.object({}),
      outputSchema: z.object({ result: z.string() }),
    });

    const workflow = createWorkflow({
      id: 'callback-runid-workflow',
      inputSchema: z.object({}),
      outputSchema: z.object({ result: z.string() }),
      steps: [step1],
      options: {
        onFinish: (result: any) => {
          mockRegistry.get('callback-runid-workflow:receivedRunId')(result.runId);
        },
      },
    });

    workflow.then(step1).commit();

    workflows['callback-runid-workflow'] = {
      workflow,
      mocks: {},
      getReceivedRunId: () => {
        const mock = mockRegistry.get('callback-runid-workflow:receivedRunId');
        return mock.mock.calls.length > 0 ? mock.mock.calls[0]![0] : undefined;
      },
      resetMocks: () => mockRegistry.reset(),
    };
  }

  // Test: should provide workflowId in onFinish callback
  {
    mockRegistry.register('callback-workflowid-workflow:receivedWorkflowId', () => vi.fn());
    mockRegistry.register('callback-workflowid-workflow:execute', () =>
      vi.fn().mockResolvedValue({ result: 'success' }),
    );

    const step1 = createStep({
      id: 'step1',
      execute: async (ctx: any) => mockRegistry.get('callback-workflowid-workflow:execute')(ctx),
      inputSchema: z.object({}),
      outputSchema: z.object({ result: z.string() }),
    });

    const workflow = createWorkflow({
      id: 'callback-workflowid-workflow',
      inputSchema: z.object({}),
      outputSchema: z.object({ result: z.string() }),
      steps: [step1],
      options: {
        onFinish: (result: any) => {
          mockRegistry.get('callback-workflowid-workflow:receivedWorkflowId')(result.workflowId);
        },
      },
    });

    workflow.then(step1).commit();

    workflows['callback-workflowid-workflow'] = {
      workflow,
      mocks: {},
      getReceivedWorkflowId: () => {
        const mock = mockRegistry.get('callback-workflowid-workflow:receivedWorkflowId');
        return mock.mock.calls.length > 0 ? mock.mock.calls[0]![0] : undefined;
      },
      resetMocks: () => mockRegistry.reset(),
    };
  }

  // Test: should provide state in onFinish callback
  {
    mockRegistry.register('callback-state-workflow:receivedState', () => vi.fn());
    mockRegistry.register('callback-state-workflow:execute', () =>
      vi.fn().mockImplementation(async ({ state, setState }: any) => {
        await setState({ ...state, counter: (state?.counter || 0) + 1 });
        return { result: 'success' };
      }),
    );

    const step1 = createStep({
      id: 'step1',
      execute: async (ctx: any) => mockRegistry.get('callback-state-workflow:execute')(ctx),
      inputSchema: z.object({}),
      outputSchema: z.object({ result: z.string() }),
      stateSchema: z.object({ counter: z.number() }),
    });

    const workflow = createWorkflow({
      id: 'callback-state-workflow',
      inputSchema: z.object({}),
      outputSchema: z.object({ result: z.string() }),
      stateSchema: z.object({ counter: z.number() }),
      steps: [step1],
      options: {
        onFinish: (result: any) => {
          mockRegistry.get('callback-state-workflow:receivedState')(result.state);
        },
      },
    });

    workflow.then(step1).commit();

    workflows['callback-state-workflow'] = {
      workflow,
      mocks: {},
      getReceivedState: () => {
        const mock = mockRegistry.get('callback-state-workflow:receivedState');
        return mock.mock.calls.length > 0 ? mock.mock.calls[0]![0] : undefined;
      },
      resetMocks: () => mockRegistry.reset(),
    };
  }

  // Test: should provide resourceId in onFinish callback when provided
  {
    mockRegistry.register('callback-resourceid-workflow:receivedResourceId', () => vi.fn());
    mockRegistry.register('callback-resourceid-workflow:execute', () =>
      vi.fn().mockResolvedValue({ result: 'success' }),
    );

    const step1 = createStep({
      id: 'step1',
      execute: async (ctx: any) => mockRegistry.get('callback-resourceid-workflow:execute')(ctx),
      inputSchema: z.object({}),
      outputSchema: z.object({ result: z.string() }),
    });

    const workflow = createWorkflow({
      id: 'callback-resourceid-workflow',
      inputSchema: z.object({}),
      outputSchema: z.object({ result: z.string() }),
      steps: [step1],
      options: {
        onFinish: (result: any) => {
          mockRegistry.get('callback-resourceid-workflow:receivedResourceId')(result.resourceId);
        },
      },
    });

    workflow.then(step1).commit();

    workflows['callback-resourceid-workflow'] = {
      workflow,
      mocks: {},
      getReceivedResourceId: () => {
        const mock = mockRegistry.get('callback-resourceid-workflow:receivedResourceId');
        return mock.mock.calls.length > 0 ? mock.mock.calls[0]![0] : undefined;
      },
      resetMocks: () => mockRegistry.reset(),
    };
  }

  // Test: should provide runId in onError callback
  {
    mockRegistry.register('callback-error-runid-workflow:receivedRunId', () => vi.fn());
    mockRegistry.register('callback-error-runid-workflow:execute', () =>
      vi.fn().mockRejectedValue(new Error('Test error')),
    );

    const step1 = createStep({
      id: 'step1',
      execute: async (ctx: any) => mockRegistry.get('callback-error-runid-workflow:execute')(ctx),
      inputSchema: z.object({}),
      outputSchema: z.object({ result: z.string() }),
    });

    const workflow = createWorkflow({
      id: 'callback-error-runid-workflow',
      inputSchema: z.object({}),
      outputSchema: z.object({ result: z.string() }),
      steps: [step1],
      options: {
        onError: (result: any) => {
          mockRegistry.get('callback-error-runid-workflow:receivedRunId')(result.runId);
        },
      },
    });

    workflow.then(step1).commit();

    workflows['callback-error-runid-workflow'] = {
      workflow,
      mocks: {},
      getReceivedRunId: () => {
        const mock = mockRegistry.get('callback-error-runid-workflow:receivedRunId');
        return mock.mock.calls.length > 0 ? mock.mock.calls[0]![0] : undefined;
      },
      resetMocks: () => mockRegistry.reset(),
    };
  }

  // Test: should provide workflowId in onError callback
  {
    mockRegistry.register('callback-error-workflowid-workflow:receivedWorkflowId', () => vi.fn());
    mockRegistry.register('callback-error-workflowid-workflow:execute', () =>
      vi.fn().mockRejectedValue(new Error('Test error')),
    );

    const step1 = createStep({
      id: 'step1',
      execute: async (ctx: any) => mockRegistry.get('callback-error-workflowid-workflow:execute')(ctx),
      inputSchema: z.object({}),
      outputSchema: z.object({ result: z.string() }),
    });

    const workflow = createWorkflow({
      id: 'callback-error-workflowid-workflow',
      inputSchema: z.object({}),
      outputSchema: z.object({ result: z.string() }),
      steps: [step1],
      options: {
        onError: (result: any) => {
          mockRegistry.get('callback-error-workflowid-workflow:receivedWorkflowId')(result.workflowId);
        },
      },
    });

    workflow.then(step1).commit();

    workflows['callback-error-workflowid-workflow'] = {
      workflow,
      mocks: {},
      getReceivedWorkflowId: () => {
        const mock = mockRegistry.get('callback-error-workflowid-workflow:receivedWorkflowId');
        return mock.mock.calls.length > 0 ? mock.mock.calls[0]![0] : undefined;
      },
      resetMocks: () => mockRegistry.reset(),
    };
  }

  // Test: should call onFinish with suspended status when workflow suspends
  {
    mockRegistry.register('callback-suspended-workflow:receivedStatus', () => vi.fn());
    mockRegistry.register('callback-suspended-workflow:execute', () =>
      vi.fn().mockImplementation(async ({ suspend }: any) => {
        return suspend({ reason: 'waiting' });
      }),
    );

    const step1 = createStep({
      id: 'step1',
      execute: async (ctx: any) => mockRegistry.get('callback-suspended-workflow:execute')(ctx),
      inputSchema: z.object({}),
      outputSchema: z.object({ result: z.string() }),
      suspendSchema: z.object({ reason: z.string() }),
    });

    const workflow = createWorkflow({
      id: 'callback-suspended-workflow',
      inputSchema: z.object({}),
      outputSchema: z.object({ result: z.string() }),
      steps: [step1],
      options: {
        onFinish: (result: any) => {
          mockRegistry.get('callback-suspended-workflow:receivedStatus')(result.status);
        },
      },
    });

    workflow.then(step1).commit();

    workflows['callback-suspended-workflow'] = {
      workflow,
      mocks: {},
      getReceivedStatus: () => {
        const mock = mockRegistry.get('callback-suspended-workflow:receivedStatus');
        return mock.mock.calls.length > 0 ? mock.mock.calls[0]![0] : undefined;
      },
      resetMocks: () => mockRegistry.reset(),
    };
  }

  // Test: should provide getInitData function in onFinish callback
  {
    mockRegistry.register('callback-getinitdata-workflow:receivedInitData', () => vi.fn());
    mockRegistry.register('callback-getinitdata-workflow:execute', () =>
      vi.fn().mockResolvedValue({ result: 'success' }),
    );

    const step1 = createStep({
      id: 'step1',
      execute: async ctx => mockRegistry.get('callback-getinitdata-workflow:execute')(ctx),
      inputSchema: z.object({ userId: z.string() }),
      outputSchema: z.object({ result: z.string() }),
    });

    const workflow = createWorkflow({
      id: 'callback-getinitdata-workflow',
      inputSchema: z.object({ userId: z.string() }),
      outputSchema: z.object({ result: z.string() }),
      steps: [step1],
      options: {
        onFinish: result => {
          const initData = result.getInitData();
          mockRegistry.get('callback-getinitdata-workflow:receivedInitData')(initData);
        },
      },
    });

    workflow.then(step1).commit();

    workflows['callback-getinitdata-workflow'] = {
      workflow,
      mocks: {},
      getReceivedInitData: () => {
        const mock = mockRegistry.get('callback-getinitdata-workflow:receivedInitData');
        return mock.mock.calls.length > 0 ? mock.mock.calls[0]![0] : undefined;
      },
      resetMocks: () => mockRegistry.reset(),
    };
  }

  // Test: should provide getInitData function in onError callback
  {
    mockRegistry.register('callback-getinitdata-error-workflow:receivedInitData', () => vi.fn());
    mockRegistry.register('callback-getinitdata-error-workflow:execute', () =>
      vi.fn().mockRejectedValue(new Error('Test error')),
    );

    const step1 = createStep({
      id: 'step1',
      execute: async ctx => mockRegistry.get('callback-getinitdata-error-workflow:execute')(ctx),
      inputSchema: z.object({ userId: z.string() }),
      outputSchema: z.object({ result: z.string() }),
    });

    const workflow = createWorkflow({
      id: 'callback-getinitdata-error-workflow',
      inputSchema: z.object({ userId: z.string() }),
      outputSchema: z.object({ result: z.string() }),
      steps: [step1],
      options: {
        onError: errorInfo => {
          const initData = errorInfo.getInitData();
          mockRegistry.get('callback-getinitdata-error-workflow:receivedInitData')(initData);
        },
      },
    });

    workflow.then(step1).commit();

    workflows['callback-getinitdata-error-workflow'] = {
      workflow,
      mocks: {},
      getReceivedInitData: () => {
        const mock = mockRegistry.get('callback-getinitdata-error-workflow:receivedInitData');
        return mock.mock.calls.length > 0 ? mock.mock.calls[0]![0] : undefined;
      },
      resetMocks: () => mockRegistry.reset(),
    };
  }

  // Test: should provide logger in onFinish callback
  {
    mockRegistry.register('callback-logger-workflow:receivedLogger', () => vi.fn());
    mockRegistry.register('callback-logger-workflow:execute', () => vi.fn().mockResolvedValue({ result: 'success' }));

    const step1 = createStep({
      id: 'step1',
      execute: async ctx => mockRegistry.get('callback-logger-workflow:execute')(ctx),
      inputSchema: z.object({}),
      outputSchema: z.object({ result: z.string() }),
    });

    const workflow = createWorkflow({
      id: 'callback-logger-workflow',
      inputSchema: z.object({}),
      outputSchema: z.object({ result: z.string() }),
      steps: [step1],
      options: {
        onFinish: result => {
          mockRegistry.get('callback-logger-workflow:receivedLogger')(result.logger);
        },
      },
    });

    workflow.then(step1).commit();

    workflows['callback-logger-workflow'] = {
      workflow,
      mocks: {},
      getReceivedLogger: () => {
        const mock = mockRegistry.get('callback-logger-workflow:receivedLogger');
        return mock.mock.calls.length > 0 ? mock.mock.calls[0]![0] : undefined;
      },
      resetMocks: () => mockRegistry.reset(),
    };
  }

  // Test: should provide logger in onError callback
  {
    mockRegistry.register('callback-logger-error-workflow:receivedLogger', () => vi.fn());
    mockRegistry.register('callback-logger-error-workflow:execute', () =>
      vi.fn().mockRejectedValue(new Error('Test error')),
    );

    const step1 = createStep({
      id: 'step1',
      execute: async ctx => mockRegistry.get('callback-logger-error-workflow:execute')(ctx),
      inputSchema: z.object({}),
      outputSchema: z.object({ result: z.string() }),
    });

    const workflow = createWorkflow({
      id: 'callback-logger-error-workflow',
      inputSchema: z.object({}),
      outputSchema: z.object({ result: z.string() }),
      steps: [step1],
      options: {
        onError: errorInfo => {
          mockRegistry.get('callback-logger-error-workflow:receivedLogger')(errorInfo.logger);
        },
      },
    });

    workflow.then(step1).commit();

    workflows['callback-logger-error-workflow'] = {
      workflow,
      mocks: {},
      getReceivedLogger: () => {
        const mock = mockRegistry.get('callback-logger-error-workflow:receivedLogger');
        return mock.mock.calls.length > 0 ? mock.mock.calls[0]![0] : undefined;
      },
      resetMocks: () => mockRegistry.reset(),
    };
  }

  // Test: should provide requestContext in onFinish callback
  {
    mockRegistry.register('callback-requestcontext-workflow:receivedContext', () => vi.fn());
    mockRegistry.register('callback-requestcontext-workflow:execute', () =>
      vi.fn().mockResolvedValue({ result: 'success' }),
    );

    const step1 = createStep({
      id: 'step1',
      execute: async ctx => mockRegistry.get('callback-requestcontext-workflow:execute')(ctx),
      inputSchema: z.object({}),
      outputSchema: z.object({ result: z.string() }),
    });

    const workflow = createWorkflow({
      id: 'callback-requestcontext-workflow',
      inputSchema: z.object({}),
      outputSchema: z.object({ result: z.string() }),
      steps: [step1],
      options: {
        onFinish: result => {
          mockRegistry.get('callback-requestcontext-workflow:receivedContext')(result.requestContext);
        },
      },
    });

    workflow.then(step1).commit();

    workflows['callback-requestcontext-workflow'] = {
      workflow,
      mocks: {},
      getReceivedContext: () => {
        const mock = mockRegistry.get('callback-requestcontext-workflow:receivedContext');
        return mock.mock.calls.length > 0 ? mock.mock.calls[0]![0] : undefined;
      },
      resetMocks: () => mockRegistry.reset(),
    };
  }

  // Test: should provide requestContext in onError callback
  {
    mockRegistry.register('callback-requestcontext-error-workflow:receivedContext', () => vi.fn());
    mockRegistry.register('callback-requestcontext-error-workflow:execute', () =>
      vi.fn().mockRejectedValue(new Error('Test error')),
    );

    const step1 = createStep({
      id: 'step1',
      execute: async ctx => mockRegistry.get('callback-requestcontext-error-workflow:execute')(ctx),
      inputSchema: z.object({}),
      outputSchema: z.object({ result: z.string() }),
    });

    const workflow = createWorkflow({
      id: 'callback-requestcontext-error-workflow',
      inputSchema: z.object({}),
      outputSchema: z.object({ result: z.string() }),
      steps: [step1],
      options: {
        onError: errorInfo => {
          mockRegistry.get('callback-requestcontext-error-workflow:receivedContext')(errorInfo.requestContext);
        },
      },
    });

    workflow.then(step1).commit();

    workflows['callback-requestcontext-error-workflow'] = {
      workflow,
      mocks: {},
      getReceivedContext: () => {
        const mock = mockRegistry.get('callback-requestcontext-error-workflow:receivedContext');
        return mock.mock.calls.length > 0 ? mock.mock.calls[0]![0] : undefined;
      },
      resetMocks: () => mockRegistry.reset(),
    };
  }

  // Test: should provide mastra instance in onFinish callback
  {
    mockRegistry.register('callback-mastra-onfinish-workflow:receivedMastra', () => vi.fn());
    mockRegistry.register('callback-mastra-onfinish-workflow:execute', () =>
      vi.fn().mockResolvedValue({ result: 'success' }),
    );

    const step1 = createStep({
      id: 'step1',
      execute: async (ctx: any) => mockRegistry.get('callback-mastra-onfinish-workflow:execute')(ctx),
      inputSchema: z.object({}),
      outputSchema: z.object({ result: z.string() }),
    });

    const workflow = createWorkflow({
      id: 'callback-mastra-onfinish-workflow',
      inputSchema: z.object({}),
      outputSchema: z.object({ result: z.string() }),
      steps: [step1],
      options: {
        onFinish: (result: any) => {
          mockRegistry.get('callback-mastra-onfinish-workflow:receivedMastra')(result.mastra);
        },
      },
    });

    workflow.then(step1).commit();

    workflows['callback-mastra-onfinish-workflow'] = {
      workflow,
      mocks: {},
      getReceivedMastra: () => {
        const mock = mockRegistry.get('callback-mastra-onfinish-workflow:receivedMastra');
        return mock.mock.calls.length > 0 ? mock.mock.calls[0]![0] : undefined;
      },
      resetMocks: () => mockRegistry.reset(),
    };
  }

  // Test: should provide mastra instance in onError callback
  {
    mockRegistry.register('callback-mastra-onerror-workflow:receivedMastra', () => vi.fn());
    mockRegistry.register('callback-mastra-onerror-workflow:execute', () =>
      vi.fn().mockRejectedValue(new Error('Test error')),
    );

    const step1 = createStep({
      id: 'step1',
      execute: async (ctx: any) => mockRegistry.get('callback-mastra-onerror-workflow:execute')(ctx),
      inputSchema: z.object({}),
      outputSchema: z.object({ result: z.string() }),
    });

    const workflow = createWorkflow({
      id: 'callback-mastra-onerror-workflow',
      inputSchema: z.object({}),
      outputSchema: z.object({ result: z.string() }),
      steps: [step1],
      options: {
        onError: (errorInfo: any) => {
          mockRegistry.get('callback-mastra-onerror-workflow:receivedMastra')(errorInfo.mastra);
        },
      },
    });

    workflow.then(step1).commit();

    workflows['callback-mastra-onerror-workflow'] = {
      workflow,
      mocks: {},
      getReceivedMastra: () => {
        const mock = mockRegistry.get('callback-mastra-onerror-workflow:receivedMastra');
        return mock.mock.calls.length > 0 ? mock.mock.calls[0]![0] : undefined;
      },
      resetMocks: () => mockRegistry.reset(),
    };
  }

  // Test: should provide resourceId in onError callback when provided
  {
    mockRegistry.register('callback-error-resourceid-workflow:receivedResourceId', () => vi.fn());
    mockRegistry.register('callback-error-resourceid-workflow:execute', () =>
      vi.fn().mockRejectedValue(new Error('Test error')),
    );

    const step1 = createStep({
      id: 'step1',
      execute: async (ctx: any) => mockRegistry.get('callback-error-resourceid-workflow:execute')(ctx),
      inputSchema: z.object({}),
      outputSchema: z.object({ result: z.string() }),
    });

    const workflow = createWorkflow({
      id: 'callback-error-resourceid-workflow',
      inputSchema: z.object({}),
      outputSchema: z.object({ result: z.string() }),
      steps: [step1],
      options: {
        onError: (errorInfo: any) => {
          mockRegistry.get('callback-error-resourceid-workflow:receivedResourceId')(errorInfo.resourceId);
        },
      },
    });

    workflow.then(step1).commit();

    workflows['callback-error-resourceid-workflow'] = {
      workflow,
      mocks: {},
      getReceivedResourceId: () => {
        const mock = mockRegistry.get('callback-error-resourceid-workflow:receivedResourceId');
        return mock.mock.calls.length > 0 ? mock.mock.calls[0]![0] : undefined;
      },
      resetMocks: () => mockRegistry.reset(),
    };
  }

  // Test: should provide state in onError callback
  {
    mockRegistry.register('callback-error-state-workflow:receivedState', () => vi.fn());
    mockRegistry.register('callback-error-state-workflow:step1Execute', () =>
      vi.fn().mockImplementation(async ({ setState }: any) => {
        await setState({ counter: 10 });
        return { result: 'success' };
      }),
    );
    mockRegistry.register('callback-error-state-workflow:failingExecute', () =>
      vi.fn().mockRejectedValue(new Error('Test error')),
    );

    const step1 = createStep({
      id: 'step1',
      execute: async (ctx: any) => mockRegistry.get('callback-error-state-workflow:step1Execute')(ctx),
      inputSchema: z.object({}),
      outputSchema: z.object({ result: z.string() }),
      stateSchema: z.object({ counter: z.number().optional() }),
    });

    const failingStep = createStep({
      id: 'failing-step',
      execute: async (ctx: any) => mockRegistry.get('callback-error-state-workflow:failingExecute')(ctx),
      inputSchema: z.object({ result: z.string() }),
      outputSchema: z.object({}),
      stateSchema: z.object({ counter: z.number().optional() }),
    });

    const workflow = createWorkflow({
      id: 'callback-error-state-workflow',
      inputSchema: z.object({}),
      outputSchema: z.object({}),
      stateSchema: z.object({ counter: z.number().optional() }),
      steps: [step1, failingStep],
      options: {
        onError: (errorInfo: any) => {
          mockRegistry.get('callback-error-state-workflow:receivedState')(errorInfo.state);
        },
      },
    });

    workflow.then(step1).then(failingStep).commit();

    workflows['callback-error-state-workflow'] = {
      workflow,
      mocks: {},
      getReceivedState: () => {
        const mock = mockRegistry.get('callback-error-state-workflow:receivedState');
        return mock.mock.calls.length > 0 ? mock.mock.calls[0]![0] : undefined;
      },
      resetMocks: () => mockRegistry.reset(),
    };
  }

  return workflows;
}

export function createCallbacksTests(ctx: WorkflowTestContext, registry?: WorkflowRegistry) {
  const { execute, skipTests } = ctx;

  describe('onFinish and onError callbacks', () => {
    it.skipIf(skipTests.callbackOnFinish)('should call onFinish callback when workflow succeeds', async () => {
      const { workflow, mocks } = registry!['callback-test-workflow']!;

      const result = await execute(workflow, {});

      expect(result.status).toBe('success');
      expect(mocks.onFinishCallback).toHaveBeenCalledTimes(1);
    });

    it.skipIf(skipTests.callbackOnError)('should call onError callback when workflow fails', async () => {
      const { workflow, mocks } = registry!['error-callback-test-workflow']!;

      const result = await execute(workflow, {});

      expect(result.status).toBe('failed');
      expect(mocks.onErrorCallback).toHaveBeenCalledTimes(1);
    });

    it.skipIf(skipTests.callbackResult)('should pass workflow result to onFinish callback', async () => {
      const { workflow, getReceivedResult } = registry!['result-callback-workflow']!;

      await execute(workflow, {});

      const receivedResult = getReceivedResult();
      expect(receivedResult).toBeDefined();
      expect(receivedResult.status).toBe('success');
    });

    it.skipIf(skipTests.callbackOnErrorNotCalled)(
      'should not call onError callback when workflow succeeds',
      async () => {
        const { workflow, mocks } = registry!['no-error-callback-workflow']!;

        const result = await execute(workflow, {});

        expect(result.status).toBe('success');
        expect(mocks.onErrorCallback).not.toHaveBeenCalled();
      },
    );

    it.skipIf(skipTests.callbackBothOnFailure)(
      'should call both onFinish and onError when workflow fails',
      async () => {
        const { workflow, mocks } = registry!['both-callbacks-workflow']!;

        const result = await execute(workflow, {});

        expect(result.status).toBe('failed');
        expect(mocks.onFinishCallback).toHaveBeenCalledTimes(1);
        expect(mocks.onErrorCallback).toHaveBeenCalledTimes(1);
      },
    );

    it.skipIf(skipTests.callbackAsyncOnFinish)('should support async onFinish callback', async () => {
      const { workflow, mocks, getCallbackCompleted } = registry!['async-onfinish-workflow']!;

      await execute(workflow, {});

      expect(mocks.onFinishCallback).toHaveBeenCalledTimes(1);
      expect(getCallbackCompleted()).toBe(true);
    });

    it.skipIf(skipTests.callbackAsyncOnError)('should support async onError callback', async () => {
      const { workflow, mocks, getCallbackCompleted } = registry!['async-onerror-workflow']!;

      await execute(workflow, {});

      expect(mocks.onErrorCallback).toHaveBeenCalledTimes(1);
      expect(getCallbackCompleted()).toBe(true);
    });

    it.skipIf(skipTests.callbackRunId)('should provide runId in onFinish callback', async () => {
      const { workflow, getReceivedRunId, resetMocks } = registry!['callback-runid-workflow']!;
      resetMocks?.();

      const customRunId = `test-runid-${Date.now()}`;
      await execute(workflow, {}, { runId: customRunId });

      const receivedRunId = getReceivedRunId();
      expect(receivedRunId).toBe(customRunId);
    });

    it.skipIf(skipTests.callbackWorkflowId)('should provide workflowId in onFinish callback', async () => {
      const { workflow, getReceivedWorkflowId, resetMocks } = registry!['callback-workflowid-workflow']!;
      resetMocks?.();

      await execute(workflow, {});

      const receivedWorkflowId = getReceivedWorkflowId();
      expect(receivedWorkflowId).toBe('callback-workflowid-workflow');
    });

    it.skipIf(skipTests.callbackState ?? skipTests.state)('should provide state in onFinish callback', async () => {
      const { workflow, getReceivedState, resetMocks } = registry!['callback-state-workflow']!;
      resetMocks?.();

      await execute(workflow, {}, { initialState: { counter: 0 } });

      const receivedState = getReceivedState();
      expect(receivedState).toBeDefined();
      expect(receivedState.counter).toBe(1);
    });

    it.skipIf(skipTests.callbackResourceId)(
      'should provide resourceId in onFinish callback when provided',
      async () => {
        const { workflow, getReceivedResourceId, resetMocks } = registry!['callback-resourceid-workflow']!;
        resetMocks?.();

        const testResourceId = `resource-${Date.now()}`;
        await execute(workflow, {}, { resourceId: testResourceId });

        const receivedResourceId = getReceivedResourceId();
        expect(receivedResourceId).toBe(testResourceId);
      },
    );

    it.skipIf(skipTests.callbackRunId)('should provide runId in onError callback', async () => {
      const { workflow, getReceivedRunId, resetMocks } = registry!['callback-error-runid-workflow']!;
      resetMocks?.();

      const customRunId = `test-error-runid-${Date.now()}`;
      await execute(workflow, {}, { runId: customRunId });

      const receivedRunId = getReceivedRunId();
      expect(receivedRunId).toBe(customRunId);
    });

    it.skipIf(skipTests.callbackWorkflowId)('should provide workflowId in onError callback', async () => {
      const { workflow, getReceivedWorkflowId, resetMocks } = registry!['callback-error-workflowid-workflow']!;
      resetMocks?.();

      await execute(workflow, {}, {});

      const receivedWorkflowId = getReceivedWorkflowId();
      expect(receivedWorkflowId).toBe('callback-error-workflowid-workflow');
    });

    it.skipIf(skipTests.callbackSuspended)(
      'should call onFinish with suspended status when workflow suspends',
      async () => {
        const { workflow, getReceivedStatus, resetMocks } = registry!['callback-suspended-workflow']!;
        resetMocks?.();

        await execute(workflow, {});

        const receivedStatus = getReceivedStatus();
        expect(receivedStatus).toBe('suspended');
      },
    );

    it.skipIf(skipTests.callbackGetInitData)('should provide getInitData function in onFinish callback', async () => {
      const { workflow, getReceivedInitData, resetMocks } = registry!['callback-getinitdata-workflow']!;
      resetMocks?.();

      await execute(workflow, { userId: 'user-123' });

      const receivedInitData = getReceivedInitData();
      expect(receivedInitData).toEqual({ userId: 'user-123' });
    });

    it.skipIf(skipTests.callbackGetInitData)('should provide getInitData function in onError callback', async () => {
      const { workflow, getReceivedInitData, resetMocks } = registry!['callback-getinitdata-error-workflow']!;
      resetMocks?.();

      await execute(workflow, { userId: 'user-456' });

      const receivedInitData = getReceivedInitData();
      expect(receivedInitData).toEqual({ userId: 'user-456' });
    });

    it.skipIf(skipTests.callbackLogger)('should provide logger in onFinish callback', async () => {
      const { workflow, getReceivedLogger, resetMocks } = registry!['callback-logger-workflow']!;
      resetMocks?.();

      await execute(workflow, {});

      const receivedLogger = getReceivedLogger();
      expect(receivedLogger).toBeDefined();
      expect(typeof receivedLogger.info).toBe('function');
      expect(typeof receivedLogger.error).toBe('function');
    });

    it.skipIf(skipTests.callbackLogger)('should provide logger in onError callback', async () => {
      const { workflow, getReceivedLogger, resetMocks } = registry!['callback-logger-error-workflow']!;
      resetMocks?.();

      await execute(workflow, {});

      const receivedLogger = getReceivedLogger();
      expect(receivedLogger).toBeDefined();
      expect(typeof receivedLogger.info).toBe('function');
      expect(typeof receivedLogger.error).toBe('function');
    });

    it.skipIf(skipTests.callbackRequestContext)('should provide requestContext in onFinish callback', async () => {
      const { workflow, getReceivedContext, resetMocks } = registry!['callback-requestcontext-workflow']!;
      resetMocks?.();

      // Pass requestContext as a Map since RequestContext extends Map
      const requestContext = new Map([['customKey', 'customValue']]);
      await execute(workflow, {}, { requestContext: requestContext as any });

      const receivedContext = getReceivedContext();
      expect(receivedContext).toBeDefined();
      expect(receivedContext.get('customKey')).toBe('customValue');
    });

    it.skipIf(skipTests.callbackRequestContext)('should provide requestContext in onError callback', async () => {
      const { workflow, getReceivedContext, resetMocks } = registry!['callback-requestcontext-error-workflow']!;
      resetMocks?.();

      const requestContext = new Map([['errorKey', 'errorValue']]);
      await execute(workflow, {}, { requestContext: requestContext as any });

      const receivedContext = getReceivedContext();
      expect(receivedContext).toBeDefined();
      expect(receivedContext.get('errorKey')).toBe('errorValue');
    });

    it.skipIf(skipTests.callbackMastraOnFinish)('should provide mastra instance in onFinish callback', async () => {
      const { workflow, getReceivedMastra, resetMocks } = registry!['callback-mastra-onfinish-workflow']!;
      resetMocks?.();

      await execute(workflow, {});

      const receivedMastra = getReceivedMastra();
      expect(receivedMastra).toBeDefined();
      expect(typeof receivedMastra).toBe('object');
    });

    it.skipIf(skipTests.callbackMastraOnError)('should provide mastra instance in onError callback', async () => {
      const { workflow, getReceivedMastra, resetMocks } = registry!['callback-mastra-onerror-workflow']!;
      resetMocks?.();

      await execute(workflow, {});

      const receivedMastra = getReceivedMastra();
      expect(receivedMastra).toBeDefined();
    });

    it.skipIf(skipTests.callbackResourceIdOnError)(
      'should provide resourceId in onError callback when provided',
      async () => {
        const { workflow, getReceivedResourceId, resetMocks } = registry!['callback-error-resourceid-workflow']!;
        resetMocks?.();

        await execute(workflow, {}, { resourceId: 'error-resource-456' });

        const receivedResourceId = getReceivedResourceId();
        expect(receivedResourceId).toBe('error-resource-456');
      },
    );

    it.skipIf(skipTests.callbackStateOnError)('should provide state in onError callback', async () => {
      const { workflow, getReceivedState, resetMocks } = registry!['callback-error-state-workflow']!;
      resetMocks?.();

      await execute(workflow, {});

      const receivedState = getReceivedState();
      expect(receivedState).toBeDefined();
      expect(receivedState.counter).toBe(10);
    });
  });
}
