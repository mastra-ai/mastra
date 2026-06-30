import { MastraClient } from '@mastra/client-js';
import type { AgentControllerEvent } from '@mastra/client-js';
import { describe, it, expect } from 'vitest';

import { initialTranscript, transcriptReducer } from '../../src/web/ui/transcript';
import { startAgentControllerServer } from './agent-controller-server';
import { startAimock } from './aimock';

/**
 * SSE reconnect scenario — validates the reconnection contract:
 *
 * 1. Subscribe → receive events from first message
 * 2. Disconnect (cancel subscription)
 * 3. Re-subscribe → session.state() re-syncs authoritative state
 * 4. Receive events from second message on the new subscription
 *
 * This exercises the same path the React hook's exponential-backoff
 * reconnection uses: unsubscribe → wait → re-subscribe → state().
 */
describe('web scenario: sse-reconnect', () => {
  it('resumes event delivery after disconnect and reconnect', async () => {
    const aimock = await startAimock('sse-reconnect.json');
    const server = await startAgentControllerServer(aimock.baseUrl);
    const RESOURCE_ID = 'web-scenario-sse-reconnect';

    try {
      const client = new MastraClient({
        baseUrl: server.baseUrl,
        fetch: server.fetch as typeof fetch,
      });
      const controller = client.getAgentController('code');
      const session = controller.session(RESOURCE_ID);

      // --- Phase 1: initial subscribe + first message ---
      await session.create();
      const initialState = await session.state();
      expect(initialState.modeId).toBeTruthy();

      let transcript = initialTranscript;
      const apply = (event: AgentControllerEvent) => {
        transcript = transcriptReducer(transcript, { type: 'event', event });
      };

      const sub1 = await session.subscribe({ onEvent: apply, onError: () => {} });

      // Send first message and wait for response
      await session.sendMessage('before disconnect');

      // Flatten transcript entries to text. Message entries hold ordered
      // content parts; extract text/reasoning parts in order.
      const flatten = () =>
        transcript.entries
          .map(e => {
            if (e.kind === 'message') {
              return e.message.content.parts
                .map(part => {
                  if (part.type === 'text') return part.text;
                  if (part.type === 'reasoning') return part.reasoning;
                  return '';
                })
                .join('');
            }
            if (e.kind === 'notice') return e.text;
            return '';
          })
          .join('\n');

      // Wait for assistant response in transcript
      const waitForText = async (pattern: string, timeoutMs = 15_000) => {
        const start = Date.now();
        while (Date.now() - start < timeoutMs) {
          if (flatten().includes(pattern)) return;
          await new Promise(r => setTimeout(r, 25));
        }
        throw new Error(`timeout waiting for "${pattern}"\n--- transcript ---\n${flatten()}`);
      };

      await waitForText('PRE_DISCONNECT_RESPONSE');
      const preDisconnectEntries = transcript.entries.length;
      expect(preDisconnectEntries).toBeGreaterThan(0);

      // --- Phase 2: disconnect ---
      sub1.unsubscribe();

      // --- Phase 3: re-subscribe (what the hook does on reconnect) ---
      // Re-sync state (the authoritative snapshot — exactly what useAgentControllerSession does).
      const reconnectState = await session.state();
      expect(reconnectState.modeId).toBeTruthy();
      expect(reconnectState.threadId).toBeTruthy();

      // Reset transcript to match reconnection behavior (hook dispatches 'reset').
      transcript = transcriptReducer(transcript, {
        type: 'reset',
        modeId: reconnectState.modeId,
        modelId: reconnectState.modelId,
        threadId: reconnectState.threadId,
      });

      const sub2 = await session.subscribe({ onEvent: apply, onError: () => {} });

      // --- Phase 4: second message on new subscription ---
      await session.sendMessage('after reconnect');
      await waitForText('POST_RECONNECT_RESPONSE');

      // Verify both pre- and post-reconnect behavior:
      // 1. State re-sync succeeded (reconnectState had valid data)
      // 2. New subscription delivers events (POST_RECONNECT_RESPONSE appeared)
      expect(flatten()).toContain('POST_RECONNECT_RESPONSE');

      sub2.unsubscribe();
    } finally {
      await server.stop();
      await aimock.stop();
    }
  });
});
