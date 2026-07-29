import { describe, expect, it } from 'vitest';
import { expandStreamStateRequestBodies } from '../../stream/base/serialized-state';
import type { WorkflowRunState } from '../../workflows/types';
import { pruneAgentLoopSnapshot } from './prune-snapshot';

function countOccurrences(value: unknown, marker: string) {
  return JSON.stringify(value).split(marker).length - 1;
}

describe('pruneAgentLoopSnapshot request bodies', () => {
  it('compacts repeated step request bodies in live and foreach suspension state', () => {
    const requestMarker = 'request-body-marker';
    const requestBody = {
      system: requestMarker.repeat(50_000),
      tools: [{ name: 'approvalTool', schema: { type: 'object' } }],
    };
    const streamState = {
      status: 'suspended',
      bufferedSteps: Array.from({ length: 13 }, (_, index) => ({
        text: `step-${index}`,
        request: { body: requestBody, headers: { 'x-step': String(index) } },
      })),
      messageList: { messages: [] },
    };
    const suspendedEntry = {
      status: 'suspended',
      suspendPayload: { __streamState: streamState },
    };
    const snapshot = {
      status: 'suspended',
      context: {
        input: {},
        loop: {
          status: 'suspended',
          suspendPayload: {
            __streamState: streamState,
            __workflow_meta: { foreachOutput: { 0: suspendedEntry } },
          },
        },
      },
      result: undefined,
    } as unknown as WorkflowRunState;
    const unprunedSize = JSON.stringify(snapshot).length;

    const pruned = pruneAgentLoopSnapshot({ snapshot });
    const prunedSize = JSON.stringify(pruned).length;
    const suspendPayload = (pruned.context as any).loop.suspendPayload;
    const liveState = suspendPayload.__streamState;
    const foreachState = suspendPayload.__workflow_meta.foreachOutput[0].suspendPayload.__streamState;

    expect(unprunedSize).toBeGreaterThan(16 * 1024 * 1024);
    expect(prunedSize).toBeLessThan(16 * 1024 * 1024);
    expect(countOccurrences(pruned, requestBody.system)).toBe(2);
    expect(prunedSize).toBeLessThan(unprunedSize * 0.15);
    expect(expandStreamStateRequestBodies(liveState)).toEqual(streamState);
    expect(expandStreamStateRequestBodies(foreachState)).toEqual(streamState);

    // Snapshot pruning remains copy-on-write.
    expect((snapshot.context as any).loop.suspendPayload.__streamState.bufferedSteps[12].request.body).toBe(
      requestBody,
    );
  });
});
