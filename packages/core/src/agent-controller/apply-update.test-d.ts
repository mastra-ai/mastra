import { describe, it, expectTypeOf } from 'vitest';
import type { MastraDBMessage } from '../agent/message-list/state/types';
import { applyUpdate } from './apply-update';
import type { AgentControllerMessageUpdate } from './apply-update';
import type { AgentControllerEvent } from './types';

describe('applyUpdate types', () => {
  it('accepts every update arm carried by a message_update event', () => {
    const event: AgentControllerEvent = {
      type: 'message_update',
      id: 'm1',
      event: { type: 'text-delta', delta: 'x' },
    };
    if (event.type === 'message_update') {
      expectTypeOf(event.event).toMatchTypeOf<AgentControllerMessageUpdate>();
      expectTypeOf(event.event).toEqualTypeOf<AgentControllerMessageUpdate>();
    }
  });

  it('returns MastraDBMessage | undefined for any input', () => {
    expectTypeOf(applyUpdate(undefined, { type: 'text-delta', delta: 'x' })).toEqualTypeOf<
      MastraDBMessage | undefined
    >();
    expectTypeOf(applyUpdate(undefined, { type: 'reasoning-delta', index: 0, delta: 'x' })).toEqualTypeOf<
      MastraDBMessage | undefined
    >();
    expectTypeOf(applyUpdate(undefined, { type: 'part', index: 0, part: { type: 'text', text: '' } })).toEqualTypeOf<
      MastraDBMessage | undefined
    >();
  });
});
