import { describe, expect, it } from 'vitest';

import { signalToMastraDBMessage } from '../../signals';
import { AIV4Adapter } from './AIV4Adapter';
import { AIV5Adapter } from './AIV5Adapter';
import { AIV6Adapter } from './AIV6Adapter';

describe('agent signal UI conversion', () => {
  it('converts user-message signals to user UI messages', () => {
    const dbMessage = signalToMastraDBMessage({
      id: 'signal-user-1',
      type: 'user-message',
      contents: 'Hello from the user',
      createdAt: new Date('2024-01-01T00:00:00.000Z'),
    });

    expect(AIV4Adapter.toUIMessage(dbMessage)).toMatchObject({
      id: 'signal-user-1',
      role: 'user',
      content: 'Hello from the user',
      parts: [{ type: 'text', text: 'Hello from the user' }],
    });
    expect(AIV5Adapter.toUIMessage(dbMessage)).toMatchObject({
      id: 'signal-user-1',
      role: 'user',
      parts: [{ type: 'text', text: 'Hello from the user' }],
    });
    expect(AIV6Adapter.toUIMessage(dbMessage)).toMatchObject({
      id: 'signal-user-1',
      role: 'user',
      parts: [{ type: 'text', text: 'Hello from the user' }],
    });
  });

  it('converts non-user signals to user messages with the signal contents as text parts', () => {
    const dbMessage = signalToMastraDBMessage({
      id: 'signal-system-1',
      type: 'system-reminder',
      contents: 'continue',
      createdAt: new Date('2024-01-01T00:00:00.000Z'),
      metadata: { reminderType: 'anthropic-prefill-processor-retry' },
    });

    for (const uiMessage of [
      AIV4Adapter.toUIMessage(dbMessage),
      AIV5Adapter.toUIMessage(dbMessage),
      AIV6Adapter.toUIMessage(dbMessage),
    ]) {
      expect(uiMessage.role).toBe('user');
      expect(uiMessage.parts).toEqual([{ type: 'text', text: 'continue' }]);
    }

    expect(AIV4Adapter.toUIMessage(dbMessage).content).toBe('continue');
  });
});
