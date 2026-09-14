import { describe, expect, it, vi } from 'vitest';
import { MessageList } from '../agent/message-list';
import { createProcessorSendSignal } from './send-signal';

describe('createProcessorSendSignal visibility', () => {
  it.each(['reactive', 'system-reminder'] as const)('emits %s signals and keeps them in the transcript', async type => {
    const messageList = new MessageList({ threadId: 'test-thread' });
    const boundary = vi.spyOn(messageList, 'markResponseMessageBoundary');
    const custom = vi.fn().mockResolvedValue(undefined);
    const rotateResponseMessageId = vi.fn(() => 'next-response');
    const sendSignal = createProcessorSendSignal({
      messageList,
      writer: { custom },
      rotateResponseMessageId,
    });

    const signal = await sendSignal({ type, tagName: 'system-reminder', contents: 'Continue working' });

    expect(custom).toHaveBeenCalledExactlyOnceWith(signal.toDataPart());
    expect(boundary).toHaveBeenCalledOnce();
    expect(rotateResponseMessageId).toHaveBeenCalledOnce();
    expect(messageList.get.all.db()).toEqual([expect.objectContaining({ id: signal.id, role: 'signal' })]);
    expect(JSON.stringify(messageList.get.all.aiV5.model())).toContain('Continue working');
  });

  it.each(['user', 'state'] as const)('emits visible %s signals and retains them in the transcript', async type => {
    const messageList = new MessageList({ threadId: 'test-thread' });
    const custom = vi.fn().mockResolvedValue(undefined);
    const sendSignal = createProcessorSendSignal({ messageList, writer: { custom } });

    const signal = await sendSignal({ type, contents: 'Visible signal' });

    expect(custom).toHaveBeenCalledExactlyOnceWith(signal.toDataPart());
    expect(messageList.get.all.db()).toEqual([expect.objectContaining({ id: signal.id, role: 'signal' })]);
    expect(JSON.stringify(messageList.get.all.aiV5.model())).toContain('Visible signal');
  });
});
