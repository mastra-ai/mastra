import { describe, expect, it, vi } from 'vitest';

import { PiMessageAdapter, type PiMessageSession } from '../message-adapter.js';
import { MastraPiExtensionGeneration } from '../runtime.js';

function fixture(withNotifications = true) {
  const generation = new MastraPiExtensionGeneration('plugin', 'extension', '/tmp/entry.ts');
  const session: PiMessageSession = {
    sendMessage: vi.fn().mockResolvedValue(undefined),
    steer: vi.fn().mockResolvedValue(undefined),
    followUp: vi.fn().mockResolvedValue(undefined),
    sendNotificationSignal: withNotifications ? vi.fn().mockResolvedValue(undefined) : undefined,
  };
  return { generation, session, adapter: new PiMessageAdapter(generation, () => session) };
}

describe('Pi message adapter', () => {
  it('maps user delivery modes to host-owned session queues', async () => {
    const { adapter, session } = fixture();
    await adapter.sendUserMessage('now');
    await adapter.sendUserMessage({ content: [{ type: 'text', text: 'redirect' }] }, { deliverAs: 'steer' });
    await adapter.sendUserMessage('later', { deliverAs: 'followUp' });
    expect(session.sendMessage).toHaveBeenCalledWith({ content: 'now' });
    expect(session.steer).toHaveBeenCalledWith({ content: 'redirect' });
    expect(session.followUp).toHaveBeenCalledWith({ content: 'later' });
  });

  it('uses notification signals for custom messages without mutating transcripts', async () => {
    const { adapter, generation, session } = fixture();
    await adapter.sendMessage({ text: 'owned status' }, { triggerTurn: true });
    expect(session.sendNotificationSignal).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'owned status', metadata: { pluginId: 'plugin', extensionId: 'extension' } }),
    );
    expect(
      generation.compatibility.diagnostics.some(diagnostic => diagnostic.capability === 'sendMessage:triggerTurn'),
    ).toBe(true);
  });

  it('diagnoses unsupported no-turn delivery and stale actions', async () => {
    const { adapter, generation, session } = fixture();
    await adapter.sendUserMessage('do not persist', { triggerTurn: false });
    expect(session.sendMessage).not.toHaveBeenCalled();
    expect(generation.compatibility.diagnostics.some(diagnostic => diagnostic.capability === 'sendUserMessage')).toBe(
      true,
    );
    await generation.invalidate();
    await expect(adapter.sendMessage('late')).rejects.toThrow('stale');
  });
});
