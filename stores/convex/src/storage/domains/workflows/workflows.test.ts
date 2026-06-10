import type { WorkflowRunState } from '@mastra/core/workflows';
import { describe, expect, it, vi } from 'vitest';

import { ConvexAdminClient } from '../../client';
import type { StorageRequest } from '../../types';
import { WorkflowsConvex } from './index';

/**
 * Repro for https://github.com/mastra-ai/mastra/issues/16110
 *
 * Convex rejects any field whose name starts with `$` (reserved prefix).
 * Mastra workflow snapshots embed tool-call results, which for any tool defined
 * with a Zod input schema include a serialized JSON Schema fragment with
 * `$schema`, `$ref`, `$defs`, `$id` keys. Inserting the raw snapshot object
 * into Convex therefore fails with:
 *   ArgumentValidationError: Object contains extra field $schema that is not in the validator.
 *
 * `loadWorkflowSnapshot` already handles a string-encoded snapshot
 * (`typeof row.snapshot === 'string' ? JSON.parse(row.snapshot) : ...`),
 * so the symmetric fix is to JSON.stringify on persist.
 */

type CapturedRequest = Extract<StorageRequest, { op: 'insert' }>;

function createFakeClient() {
  const requests: StorageRequest[] = [];
  // We mock callStorage directly. Pretend load returns null (no existing row),
  // so persist takes the "insert new" branch.
  const callStorage = vi.fn(async (request: StorageRequest) => {
    requests.push(request);
    if (request.op === 'load') return null;
    return undefined;
  });

  // Build a ConvexAdminClient instance and override callStorage. We bypass the
  // constructor's url validation by passing dummy values — the mocked
  // callStorage means no network call is made.
  const client = new ConvexAdminClient({
    deploymentUrl: 'https://example.convex.cloud',
    adminAuthToken: 'test-token',
  });
  (client as unknown as { callStorage: typeof callStorage }).callStorage = callStorage;

  return { client, requests };
}

function snapshotWithDollarKeys(): WorkflowRunState {
  // Mirrors the structural shape of an `agentic-loop` snapshot whose
  // tool-output context includes a serialized Zod -> JSON Schema fragment.
  return {
    runId: 'run-1',
    status: 'success',
    context: {
      'tool-call-1': {
        status: 'success',
        output: {
          // This is the exact shape produced by tools whose inputSchema is a
          // Zod object — JSON Schema serialization injects `$schema`, plus
          // `$ref`/`$defs`/`$id` for nested/recursive shapes.
          inputSchema: {
            $schema: 'http://json-schema.org/draft-07/schema#',
            $id: 'https://example.com/tool-input.json',
            type: 'object',
            properties: {
              query: { type: 'string' },
              filter: { $ref: '#/$defs/Filter' },
            },
            $defs: {
              Filter: { type: 'object', properties: { kind: { type: 'string' } } },
            },
          },
        },
      },
    } as unknown as WorkflowRunState['context'],
    activePaths: [],
    activeStepsPath: {},
    timestamp: Date.now(),
    suspendedPaths: {},
    resumeLabels: {},
    serializedStepGraph: [],
    value: {},
    waitingPaths: {},
  };
}

describe('WorkflowsConvex.persistWorkflowSnapshot — $-prefixed keys', () => {
  it('serializes the snapshot before insert so Convex never sees $-prefixed keys', async () => {
    const { client, requests } = createFakeClient();
    const workflows = new WorkflowsConvex({ client });

    const snapshot = snapshotWithDollarKeys();
    await workflows.persistWorkflowSnapshot({
      workflowName: 'agentic-loop',
      runId: 'run-1',
      snapshot,
    });

    const insert = requests.find((r): r is CapturedRequest => r.op === 'insert');
    expect(insert, 'persist should issue an insert').toBeDefined();

    const persistedSnapshot = insert!.record.snapshot;

    // The fix: snapshot is stored as a JSON string, symmetric with the load path.
    expect(typeof persistedSnapshot).toBe('string');

    // No raw $-prefixed *keys* reach the Convex argument validator. The dollar
    // signs may appear inside the JSON string payload (that's fine — Convex
    // only rejects them as field names), but they must not be top-level or
    // nested object keys in the inserted record.
    const collectKeys = (value: unknown, acc: string[] = []): string[] => {
      if (Array.isArray(value)) {
        for (const v of value) collectKeys(v, acc);
      } else if (value && typeof value === 'object') {
        for (const k of Object.keys(value as Record<string, unknown>)) {
          acc.push(k);
          collectKeys((value as Record<string, unknown>)[k], acc);
        }
      }
      return acc;
    };
    const allKeys = collectKeys(insert!.record);
    const dollarKeys = allKeys.filter(k => k.startsWith('$'));
    expect(dollarKeys).toEqual([]);

    // Round-trip: the string must deserialize back to the original snapshot
    // so loadWorkflowSnapshot returns the same data.
    expect(JSON.parse(persistedSnapshot as string)).toEqual(snapshot);
  });
});

