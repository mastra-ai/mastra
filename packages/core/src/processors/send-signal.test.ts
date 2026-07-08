/**
 * Tests for packages/core/src/processors/send-signal.ts
 *
 * `createProcessorSendSignal` is a factory whose returned function
 * orchestrates calls across `createSignal`, a `MessageList`, and an
 * optional `ProcessorStreamWriter`. `createSignal` is mocked so the tests
 * focus purely on the orchestration logic in this file.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';

import type { AgentSignalInput, CreatedAgentSignal } from '../agent/signals';
import { createProcessorSendSignal } from './send-signal';

const { createSignalMock } = vi.hoisted(() => ({
  createSignalMock: vi.fn(),
}));

vi.mock('../agent/signals', () => ({
  createSignal: createSignalMock,
}));

function buildCreatedSignal(overrides: Partial<CreatedAgentSignal> = {}): CreatedAgentSignal {
  return {
    id: 'signal-1',
    type: 'progress',
    toDataPart: vi.fn(() => ({ type: 'data-signal', data: { id: 'signal-1' } })),
    ...overrides,
  } as unknown as CreatedAgentSignal;
}

function buildMessageList(addSignalReturn: CreatedAgentSignal) {
  return {
    markResponseMessageBoundary: vi.fn(),
    addSignal: vi.fn(() => addSignalReturn),
  };
}

beforeEach(() => {
  createSignalMock.mockReset();
});

describe('createProcessorSendSignal', () => {
  it('calls createSignal with the provided signal input', async () => {
    const created = buildCreatedSignal();
    createSignalMock.mockReturnValue(created);
    const messageList = buildMessageList(created);
    const input: AgentSignalInput = { type: 'progress' } as AgentSignalInput;

    const sendSignal = createProcessorSendSignal({ messageList: messageList as any });
    await sendSignal(input);

    expect(createSignalMock).toHaveBeenCalledWith(input);
  });

  it('marks a response message boundary before adding the signal', async () => {
    const created = buildCreatedSignal();
    createSignalMock.mockReturnValue(created);
    const messageList = buildMessageList(created);
    const callOrder: string[] = [];
    messageList.markResponseMessageBoundary.mockImplementation(() => callOrder.push('boundary'));
    messageList.addSignal.mockImplementation(() => {
      callOrder.push('addSignal');
      return created;
    });

    const sendSignal = createProcessorSendSignal({ messageList: messageList as any });
    await sendSignal({ type: 'progress' } as AgentSignalInput);

    expect(callOrder).toEqual(['boundary', 'addSignal']);
  });

  it('adds the created signal to the message list', async () => {
    const created = buildCreatedSignal();
    createSignalMock.mockReturnValue(created);
    const messageList = buildMessageList(created);

    const sendSignal = createProcessorSendSignal({ messageList: messageList as any });
    await sendSignal({ type: 'progress' } as AgentSignalInput);

    expect(messageList.addSignal).toHaveBeenCalledWith(created);
  });

  it('resolves with the signal returned by messageList.addSignal', async () => {
    const created = buildCreatedSignal();
    const returnedFromList = buildCreatedSignal({ id: 'signal-from-list' });
    createSignalMock.mockReturnValue(created);
    const messageList = buildMessageList(returnedFromList);

    const sendSignal = createProcessorSendSignal({ messageList: messageList as any });
    const result = await sendSignal({ type: 'progress' } as AgentSignalInput);

    expect(result).toBe(returnedFromList);
  });

  it('calls rotateResponseMessageId when provided', async () => {
    const created = buildCreatedSignal();
    createSignalMock.mockReturnValue(created);
    const messageList = buildMessageList(created);
    const rotateResponseMessageId = vi.fn(() => 'new-id');

    const sendSignal = createProcessorSendSignal({ messageList: messageList as any, rotateResponseMessageId });
    await sendSignal({ type: 'progress' } as AgentSignalInput);

    expect(rotateResponseMessageId).toHaveBeenCalledTimes(1);
  });

  it('does not throw when rotateResponseMessageId is omitted', async () => {
    const created = buildCreatedSignal();
    createSignalMock.mockReturnValue(created);
    const messageList = buildMessageList(created);

    const sendSignal = createProcessorSendSignal({ messageList: messageList as any });

    await expect(sendSignal({ type: 'progress' } as AgentSignalInput)).resolves.toBeDefined();
  });

  it('calls writer.custom with the toDataPart() output when a writer is provided', async () => {
    const dataPart = { type: 'data-signal', data: { id: 'signal-1' } };
    const created = buildCreatedSignal({ toDataPart: vi.fn(() => dataPart) } as any);
    createSignalMock.mockReturnValue(created);
    const messageList = buildMessageList(created);
    const writer = { custom: vi.fn() };

    const sendSignal = createProcessorSendSignal({ messageList: messageList as any, writer: writer as any });
    await sendSignal({ type: 'progress' } as AgentSignalInput);

    expect(writer.custom).toHaveBeenCalledWith(dataPart);
  });

  it('does not throw when writer is omitted', async () => {
    const created = buildCreatedSignal();
    createSignalMock.mockReturnValue(created);
    const messageList = buildMessageList(created);

    const sendSignal = createProcessorSendSignal({ messageList: messageList as any });

    await expect(sendSignal({ type: 'progress' } as AgentSignalInput)).resolves.toBeDefined();
  });

  it('awaits writer.custom before resolving', async () => {
    const dataPart = { type: 'data-signal', data: {} };
    const created = buildCreatedSignal({ toDataPart: vi.fn(() => dataPart) } as any);
    createSignalMock.mockReturnValue(created);
    const messageList = buildMessageList(created);

    let writerResolved = false;
    const writer = {
      custom: vi.fn(
        () =>
          new Promise<void>(resolve => {
            setTimeout(() => {
              writerResolved = true;
              resolve();
            }, 0);
          }),
      ),
    };

    const sendSignal = createProcessorSendSignal({ messageList: messageList as any, writer: writer as any });
    await sendSignal({ type: 'progress' } as AgentSignalInput);

    expect(writerResolved).toBe(true);
  });
});
