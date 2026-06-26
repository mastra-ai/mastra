import type { HarnessMessage } from '@mastra/client-js';
import { describe, it, expect } from 'vitest';

import { initialTranscript, transcriptReducer } from '../../src/web/ui/transcript.js';
import type { TimelineEntry } from '../../src/web/ui/transcript.js';

/** Flatten an assistant entry's ordered text/thinking segments to a string. */
function assistantText(entry: TimelineEntry): string {
  if (entry.kind !== 'assistant') return '';
  return entry.segments.map(s => (s.kind === 'text' || s.kind === 'thinking' ? s.text : '')).join('');
}

/**
 * Switching to an existing thread must render its persisted history. The
 * thread's messages aren't replayed over the event stream, so the hook/driver
 * load them via listMessages and dispatch a `hydrate` action. This guards the
 * regression where selecting a thread showed an empty transcript.
 */
function userMsg(id: string, text: string): HarnessMessage {
  return { id, role: 'user', content: [{ type: 'text', text }] } as unknown as HarnessMessage;
}
function assistantMsg(id: string, text: string): HarnessMessage {
  return { id, role: 'assistant', content: [{ type: 'text', text }] } as unknown as HarnessMessage;
}
function systemMsg(id: string, text: string): HarnessMessage {
  return { id, role: 'system', content: [{ type: 'text', text }] } as unknown as HarnessMessage;
}

describe('transcript hydrate (thread history rendering)', () => {
  it('builds user and assistant entries from persisted messages', () => {
    const messages = [userMsg('u1', 'hello there'), assistantMsg('a1', 'hi, how can I help?')];
    const state = transcriptReducer(initialTranscript, {
      type: 'hydrate',
      messages,
      threadId: 'thread-1',
      modeId: 'build',
      modelId: 'openai/gpt-5.4-mini',
    });

    expect(state.threadId).toBe('thread-1');
    expect(state.modeId).toBe('build');
    expect(state.modelId).toBe('openai/gpt-5.4-mini');
    expect(state.entries).toHaveLength(2);
    expect(state.entries[0]).toMatchObject({ kind: 'user', id: 'u1', text: 'hello there' });
    expect(state.entries[1]).toMatchObject({ kind: 'assistant', id: 'a1', streaming: false });
    expect(assistantText(state.entries[1])).toBe('hi, how can I help?');
  });

  it('omits system messages from the rendered transcript', () => {
    const messages = [systemMsg('s1', 'you are a coding agent'), userMsg('u1', 'go')];
    const state = transcriptReducer(initialTranscript, { type: 'hydrate', messages, threadId: 't' });
    expect(state.entries.map(e => e.kind)).toEqual(['user']);
  });

  it('replaces prior transcript contents (switching threads is a clean swap)', () => {
    // Start with one thread's content.
    let state = transcriptReducer(initialTranscript, {
      type: 'hydrate',
      messages: [userMsg('u1', 'thread A message')],
      threadId: 'A',
    });
    expect(state.entries).toHaveLength(1);

    // Switch to another thread — only B's history should remain.
    state = transcriptReducer(state, {
      type: 'hydrate',
      messages: [userMsg('u2', 'thread B message'), assistantMsg('a2', 'reply in B')],
      threadId: 'B',
    });
    expect(state.threadId).toBe('B');
    expect(state.entries).toHaveLength(2);
    const allText = state.entries.map(e => (e.kind === 'user' ? e.text : assistantText(e))).join('\n');
    expect(allText).toContain('thread B message');
    expect(allText).not.toContain('thread A message');
  });

  it('reconstructs tool calls (name, args, result) on the assistant entry', () => {
    const assistantWithTool: HarnessMessage = {
      id: 'a1',
      role: 'assistant',
      content: [
        { type: 'text', text: 'Let me read that file.' },
        { type: 'tool_call', id: 'tc-1', name: 'read_file', args: { path: 'README.md' } },
        { type: 'tool_result', id: 'tc-1', result: 'file contents here', isError: false },
      ],
    } as unknown as HarnessMessage;

    const state = transcriptReducer(initialTranscript, {
      type: 'hydrate',
      messages: [userMsg('u1', 'read the readme'), assistantWithTool],
      threadId: 't',
    });

    const assistant = state.entries.find(e => e.kind === 'assistant');
    expect(assistant).toBeDefined();
    if (assistant?.kind !== 'assistant') throw new Error('expected assistant entry');
    expect(assistantText(assistant)).toBe('Let me read that file.');
    const toolIds = Object.keys(assistant.toolsById);
    expect(toolIds).toHaveLength(1);
    expect(assistant.toolsById['tc-1']).toMatchObject({
      toolCallId: 'tc-1',
      toolName: 'read_file',
      args: { path: 'README.md' },
      status: 'done',
      result: 'file contents here',
    });
  });

  it('preserves execution order: text → tool → text interleaved, not grouped', () => {
    const msg: HarnessMessage = {
      id: 'a1',
      role: 'assistant',
      content: [
        { type: 'text', text: 'First I will read it.' },
        { type: 'tool_call', id: 'tc-1', name: 'read_file', args: { path: 'a.ts' } },
        { type: 'tool_result', id: 'tc-1', result: 'contents', isError: false },
        { type: 'text', text: 'Now I will edit it.' },
        { type: 'tool_call', id: 'tc-2', name: 'write_file', args: { path: 'a.ts' } },
        { type: 'tool_result', id: 'tc-2', result: 'ok', isError: false },
        { type: 'text', text: 'Done.' },
      ],
    } as unknown as HarnessMessage;
    const state = transcriptReducer(initialTranscript, { type: 'hydrate', messages: [msg], threadId: 't' });
    const assistant = state.entries[0];
    if (assistant.kind !== 'assistant') throw new Error('expected assistant entry');
    // The segment order must mirror content order, not bucket tools at the end.
    expect(assistant.segments.map(s => (s.kind === 'tool' ? `tool:${s.toolCallId}` : s.kind))).toEqual([
      'text',
      'tool:tc-1',
      'text',
      'tool:tc-2',
      'text',
    ]);
  });

  it('marks a tool as errored when its result is an error', () => {
    const msg: HarnessMessage = {
      id: 'a1',
      role: 'assistant',
      content: [
        { type: 'tool_call', id: 'tc-9', name: 'shell', args: { cmd: 'nope' } },
        { type: 'tool_result', id: 'tc-9', result: 'command not found', isError: true },
      ],
    } as unknown as HarnessMessage;
    const state = transcriptReducer(initialTranscript, { type: 'hydrate', messages: [msg], threadId: 't' });
    const assistant = state.entries[0];
    if (assistant.kind !== 'assistant') throw new Error('expected assistant entry');
    expect(assistant.toolsById['tc-9'].status).toBe('error');
  });

  it('produces an empty transcript for a thread with no history', () => {
    const state = transcriptReducer(initialTranscript, { type: 'hydrate', messages: [], threadId: 'empty' });
    expect(state.entries).toHaveLength(0);
    expect(state.threadId).toBe('empty');
    expect(state.running).toBe(false);
  });
});