describe('WorkflowsConvex atomic workflow updates', () => {
  it('advertises concurrent update support', () => {
    const { client } = createFakeClient();
    const workflows = new WorkflowsConvex({ client });

    expect(workflows.supportsConcurrentUpdates()).toBe(true);
  });

  it('delegates step result updates to the Convex storage merge op', async () => {
    const requests: StorageRequest[] = [];
    const callStorage = vi.fn(async (request: StorageRequest) => {
      requests.push(request);
      if (request.op === 'mergeWorkflowStepResult') {
        return JSON.stringify({
          [request.stepId]: JSON.parse(request.result),
        });
      }
      return undefined;
    });

    const client = new ConvexAdminClient({
      deploymentUrl: 'https://example.convex.cloud',
      adminAuthToken: 'test-token',
    });
    (client as unknown as { callStorage: typeof callStorage }).callStorage = callStorage;
    const workflows = new WorkflowsConvex({ client });

    const result = {
      status: 'success' as const,
      output: { inputSchema: { $schema: 'https://json-schema.org/draft-07/schema#' } },
      payload: { input: true },
      startedAt: 1,
      endedAt: 2,
    };
    await expect(
      workflows.updateWorkflowResults({
        workflowName: 'workflow-a',
        runId: 'run-1',
        stepId: 'step-1',
        result,
        requestContext: { requestId: 'req-1' },
      }),
    ).resolves.toEqual({ 'step-1': result });

    expect(requests).toEqual([
      {
        op: 'mergeWorkflowStepResult',
        tableName: 'mastra_workflow_snapshot',
        workflowName: 'workflow-a',
        runId: 'run-1',
        stepId: 'step-1',
        result: JSON.stringify(result),
        requestContext: JSON.stringify({ requestId: 'req-1' }),
      },
    ]);
  });

  it('serializes workflow snapshot-only values before sending step result updates', async () => {
    const requests: StorageRequest[] = [];
    const callStorage = vi.fn(async (request: StorageRequest) => {
      requests.push(request);
      if (request.op === 'mergeWorkflowStepResult') {
        return JSON.stringify({
          [request.stepId]: JSON.parse(request.result),
        });
      }
      return undefined;
    });

    const client = new ConvexAdminClient({
      deploymentUrl: 'https://example.convex.cloud',
      adminAuthToken: 'test-token',
    });
    (client as unknown as { callStorage: typeof callStorage }).callStorage = callStorage;
    const workflows = new WorkflowsConvex({ client });

    const liveStep = {
      response: { messages: ['first', 'second'] },
      [Symbol.for('mastra.workflowSnapshotSerializer')]() {
        return { response: { messages: ['second'] } };
      },
    };

    // Runtime callers get the raw (cumulative) view back for non-foreach results…
    await expect(
      workflows.updateWorkflowResults({
        workflowName: 'workflow-a',
        runId: 'run-1',
        stepId: 'step-1',
        result: { status: 'success', output: { steps: [liveStep] } } as any,
        requestContext: {},
      }),
    ).resolves.toEqual({
      'step-1': { status: 'success', output: { steps: [{ response: { messages: ['first', 'second'] } }] } },
    });

    // …while the payload sent to Convex (what gets persisted) is the serialized delta.
    expect(requests[0]).toMatchObject({
      op: 'mergeWorkflowStepResult',
      result: JSON.stringify({
        status: 'success',
        output: { steps: [{ response: { messages: ['second'] } }] },
      }),
    });
  });

  it('delegates workflow state updates to the Convex storage merge op', async () => {
    const requests: StorageRequest[] = [];
    const callStorage = vi.fn(async (request: StorageRequest) => {
      requests.push(request);
      if (request.op === 'mergeWorkflowState') {
        return JSON.stringify({ runId: request.runId, context: {}, status: JSON.parse(request.opts).status });
      }
      return undefined;
    });

    const client = new ConvexAdminClient({
      deploymentUrl: 'https://example.convex.cloud',
      adminAuthToken: 'test-token',
    });
    (client as unknown as { callStorage: typeof callStorage }).callStorage = callStorage;
    const workflows = new WorkflowsConvex({ client });

    await expect(
      workflows.updateWorkflowState({
        workflowName: 'workflow-a',
        runId: 'run-1',
        opts: { status: 'success' },
      }),
    ).resolves.toEqual({ runId: 'run-1', context: {}, status: 'success' });

    expect(requests).toEqual([
      {
        op: 'mergeWorkflowState',
        tableName: 'mastra_workflow_snapshot',
        workflowName: 'workflow-a',
        runId: 'run-1',
        opts: JSON.stringify({ status: 'success' }),
      },
    ]);
  });
});
