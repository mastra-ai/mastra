import type { MastraDBMessage, MastraMessagePart } from '@mastra/core/agent-controller';
import { describe, it, expect } from 'vitest';

import { createInitialTranscript } from '../../src/web/ui/domains/chat/services/transcript.js';
import type { MessageEntry, TimelineEntry } from '../../src/web/ui/domains/chat/services/transcript.js';

/** Flatten a message entry's ordered text/reasoning parts to a string. */
function messageText(entry: TimelineEntry): string {
  if (entry.kind !== 'message') return '';
  return entry.message.content.parts
    .map(part => {
      if (part.type === 'text') return part.text;
      if (part.type === 'reasoning') return part.reasoning;
      return '';
    })
    .join('');
}

function toolParts(entry: MessageEntry) {
  return entry.message.content.parts.filter(part => part.type === 'tool-invocation');
}

/**
 * Switching to an existing thread must render its persisted history. The
 * thread's messages aren't replayed over the event stream, so the hook/driver
 * load them via listMessages and build a fresh transcript with
 * `createInitialTranscript`. This guards the regression where selecting a
 * thread showed an empty transcript.
 */
function msg(id: string, role: MastraDBMessage['role'], parts: MastraMessagePart[]): MastraDBMessage {
  return { id, role, createdAt: new Date(), content: { format: 2, parts } };
}
function userMsg(id: string, text: string): MastraDBMessage {
  return msg(id, 'user', [{ type: 'text', text }]);
}
function assistantMsg(id: string, text: string): MastraDBMessage {
  return msg(id, 'assistant', [{ type: 'text', text }]);
}
function systemMsg(id: string, text: string): MastraDBMessage {
  return msg(id, 'system', [{ type: 'text', text }]);
}

describe('initial transcript (thread history rendering)', () => {
  it('builds user and assistant entries from persisted messages', () => {
    const messages = [userMsg('u1', 'hello there'), assistantMsg('a1', 'hi, how can I help?')];
    const state = createInitialTranscript({ messages, threadId: 'thread-1' });

    expect(state.threadId).toBe('thread-1');
    expect(state.entries).toHaveLength(2);
    expect(state.entries[0]).toMatchObject({ kind: 'message', id: 'u1', message: { role: 'user' } });
    expect(messageText(state.entries[0])).toBe('hello there');
    expect(state.entries[1]).toMatchObject({
      kind: 'message',
      id: 'a1',
      message: { role: 'assistant' },
      streaming: false,
    });
    expect(messageText(state.entries[1])).toBe('hi, how can I help?');
  });

  it('keeps system messages in the message timeline', () => {
    const messages = [systemMsg('s1', 'you are a coding agent'), userMsg('u1', 'go')];
    const state = createInitialTranscript({ messages, threadId: 't' });
    expect(state.entries.map(e => (e.kind === 'message' ? e.message.role : e.kind))).toEqual(['system', 'user']);
    expect(messageText(state.entries[0])).toBe('you are a coding agent');
  });

  it('replaces prior transcript contents (switching threads is a clean swap)', () => {
    // Start with one thread's content.
    let state = createInitialTranscript({ messages: [userMsg('u1', 'thread A message')], threadId: 'A' });
    expect(state.entries).toHaveLength(1);

    // Switch to another thread — only B's history should remain.
    state = createInitialTranscript({
      messages: [userMsg('u2', 'thread B message'), assistantMsg('a2', 'reply in B')],
      threadId: 'B',
    });
    expect(state.threadId).toBe('B');
    expect(state.entries).toHaveLength(2);
    const allText = state.entries.map(e => messageText(e)).join('\n');
    expect(allText).toContain('thread B message');
    expect(allText).not.toContain('thread A message');
  });

  it('reconstructs tool calls (name, args, result) on the assistant entry', () => {
    const assistantWithTool = msg('a1', 'assistant', [
      { type: 'text', text: 'Let me read that file.' },
      {
        type: 'tool-invocation',
        toolInvocation: {
          state: 'result',
          toolCallId: 'tc-1',
          toolName: 'read_file',
          args: { path: 'README.md' },
          result: 'file contents here',
        },
      },
    ]);

    const state = createInitialTranscript({
      messages: [userMsg('u1', 'read the readme'), assistantWithTool],
      threadId: 't',
    });

    const assistant = state.entries.find(e => e.kind === 'message' && e.message.role === 'assistant');
    expect(assistant).toBeDefined();
    if (assistant?.kind !== 'message') throw new Error('expected assistant entry');
    expect(messageText(assistant)).toBe('Let me read that file.');
    const tools = toolParts(assistant);
    expect(tools).toHaveLength(1);
    expect(tools[0]?.toolInvocation).toMatchObject({
      state: 'result',
      toolCallId: 'tc-1',
      toolName: 'read_file',
      result: 'file contents here',
    });
  });

  it('preserves execution order: text → tool → text interleaved, not grouped', () => {
    const message = msg('a1', 'assistant', [
      { type: 'text', text: 'First I will read it.' },
      {
        type: 'tool-invocation',
        toolInvocation: {
          state: 'result',
          toolCallId: 'tc-1',
          toolName: 'read_file',
          args: { path: 'a.ts' },
          result: 'contents',
        },
      },
      { type: 'text', text: 'Now I will edit it.' },
      {
        type: 'tool-invocation',
        toolInvocation: {
          state: 'result',
          toolCallId: 'tc-2',
          toolName: 'write_file',
          args: { path: 'a.ts' },
          result: 'ok',
        },
      },
      { type: 'text', text: 'Done.' },
    ]);
    const state = createInitialTranscript({ messages: [message], threadId: 't' });
    const assistant = state.entries[0];
    if (assistant.kind !== 'message') throw new Error('expected assistant entry');
    // The part order must mirror content order, not bucket tools at the end.
    expect(
      assistant.message.content.parts.map(part =>
        part.type === 'tool-invocation' ? `tool:${part.toolInvocation.toolCallId}` : part.type,
      ),
    ).toEqual(['text', 'tool:tc-1', 'text', 'tool:tc-2', 'text']);
  });

  it('marks a tool as errored when its result is an error', () => {
    const message = msg('a1', 'assistant', [
      {
        type: 'tool-invocation',
        toolInvocation: {
          state: 'output-error',
          toolCallId: 'tc-9',
          toolName: 'shell',
          args: { cmd: 'nope' },
          result: 'command not found',
          errorText: 'command not found',
        },
      },
    ]);
    const state = createInitialTranscript({ messages: [message], threadId: 't' });
    const assistant = state.entries[0];
    if (assistant.kind !== 'message') throw new Error('expected assistant entry');
    const [tool] = toolParts(assistant);
    expect(tool?.toolInvocation.state).toBe('output-error');
    expect(tool?.toolInvocation.result).toBe('command not found');
    expect(tool?.toolInvocation.errorText).toBe('command not found');
  });

  it('produces an empty transcript for a thread with no history', () => {
    const state = createInitialTranscript({ messages: [], threadId: 'empty' });
    expect(state.entries).toHaveLength(0);
    expect(state.threadId).toBe('empty');
    expect(state.pending).toBe(false);
  });
});
