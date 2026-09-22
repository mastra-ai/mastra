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

  it('does not mark a response boundary when no rotation is wired (issue #21940)', async () => {
    const messageList = new MessageList({ threadId: 'test-thread' });
    const boundary = vi.spyOn(messageList, 'markResponseMessageBoundary');
    const custom = vi.fn().mockResolvedValue(undefined);
    const sendSignal = createProcessorSendSignal({ messageList, writer: { custom } });

    const signal = await sendSignal({ type: 'reactive', contents: 'Inspect the tool result before acting again.' });

    // Without rotateResponseMessageId the in-flight response message must not be
    // sealed: the next step streams under the same message id and relies on
    // merging. A boundary stamp blocks MessageMerger and turns the same-id add
    // into a destructive replacement that drops tool call/result parts.
    expect(boundary).not.toHaveBeenCalled();
    expect(custom).toHaveBeenCalledExactlyOnceWith(signal.toDataPart());
    expect(messageList.get.all.db()).toEqual([expect.objectContaining({ id: signal.id, role: 'signal' })]);
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
