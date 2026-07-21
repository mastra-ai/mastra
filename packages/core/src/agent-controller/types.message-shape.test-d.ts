import { describe, it, expectTypeOf } from 'vitest';
import type { MastraDBMessage } from '../agent/message-list/state/types';
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

  it('carries a MastraDBMessage on message_start/update/end events', () => {
    type MessageEvent = Extract<AgentControllerEvent, { type: 'message_start' | 'message_update' | 'message_end' }>;
    expectTypeOf<MessageEvent['message']>().toEqualTypeOf<MastraDBMessage>();
  });
});
