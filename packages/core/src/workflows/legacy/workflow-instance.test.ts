import { describe, it, beforeEach, expect, vi } from 'vitest';
import { RuntimeContext } from '../../runtime-context';
import { LegacyStep } from './step';
import type { StepGraph, StepNode } from './types';
import { WorkflowInstance } from './workflow-instance';

describe('WorkflowInstance._resume', () => {
  let testSteps: Record<string, StepNode>;
  let stepGraph: StepGraph;

  beforeEach(() => {
    // Create test steps with known configurations
    const step1 = new LegacyStep({
      id: 'step1',
      description: 'Step 1',
      execute: async () => ({}),
    });

    const step2 = new LegacyStep({
      id: 'step2',
      description: 'Step 2',
      execute: async () => ({}),
    });

    testSteps = {
      step1: { id: 'step1', step: step1, config: {} as any },
      step2: { id: 'step2', step: step2, config: {} as any },
    } as Record<string, StepNode>;

    stepGraph = {
      initial: [testSteps.step1, testSteps.step2],
    } as unknown as StepGraph;
  });

  it('merges step definitions into stepNode.config for a single child stepNode and retains existing config', async () => {
    // Arrange: snapshot returned from storage with one child containing stepNode data
    const snapshotFromStorage: any = {
      suspendedSteps: { step1: 'step1' },
      childStates: {
        step1: {
          value: { step1: 'pending' },
          context: {
            steps: {
              step1: {
                status: 'pending',
                output: {},
              },
            },
          },
          children: {
            child1: {
              snapshot: {
                input: {
                  stepNode: {
                    step: { id: 'step1' },
                    config: {
                      initialProp: 'initial',
                    },
                  },
                  context: {},
                },
              },
            },
          },
        },
      },
    };

    const storage = {
      loadWorkflowSnapshot: vi.fn().mockResolvedValue(snapshotFromStorage),
      persistWorkflowSnapshot: vi.fn().mockResolvedValue(undefined),
    };

    const mastra = {
      getStorage: () => storage,
      getTelemetry: () => undefined,
      generateId: () => 'gen-id',
    } as any;

    const workflowInstance = new WorkflowInstance({
      name: 'test-workflow',
      logger: console as any,
      steps: testSteps,
      stepGraph,
      stepSubscriberGraph: {},
      runId: 'test-run-id',
      mastra,
    });

    // Avoid executing the real machine; we only care about _resume mutations
    vi.spyOn(workflowInstance as any, 'execute').mockResolvedValue({
      results: {},
      activePaths: new Map(),
      timestamp: Date.now(),
    });

    // Act: Resume the workflow
    await workflowInstance._resume({
      stepId: 'step1',
      runtimeContext: new RuntimeContext(),
      context: undefined,
    });

    // Assert: Config should be merged with step definition (handler, data) and retain existing props
    const mergedConfig = snapshotFromStorage.childStates.step1.children.child1.snapshot.input.stepNode.config;

    expect(mergedConfig).toHaveProperty('initialProp', 'initial');
    expect(mergedConfig).toHaveProperty('handler');
    expect(typeof mergedConfig.handler).toBe('function');
    expect(mergedConfig).toHaveProperty('data');
  });

  it('syncs context for a single child stepNode', async () => {
    // Arrange: Create snapshot with specific context
    const testContext = {
      steps: {
        step1: {
          status: 'pending',
          output: { testData: 'test' },
        },
      },
    };

    const snapshotFromStorage: any = {
      suspendedSteps: { step1: 'step1' },
      childStates: {
        step1: {
          value: { step1: 'pending' },
          context: testContext,
          children: {
            child1: {
              snapshot: {
                input: {
                  stepNode: {
                    step: { id: 'step1' },
                    config: {},
                  },
                  context: {},
                },
              },
            },
          },
        },
      },
    };

    const storage = {
      loadWorkflowSnapshot: vi.fn().mockResolvedValue(snapshotFromStorage),
      persistWorkflowSnapshot: vi.fn().mockResolvedValue(undefined),
    };

    const mastra = {
      getStorage: () => storage,
      getTelemetry: () => undefined,
      generateId: () => 'gen-id',
    } as any;

    const workflowInstance = new WorkflowInstance({
      name: 'test-workflow',
      logger: console as any,
      steps: testSteps,
      stepGraph,
      stepSubscriberGraph: {},
      runId: 'test-run-id',
      mastra,
    });

    vi.spyOn(workflowInstance as any, 'execute').mockResolvedValue({
      results: {},
      activePaths: new Map(),
      timestamp: Date.now(),
    });

    // Act: Resume the workflow
    await workflowInstance._resume({
      stepId: 'step1',
      runtimeContext: new RuntimeContext(),
    });

    // Assert: Context should be synced
    const syncedContext = snapshotFromStorage.childStates.step1.children.child1.snapshot.input.context;
    expect(syncedContext).toEqual(testContext);
  });

  it('merges step definitions for multiple children stepNodes and retains existing config', async () => {
    // Arrange: Create snapshot with multiple children
    const snapshotFromStorage: any = {
      suspendedSteps: { step1: 'step1' },
      childStates: {
        step1: {
          value: { step1: 'pending', step2: 'pending' },
          context: {
            steps: {
              step1: { status: 'pending', output: {} },
              step2: { status: 'pending', output: {} },
            },
          },
          children: {
            child1: {
              snapshot: {
                input: {
                  stepNode: {
                    step: { id: 'step1' },
                    config: {
                      initialProp1: 'initial1',
                    },
                  },
                },
              },
            },
            child2: {
              snapshot: {
                input: {
                  stepNode: {
                    step: { id: 'step2' },
                    config: {
                      initialProp2: 'initial2',
                    },
                  },
                },
              },
            },
          },
        },
      },
    };

    const storage = {
      loadWorkflowSnapshot: vi.fn().mockResolvedValue(snapshotFromStorage),
      persistWorkflowSnapshot: vi.fn().mockResolvedValue(undefined),
    };

    const mastra = {
      getStorage: () => storage,
      getTelemetry: () => undefined,
      generateId: () => 'gen-id',
    } as any;

    const workflowInstance = new WorkflowInstance({
      name: 'test-workflow',
      logger: console as any,
      steps: testSteps,
      stepGraph,
      stepSubscriberGraph: {},
      runId: 'test-run-id',
      mastra,
    });

    vi.spyOn(workflowInstance as any, 'execute').mockResolvedValue({
      results: {},
      activePaths: new Map(),
      timestamp: Date.now(),
    });

    // Act: Resume the workflow
    await workflowInstance._resume({
      stepId: 'step1',
      runtimeContext: new RuntimeContext(),
    });

    // Assert: Configs should be merged for both children
    const child1Config = snapshotFromStorage.childStates.step1.children.child1.snapshot.input.stepNode.config;
    const child2Config = snapshotFromStorage.childStates.step1.children.child2.snapshot.input.stepNode.config;

    expect(child1Config).toHaveProperty('initialProp1', 'initial1');
    expect(child1Config).toHaveProperty('handler');
    expect(child1Config).toHaveProperty('data');

    expect(child2Config).toHaveProperty('initialProp2', 'initial2');
    expect(child2Config).toHaveProperty('handler');
    expect(child2Config).toHaveProperty('data');
  });

  it('syncs context for multiple children stepNodes', async () => {
    // Arrange: Create snapshot with shared context
    const testContext = {
      steps: {
        step1: { status: 'pending', output: { data1: 'test1' } },
        step2: { status: 'pending', output: { data2: 'test2' } },
      },
    };

    const snapshotFromStorage: any = {
      suspendedSteps: { step1: 'step1' },
      childStates: {
        step1: {
          value: { step1: 'pending', step2: 'pending' },
          context: testContext,
          children: {
            child1: {
              snapshot: {
                input: {
                  stepNode: {
                    step: { id: 'step1' },
                    config: {},
                  },
                  context: {},
                },
              },
            },
            child2: {
              snapshot: {
                input: {
                  stepNode: {
                    step: { id: 'step2' },
                    config: {},
                  },
                  context: {},
                },
              },
            },
          },
        },
      },
    };

    const storage = {
      loadWorkflowSnapshot: vi.fn().mockResolvedValue(snapshotFromStorage),
      persistWorkflowSnapshot: vi.fn().mockResolvedValue(undefined),
    };

    const mastra = {
      getStorage: () => storage,
      getTelemetry: () => undefined,
      generateId: () => 'gen-id',
    } as any;

    const workflowInstance = new WorkflowInstance({
      name: 'test-workflow',
      logger: console as any,
      steps: testSteps,
      stepGraph,
      stepSubscriberGraph: {},
      runId: 'test-run-id',
      mastra,
    });

    vi.spyOn(workflowInstance as any, 'execute').mockResolvedValue({
      results: {},
      activePaths: new Map(),
      timestamp: Date.now(),
    });

    // Act: Resume the workflow
    await workflowInstance._resume({
      stepId: 'step1',
      runtimeContext: new RuntimeContext(),
    });

    // Assert: Context should be synced for both children
    const ctx1 = snapshotFromStorage.childStates.step1.children.child1.snapshot.input.context;
    const ctx2 = snapshotFromStorage.childStates.step1.children.child2.snapshot.input.context;

    expect(ctx1).toEqual(testContext);
    expect(ctx2).toEqual(testContext);
  });
});
