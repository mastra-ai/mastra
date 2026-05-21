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
