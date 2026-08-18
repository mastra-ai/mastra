import { describe, expect, it } from 'vitest';
import { Session } from './session';
import { createMockWorkspace } from './test-utils';
import type { AgentControllerEvent } from './types';

/**
 * Regression guard for the O(N²) event-stream amplification in
 * https://github.com/mastra-ai/mastra/issues/19201.
 *
 * A streamed turn emits one `message_update` per delta. Before this guard, the
 * bus also fanned out a full `display_state_changed` per delta, and each of
 * those snapshots re-serialized the whole message plus every completed tool's
 * args and result. A wire subscriber therefore paid for the growing message
 * twice per delta, and for every finished tool result once more per delta.
 *
 * These tests measure what a wire subscriber (the SSE route) would actually
 * serialize, so a regression shows up as bytes rather than as event counts.
 */

/** Approximate what the SSE route puts on the wire, including Map expansion. */
function wireBytes(event: AgentControllerEvent): number {
  return JSON.stringify(event, (_key, value) =>
    value instanceof Map ? Object.fromEntries(value) : value instanceof Set ? [...value] : value,
  ).length;
}

const DELTA_COUNT = 500;
const TOOL_RESULT = 'x'.repeat(100_000);

function streamTurn() {
  const session = new Session({ resourceId: 'r1', id: 's1', ownerId: 'o1', workspace: createMockWorkspace() });
  const bytesByType = new Map<string, number>();
  session.subscribe(event => {
    bytesByType.set(event.type, (bytesByType.get(event.type) ?? 0) + wireBytes(event));
  });

  session.emit({ type: 'agent_start' });
  // One finished tool holding a large result, exactly as a real turn would.
  session.emit({ type: 'tool_start', toolCallId: 't1', toolName: 'read_file', args: { path: 'big.txt' } });
  session.emit({ type: 'tool_end', toolCallId: 't1', result: TOOL_RESULT, isError: false });

  const message = {
    id: 'm1',
    role: 'assistant',
    content: { format: 2, parts: [{ type: 'text', text: '' }] },
  };
  session.emit({ type: 'message_start', message: message as any });
  for (let i = 0; i < DELTA_COUNT; i++) {
    message.content.parts[0]!.text += 'token ';
    session.emit({ type: 'message_update', message: message as any });
  }
  session.emit({ type: 'message_end', message: message as any });
  session.emit({ type: 'agent_end', reason: 'complete' });

  return bytesByType;
}

describe('event stream amplification (#19201)', () => {
  it('does not re-ship the completed tool result once per streamed delta', () => {
    const bytesByType = streamTurn();
    const snapshotBytes = bytesByType.get('display_state_changed') ?? 0;

    // Re-sending the 100 KB tool result on every one of the 500 deltas costs
    // ~50 MB on its own. Anything near that means snapshots are amplifying
    // again. The bound is deliberately loose so this fails on the regression,
    // not on ordinary payload drift.
    expect(snapshotBytes).toBeLessThan(DELTA_COUNT * TOOL_RESULT.length * 0.05);
  });

  it('keeps snapshot traffic below the message traffic it mirrors', () => {
    const bytesByType = streamTurn();
    const snapshotBytes = bytesByType.get('display_state_changed') ?? 0;
    const messageBytes = bytesByType.get('message_update') ?? 0;

    // `display_state_changed` carries the same currentMessage as
    // `message_update`, so per-delta snapshots at minimum double the stream.
    // Coalescing them must make the mirror cheaper than the thing it mirrors.
    expect(snapshotBytes).toBeLessThan(messageBytes);
  });

  it('still delivers a final snapshot carrying the finished state', async () => {
    const session = new Session({ resourceId: 'r1', id: 's1', ownerId: 'o1', workspace: createMockWorkspace() });
    const received: AgentControllerEvent[] = [];
    session.subscribe(event => {
      received.push(event);
    });

    session.emit({ type: 'agent_start' });
    session.emit({ type: 'tool_input_start', toolCallId: 't1', toolName: 'read_file' });
    for (let i = 0; i < 20; i++) {
      session.emit({ type: 'tool_input_delta', toolCallId: 't1', argsTextDelta: String(i) });
    }
    session.emit({ type: 'agent_end', reason: 'complete' });

    const snapshots = received.filter(
      (event): event is Extract<AgentControllerEvent, { type: 'display_state_changed' }> =>
        event.type === 'display_state_changed',
    );
    const last = snapshots.at(-1)!;
    // Coalescing drops intermediate snapshots, never the settled state.
    expect(last.displayState.isRunning).toBe(false);
    expect(last.displayState.toolInputBuffers['t1']?.text).toBe('012345678910111213141516171819');
  });
});
