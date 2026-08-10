import { describe, expect, it } from 'vitest';
import { RequestContext } from '../di';
import {
  AGENT_APPROVAL_CHECKPOINT_KIND,
  createAgentApprovalSnapshotPersistence,
} from '../loop/workflows/agent-approval-checkpoint';
import { pruneAgentLoopSnapshot } from '../loop/workflows/prune-snapshot';
import { Mastra } from '../mastra';
import { InMemoryStore } from '../storage';
import { DefaultExecutionEngine } from './default';
import { WorkflowEventProcessor } from './evented/workflow-event-processor';
import { prepareWorkflowSnapshotForPersistence } from './snapshot-persistence';
import type { ExecutionContext, WorkflowOptions, WorkflowRunSnapshot, WorkflowRunState } from './types';

const LARGE_RESULT = `large-result:${'x'.repeat(100_000)}`;

function approvalSnapshot(runId: string, status: WorkflowRunState['status'] = 'suspended'): WorkflowRunState {
  return {
    runId,
    status,
    value: {},
    context: {
      input: { messages: [LARGE_RESULT] },
      completed: { status: 'success', output: { result: LARGE_RESULT } } as any,
      tools: {
        status: 'suspended',
        suspendPayload: {
          requireToolApproval: { toolCallId: 'call-1', toolName: 'lookup', args: { id: 'customer-1' } },
          __agentId: 'agent-1',
          __streamState: { messageList: { messages: [{ role: 'user', content: 'Look up customer' }] } },
          __workflow_meta: {
            foreachOutput: {
              0: { status: 'success', output: LARGE_RESULT },
              1: {
                status: 'suspended',
                suspendPayload: {
                  requireToolApproval: { toolCallId: 'call-2', toolName: 'email', args: { id: 'customer-1' } },
                  __agentId: 'agent-1',
                  __streamState: { messageList: { messages: [{ role: 'user', content: 'Email customer' }] } },
                },
              },
            },
          },
        },
      } as any,
    },
    serializedStepGraph: [],
    activePaths: [0],
    activeStepsPath: { tools: [0] },
    suspendedPaths: { tools: [0] },
    resumeLabels: {
      'call-1': { stepId: 'tools' },
      'call-2': { stepId: 'tools', foreachIndex: 1 },
    },
    waitingPaths: {},
    timestamp: 123,
  };
}

function persistenceOptions(mode: 'full' | 'minimal', workflowId = 'agentic-loop'): WorkflowOptions {
  return {
    pruneSnapshot: pruneAgentLoopSnapshot,
    prepareSnapshotForPersistence: createAgentApprovalSnapshotPersistence({
      workflowId,
      approvalPersistence: mode,
    }),
  };
}

function isMinimal(snapshot: WorkflowRunSnapshot): boolean {
  return 'kind' in snapshot && snapshot.kind === AGENT_APPROVAL_CHECKPOINT_KIND;
}

async function persistWithDefaultEngine(mode: 'full' | 'minimal') {
  const storage = new InMemoryStore();
  const mastra = new Mastra({ storage, logger: false });
  const options = persistenceOptions(mode);
  const engine = new DefaultExecutionEngine({
    mastra,
    options: { validateInputs: false, shouldPersistSnapshot: () => true, ...options },
  });
  const source = approvalSnapshot(`default-${mode}`);
  const executionContext: ExecutionContext = {
    workflowId: 'agentic-loop',
    runId: source.runId,
    executionPath: source.activePaths,
    activeStepsPath: source.activeStepsPath,
    suspendedPaths: source.suspendedPaths,
    resumeLabels: source.resumeLabels,
    waitingPaths: source.waitingPaths,
    retryConfig: { attempts: 0, delay: 0 },
    state: source.value,
  };

  await engine.persistStepUpdate({
    workflowId: 'agentic-loop',
    runId: source.runId,
    resourceId: 'resource-1',
    stepResults: source.context as any,
    serializedStepGraph: source.serializedStepGraph,
    executionContext,
    workflowStatus: 'suspended',
    requestContext: new RequestContext(),
  });

  return (await (await storage.getStore('workflows'))!.getWorkflowRunById({
    workflowName: 'agentic-loop',
    runId: source.runId,
  }))!;
}

async function persistWithEventedEngine(mode: 'full' | 'minimal') {
  const storage = new InMemoryStore();
  const mastra = new Mastra({ storage, logger: false });
  const store = (await storage.getStore('workflows'))!;
  const source = approvalSnapshot(`evented-${mode}`);
  await store.persistWorkflowSnapshot({
    workflowName: 'agentic-loop',
    runId: source.runId,
    resourceId: 'resource-1',
    snapshot: source,
  });

  const processor = new WorkflowEventProcessor({ mastra });
  await (processor as any).prepareAndRepersistSnapshot({
    workflow: { options: persistenceOptions(mode) },
    workflowId: 'agentic-loop',
    runId: source.runId,
  });

  return (await store.getWorkflowRunById({ workflowName: 'agentic-loop', runId: source.runId }))!;
}

describe.each([
  ['default', persistWithDefaultEngine],
  ['evented', persistWithEventedEngine],
] as const)('%s engine approval snapshot persistence', (_engineName, persist) => {
  it('persists a compact checkpoint in minimal mode and preserves ownership metadata', async () => {
    const run = await persist('minimal');
    const snapshot = run.snapshot as unknown as WorkflowRunSnapshot;

    expect(isMinimal(snapshot)).toBe(true);
    expect(run.resourceId).toBe('resource-1');
    expect(JSON.stringify(snapshot).length).toBeLessThan(10_000);
    expect(JSON.stringify(snapshot)).not.toContain(LARGE_RESULT);
    expect((snapshot as any).approvals).toHaveLength(2);
    expect((snapshot as any).approvals[1].foreachIndex).toBe(1);
  });

  it('keeps the existing full snapshot representation by default', async () => {
    const run = await persist('full');
    const snapshot = run.snapshot as unknown as WorkflowRunSnapshot;

    expect(isMinimal(snapshot)).toBe(false);
    expect(run.resourceId).toBe('resource-1');
    expect(snapshot).toHaveProperty('context');
    expect(JSON.stringify(snapshot)).toContain(LARGE_RESULT);
  });
});

describe('snapshot persistence phase boundaries', () => {
  it.each(['pending', 'running'] as const)('keeps %s snapshots full, including nested-run initialization', status => {
    const snapshot = approvalSnapshot(`run-${status}`, status);
    const prepared = prepareWorkflowSnapshotForPersistence({
      snapshot,
      workflowStatus: status,
      options: persistenceOptions('minimal', 'nested-agent-workflow'),
    });

    expect(isMinimal(prepared)).toBe(false);
    expect(prepared.status).toBe(status);
  });
});
