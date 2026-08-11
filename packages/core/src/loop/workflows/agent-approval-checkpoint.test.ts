import { describe, expect, it, vi } from 'vitest';
import type { WorkflowRunState } from '../../workflows/types';
import {
  AGENT_APPROVAL_CHECKPOINT_KIND,
  AGENT_APPROVAL_CHECKPOINT_VERSION,
  buildAgentApprovalCheckpoint,
  materializeAgentApprovalCheckpoint,
  materializePersistedAgentApprovalCheckpoints,
  parseAgentApprovalCheckpoint,
} from './agent-approval-checkpoint';

const LARGE_RESULT = `completed:${'x'.repeat(50_000)}`;

function createSuspendedSnapshot(): WorkflowRunState {
  return {
    runId: 'run-1',
    status: 'suspended',
    value: { state: 'private-state' },
    context: {
      input: {
        __workflowKind: 'durable-agent',
        runId: 'run-1',
        agentId: 'agent-1',
        agentName: 'Support agent',
        messageListState: { messages: [LARGE_RESULT] },
        toolsMetadata: { lookup: { id: 'lookup' } },
        modelConfig: { id: 'model-1' },
        options: { approvalPersistence: 'minimal' },
        state: { customerId: 'customer-1' },
        messageId: 'message-1',
        requestContextEntries: { tenantId: 'tenant-1' },
        agentSpanData: { secret: 'trace-input' },
      } as any,
      completed: {
        status: 'success',
        output: { result: LARGE_RESULT },
        payload: { messages: [LARGE_RESULT] },
      } as any,
      tools: {
        status: 'suspended',
        payload: { previousOutput: LARGE_RESULT },
        suspendPayload: {
          requireToolApproval: {
            toolCallId: 'call-1',
            toolName: 'lookup',
            args: { customerId: 'customer-1' },
          },
          __agentId: 'agent-1',
          __streamState: { messageList: { messages: [{ role: 'user', content: 'Look up customer' }] } },
          __workflow_meta: {
            nestedRunId: 'nested-1',
            foreachOutput: [
              { status: 'success', output: LARGE_RESULT },
              {
                status: 'suspended',
                suspendPayload: {
                  requireToolApproval: {
                    toolCallId: 'call-2',
                    toolName: 'email',
                    args: { address: 'person@example.com' },
                  },
                  __agentId: 'agent-1',
                  __streamState: { messageList: { messages: [{ role: 'user', content: 'Send email' }] } },
                  __workflow_meta: { nestedRunId: 'nested-2' },
                },
              },
            ],
          },
        },
      } as any,
    },
    result: { status: 'suspended', output: LARGE_RESULT },
    serializedStepGraph: [{ type: 'step', step: { id: 'tools' } }] as any,
    activePaths: [0],
    activeStepsPath: { tools: [0] },
    suspendedPaths: { tools: [0] },
    resumeLabels: {
      'call-1': { stepId: 'tools' },
      'call-2': { stepId: 'tools', foreachIndex: 1 },
    },
    waitingPaths: {},
    timestamp: 123,
    stepExecutionPath: ['loop', 'tools'],
    requestContext: { authorization: 'Bearer secret' },
    tracingContext: { traceId: 'secret-trace' } as any,
  };
}

describe('buildAgentApprovalCheckpoint', () => {
  it('builds a versioned checkpoint with only live approval and resume state', () => {
    const checkpoint = buildAgentApprovalCheckpoint({
      workflowId: 'agentic-loop',
      snapshot: createSuspendedSnapshot(),
    });

    expect(checkpoint).toMatchObject({
      kind: AGENT_APPROVAL_CHECKPOINT_KIND,
      version: AGENT_APPROVAL_CHECKPOINT_VERSION,
      workflowId: 'agentic-loop',
      runId: 'run-1',
      status: 'suspended',
      approvals: [
        {
          toolCallId: 'call-1',
          toolName: 'lookup',
          args: { customerId: 'customer-1' },
          stepId: 'tools',
          executionPath: [0],
          resumeLabel: 'call-1',
        },
        {
          toolCallId: 'call-2',
          toolName: 'email',
          foreachIndex: 1,
          resumeLabel: 'call-2',
        },
      ],
      rehydration: {
        input: {
          __workflowKind: 'durable-agent',
          runId: 'run-1',
          agentId: 'agent-1',
          requestContextEntries: { tenantId: 'tenant-1' },
        },
      },
    });
    expect(checkpoint.routing.resumeLabels).toEqual(createSuspendedSnapshot().resumeLabels);
  });

  it('excludes completed outputs, foreach aggregation, duplicate messages, and unrelated context', () => {
    const checkpoint = buildAgentApprovalCheckpoint({
      workflowId: 'agentic-loop',
      snapshot: createSuspendedSnapshot(),
    });
    const serialized = JSON.stringify(checkpoint);

    expect(serialized).not.toContain(LARGE_RESULT);
    expect(serialized).not.toContain('foreachOutput');
    expect(serialized).not.toContain('Bearer secret');
    expect(serialized).not.toContain('secret-trace');
    expect(serialized).not.toContain('trace-input');
    expect(checkpoint).not.toHaveProperty('context');
    expect(checkpoint).not.toHaveProperty('result');
    expect(checkpoint.rehydration.input).not.toHaveProperty('messageListState');
  });

  it('is pure and returns a JSON-safe detached value', () => {
    const snapshot = createSuspendedSnapshot();
    const before = JSON.stringify(snapshot);
    const checkpoint = buildAgentApprovalCheckpoint({ workflowId: 'agentic-loop', snapshot });

    checkpoint.approvals[0]!.args = { changed: true };

    expect(JSON.stringify(snapshot)).toBe(before);
    expect(() => JSON.stringify(checkpoint)).not.toThrow();
    expect((snapshot.context.tools as any).suspendPayload.requireToolApproval.args).toEqual({
      customerId: 'customer-1',
    });
  });

  it('rejects snapshots that are not suspended on an approval', () => {
    const snapshot = createSuspendedSnapshot();
    snapshot.context.tools = { status: 'suspended', suspendPayload: { customQuestion: 'Continue?' } } as any;

    expect(() => buildAgentApprovalCheckpoint({ workflowId: 'agentic-loop', snapshot })).toThrow(
      'Cannot create an agent approval checkpoint: no pending tool approval was found.',
    );
  });
});

