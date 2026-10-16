import type { MastraAction } from '@mastra/core/new-message-format';
import { describe, expect, it } from 'vitest';
import { accumulateChunk } from './accumulator';
import { actionsToMessages, createActionChunker } from './actions';

const base = (id: string, runId = 'run-1') => ({ id, threadId: 't', runId, createdAt: new Date(0) });

const toolRun: MastraAction[] = [
  { ...base('01'), type: 'text', role: 'user', text: 'Weather in Paris?' },
  { ...base('02'), type: 'turn-start' },
  {
    ...base('03'),
    type: 'tool-call',
    role: 'assistant',
    toolCallId: 'c1',
    toolName: 'weather',
    input: { city: 'Paris' },
  },
  { ...base('04'), type: 'tool-result', toolCallId: 'c1', toolName: 'weather', output: { tempC: 21 } },
  { ...base('05'), type: 'turn-end', finishReason: 'tool-calls', usage: {} },
  { ...base('06'), type: 'turn-start' },
  { ...base('07'), type: 'text', role: 'assistant', text: 'It is 21C.', contentId: 'x1' },
  { ...base('08'), type: 'turn-end', finishReason: 'stop', usage: {} },
  { ...base('09'), type: 'run-end', finishReason: 'stop', usage: {} },
] as MastraAction[];

describe('actionsToMessages', () => {
  it('keeps user attachments in the same message as the user text', () => {
    const messages = actionsToMessages([
      { ...base('01'), type: 'text', role: 'user', text: 'What colour?' },
      { ...base('02'), type: 'file', role: 'user', mediaType: 'image/png', data: 'data:image/png;base64,AAA' },
    ] as MastraAction[]);

    expect(messages).toHaveLength(1);
    expect(messages[0]!.content.parts).toEqual([
      { type: 'text', text: 'What colour?' },
      { type: 'file', mimeType: 'image/png', data: 'data:image/png;base64,AAA' },
    ]);
  });

  it('rebuilds a user message and one assistant message per run', () => {
    const messages = actionsToMessages([
      ...toolRun,
      { ...base('10', 'run-2'), type: 'text', role: 'user', text: 'Thanks' } as MastraAction,
    ]);

    expect(messages.map(m => m.role)).toEqual(['user', 'assistant', 'user']);
    expect(messages[0]!.content.parts).toEqual([{ type: 'text', text: 'Weather in Paris?' }]);

    const parts = messages[1]!.content.parts;
    const tool = parts.find(p => p.type === 'tool-invocation') as any;
    expect(tool.toolInvocation).toMatchObject({
      state: 'result',
      toolCallId: 'c1',
      args: { city: 'Paris' },
      result: { tempC: 21 },
    });
    expect(parts.filter(p => p.type === 'text').map((p: any) => p.text)).toEqual(['It is 21C.']);
  });

  it('does not leave a declined tool call awaiting approval on replay', () => {
    const messages = actionsToMessages([
      { ...base('01'), type: 'text', role: 'user', text: 'Delete a.txt' },
      { ...base('02'), type: 'turn-start' },
      { ...base('03'), type: 'tool-call', role: 'assistant', toolCallId: 'd1', toolName: 'deleteFile', input: {} },
      { ...base('04'), type: 'tool-approval-requested', approvalId: 'ap1', toolCallId: 'd1', toolName: 'deleteFile' },
      { ...base('05'), type: 'run-end', finishReason: 'tool-calls', usage: {} },
      { ...base('06'), type: 'tool-approval-responded', approvalId: 'ap1', toolCallId: 'd1', approved: false },
      { ...base('07'), type: 'tool-denied', toolCallId: 'd1', toolName: 'deleteFile' },
      { ...base('08'), type: 'run-end', finishReason: 'stop', usage: {} },
    ] as MastraAction[]);

    const assistant = messages.find(m => m.role === 'assistant')!;
    expect((assistant.content.metadata as any)?.requireApprovalMetadata ?? {}).toEqual({});
    const tool = assistant.content.parts.find(p => p.type === 'tool-invocation') as any;
    expect(tool.toolInvocation.state).toBe('output-denied');
  });
});

describe('createActionChunker (live)', () => {
  it('builds text from deltas and does not duplicate it on the finished action', () => {
    const toChunks = createActionChunker();
    const live: MastraAction[] = [
      { ...base('a'), type: 'turn-start' },
      { ...base('b'), type: 'text-start', transient: true, contentId: 'x' },
      { ...base('c'), type: 'text-delta', transient: true, contentId: 'x', delta: 'Hel' },
      { ...base('d'), type: 'text-delta', transient: true, contentId: 'x', delta: 'lo' },
      { ...base('e'), type: 'text', role: 'assistant', text: 'Hello', contentId: 'x' },
      { ...base('f'), type: 'run-end', finishReason: 'stop', usage: {} },
    ] as MastraAction[];

    let messages: ReturnType<typeof accumulateChunk> = [];
    for (const action of live) {
      for (const chunk of toChunks(action)) {
        messages = accumulateChunk({ chunk, conversation: messages, metadata: { mode: 'stream', runId: 'run-1' } });
      }
    }

    expect(messages).toHaveLength(1);
    expect(messages[0]!.content.parts.filter(p => p.type === 'text').map((p: any) => p.text)).toEqual(['Hello']);
  });

  it('turns an approval request into a tool-call-approval chunk carrying the args', () => {
    const toChunks = createActionChunker();
    toChunks(toolRun[2]!);
    const [chunk] = toChunks({
      ...base('x'),
      type: 'tool-approval-requested',
      approvalId: 'ap1',
      toolCallId: 'c1',
      toolName: 'weather',
    } as MastraAction);
    expect(chunk).toMatchObject({
      type: 'tool-call-approval',
      payload: { toolCallId: 'c1', toolName: 'weather', args: { city: 'Paris' } },
    });
  });
});
