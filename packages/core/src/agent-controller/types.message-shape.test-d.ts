import { describe, it, expectTypeOf } from 'vitest';
import type { MastraDBMessage, MastraMessagePart } from '../agent/message-list/state/types';
import type { AgentControllerDisplayState, AgentControllerEvent } from './types';

/**
 * BDD contract: the agent-controller now exposes the canonical persisted
 * MastraDBMessage shape (nested `content.parts`) instead of the legacy
 * flattened AgentControllerMessage union.
 */
describe('agent-controller message shape contract', () => {
  it('exposes the streaming currentMessage as MastraDBMessage | null', () => {
    expectTypeOf<AgentControllerDisplayState['currentMessage']>().toEqualTypeOf<MastraDBMessage | null>();
  });

  it('uses compact start, delta, and end payloads', () => {
    expectTypeOf<
      Extract<AgentControllerEvent, { type: 'message_start' }>['message']
    >().toEqualTypeOf<MastraDBMessage>();
    expectTypeOf<Extract<AgentControllerEvent, { type: 'message_update' }>>().toEqualTypeOf<{
      type: 'message_update';
      id: string;
      event:
        | { type: 'text-delta'; delta: string }
        | { type: 'reasoning-delta'; index: number; delta: string }
        | { type: 'part'; index: number; part: MastraMessagePart };
    }>();
    expectTypeOf<Extract<AgentControllerEvent, { type: 'message_end' }>>().toEqualTypeOf<{
      type: 'message_end';
      id: string;
    }>();
  });
});
