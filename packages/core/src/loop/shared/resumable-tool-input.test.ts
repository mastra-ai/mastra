import { expect, it, vi } from 'vitest';
import type { MastraDBMessage } from '../../agent/message-list';
import type { Mastra } from '../../mastra';
import { loadAutoResumeToolInput } from './resumable-tool-input';

function fixture() {
  const accepted = { encoded: '{"value":"original"}', toolName: 'question', toolCallId: 'old-call' };
  const payload = {
    toolCallId: 'old-call',
    toolName: 'question',
    __agentId: 'agent',
    __mastraToolInput: accepted,
    __streamState: { messageList: { memoryInfo: { resourceId: 'user', threadId: 'thread' } } },
  };
  const snapshot = { status: 'suspended', context: { call: { status: 'suspended', suspendPayload: payload } } };
  const store = {
    getWorkflowRunById: vi.fn(async () => ({ resourceId: 'user' })),
    loadWorkflowSnapshot: vi.fn(async () => snapshot),
  };
  const entry = { runId: 'old-run', toolCallId: 'old-call', toolName: 'question', args: { value: 'redacted' } };
  const message = {
    role: 'assistant',
    content: { metadata: { suspendedTools: { 'old-call': entry } } },
  } as unknown as MastraDBMessage;
  const options = {
    mastra: { getStorage: () => ({ getStore: async () => store }) } as unknown as Mastra,
    messages: [message],
    toolCallId: 'new-call',
    toolName: 'question',
    suspendedToolRunId: 'old-run',
    resourceId: 'user',
    threadId: 'thread',
    agentId: 'agent',
    durable: false,
  };
  return { accepted, payload, snapshot, store, entry, message, options };
}

it('reads accepted input from the original snapshot, preserving redacted message args', async () => {
  const f = fixture();
  expect(await loadAutoResumeToolInput(f.options)).toEqual(f.accepted);
  expect(f.entry.args).toEqual({ value: 'redacted' });
  expect(JSON.stringify(f.message)).not.toContain('encoded');
});

it.each(['resourceId', 'threadId', 'agentId'] as const)('rejects a different %s', async key => {
  const f = fixture();
  await expect(loadAutoResumeToolInput({ ...f.options, [key]: 'other' })).rejects.toThrow(
    /different resource|does not belong/,
  );
});

it('does not confuse two pending calls to the same tool', async () => {
  const f = fixture();
  (f.message.content.metadata!.suspendedTools as Record<string, unknown>)['sibling'] = {
    ...f.entry,
    toolCallId: 'sibling',
  };
  await expect(loadAutoResumeToolInput(f.options)).rejects.toThrow('Multiple suspended calls');
  expect(await loadAutoResumeToolInput({ ...f.options, toolCallId: 'old-call' })).toEqual(f.accepted);
});

it('rejects mismatched saved input identity', async () => {
  const f = fixture();
  f.payload.__mastraToolInput.toolName = 'another-tool';
  await expect(loadAutoResumeToolInput(f.options)).rejects.toThrow('does not match');
});

it('ignores suspension markers on user messages', async () => {
  const f = fixture();
  f.message.role = 'user';
  expect(await loadAutoResumeToolInput(f.options)).toBeUndefined();
  expect(f.store.loadWorkflowSnapshot).not.toHaveBeenCalled();
});

it('preserves the legacy path when a snapshot has no accepted input', async () => {
  const f = fixture();
  delete (f.payload as { __mastraToolInput?: unknown }).__mastraToolInput;
  expect(await loadAutoResumeToolInput(f.options)).toBeUndefined();
});