describe('parseAgentApprovalCheckpoint', () => {
  it('accepts a checkpoint produced by the builder without sharing references', () => {
    const checkpoint = buildAgentApprovalCheckpoint({
      workflowId: 'agentic-loop',
      snapshot: createSuspendedSnapshot(),
    });
    const parsed = parseAgentApprovalCheckpoint(checkpoint);

    expect(parsed).toEqual(checkpoint);
    expect(parsed).not.toBe(checkpoint);
  });

  it('rejects malformed and unsupported checkpoint versions clearly', () => {
    expect(() => parseAgentApprovalCheckpoint({ kind: AGENT_APPROVAL_CHECKPOINT_KIND, version: 2 })).toThrow(
      'Unsupported agent approval checkpoint version "2". Expected version 1.',
    );
    expect(() => parseAgentApprovalCheckpoint({ kind: AGENT_APPROVAL_CHECKPOINT_KIND, version: 1 })).toThrow(
      'Invalid agent approval checkpoint: expected a suspended checkpoint with workflow, run, routing, and approval data.',
    );

    const malformedRouting = buildAgentApprovalCheckpoint({
      workflowId: 'agentic-loop',
      snapshot: createSuspendedSnapshot(),
    }) as any;
    malformedRouting.routing.suspendedPaths = null;
    expect(() => parseAgentApprovalCheckpoint(malformedRouting)).toThrow('Invalid agent approval checkpoint');
  });
});

describe('materializeAgentApprovalCheckpoint', () => {
  it('reconstructs suspended foreach entries and the small continuation prerequisite', () => {
    const snapshot = createSuspendedSnapshot();
    snapshot.context['llm-execution'] = {
      status: 'success',
      output: {
        messageId: 'message-1',
        messages: { all: [LARGE_RESULT], user: [], nonUser: [] },
        output: { usage: { totalTokens: 1 }, steps: [{ response: LARGE_RESULT }] },
        metadata: {},
        stepResult: { reason: 'tool-calls', warnings: [], isContinued: true },
      },
    } as any;
    const checkpoint = buildAgentApprovalCheckpoint({ workflowId: 'agentic-loop', snapshot });
    const materialized = materializeAgentApprovalCheckpoint(checkpoint, {
      workflowId: 'agentic-loop',
      runId: 'run-1',
    });

    expect(materialized.context.tools).toMatchObject({
      status: 'suspended',
      payload: [null, { toolCallId: 'call-2', toolName: 'email' }],
      suspendPayload: {
        __workflow_meta: {
          foreachOutput: [{ status: 'success' }, { status: 'suspended' }],
        },
      },
    });
    expect(materialized.context['llm-execution']).toMatchObject({
      status: 'success',
      output: { output: { steps: [] } },
    });
    expect(JSON.stringify(materialized.context['llm-execution'])).not.toContain(LARGE_RESULT);
  });

  it('materializes and re-persists checkpoints returned as JSON strings', async () => {
    const snapshot = createSuspendedSnapshot();
    const workflowNames = ['agentic-loop', 'executionWorkflow'];
    const checkpoints = Object.fromEntries(
      workflowNames.map(workflowId => [
        workflowId,
        JSON.stringify(buildAgentApprovalCheckpoint({ workflowId, snapshot })),
      ]),
    );
    const persistWorkflowSnapshot = vi.fn();
    const workflowsStore = {
      getWorkflowRunById: vi.fn(async ({ workflowName }: { workflowName: string }) => ({
        workflowName,
        runId: snapshot.runId,
        snapshot: checkpoints[workflowName],
        resourceId: 'resource-1',
        createdAt: new Date(0),
      })),
      persistWorkflowSnapshot,
    } as any;

    const outer = await materializePersistedAgentApprovalCheckpoints({
      workflowsStore,
      workflowNames,
      outerWorkflowName: 'agentic-loop',
      runId: snapshot.runId,
    });

    expect(outer?.context.input).toMatchObject({ __workflowKind: 'durable-agent', agentId: 'agent-1' });
    expect(persistWorkflowSnapshot).toHaveBeenCalledTimes(2);
    expect(persistWorkflowSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        workflowName: 'agentic-loop',
        runId: snapshot.runId,
        resourceId: 'resource-1',
        createdAt: new Date(0),
        snapshot: expect.objectContaining({ status: 'suspended', context: expect.any(Object) }),
      }),
    );
  });

  it('rejects a checkpoint stored under the wrong workflow or run', () => {
    const checkpoint = buildAgentApprovalCheckpoint({
      workflowId: 'agentic-loop',
      snapshot: createSuspendedSnapshot(),
    });

    expect(() =>
      materializeAgentApprovalCheckpoint(checkpoint, { workflowId: 'executionWorkflow', runId: 'run-1' }),
    ).toThrow('persisted workflow or run identity does not match');
  });
});
