import { describe, expect, it } from 'vitest';
import type { MastraDBMessage } from '../';
import { MessageList } from '../index';

// Regression coverage for the abort-orphaned-tool fix (#17995). The fix leaves an
// abort-cancelled tool as an incomplete `state:'call'`, not a fabricated `state:'result'`
// carrying the abort message. This drives that shape through the real to-LLM prompt path
// (`get.all.aiV5.prompt()`, filterIncompleteToolCalls=true) and proves the call is dropped
// before the model. Load-bearing: feed the PRE-fix shape (`state:'result'`, result =
// 'The operation was aborted.') and every assertion below fails (the abort string reaches
// the model) — the silent fake-success the fix prevents.

function userMessage(text: string, id = 'u1'): MastraDBMessage {
  return { id, role: 'user', content: { format: 2, parts: [{ type: 'text', text }] }, createdAt: new Date() } as any;
}

function assistantMessage(parts: MastraDBMessage['content']['parts'], id = 'a1'): MastraDBMessage {
  return { id, role: 'assistant', content: { format: 2, parts }, createdAt: new Date() } as any;
}

/** Collect tool_use and tool_result ids from converted model messages. */
function collectToolPairs(modelMessages: any[]) {
  const toolCalls = new Set<string>();
  const toolResults = new Set<string>();
  for (const m of modelMessages) {
    if (!Array.isArray(m.content)) continue;
    for (const part of m.content) {
      if (part?.type === 'tool-call') toolCalls.add(part.toolCallId);
      if (part?.type === 'tool-result') toolResults.add(part.toolCallId);
    }
  }
  return { toolCalls, toolResults };
}

describe('aborted tool call — to-LLM prompt (resume) path', () => {
  it('drops an aborted server tool left as an incomplete call so the model never sees a fabricated result', () => {
    const messageList = new MessageList();
    messageList.add(userMessage('do the important write'), 'memory');
    messageList.add(
      assistantMessage([
        { type: 'text', text: 'On it.' },
        {
          type: 'tool-invocation',
          toolInvocation: { state: 'call', toolCallId: 'srv-1', toolName: 'slowServerTool', args: { q: 'important' } },
        },
      ]),
      'memory',
    );

    const prompt = messageList.get.all.aiV5.prompt();
    const serialized = JSON.stringify(prompt);
    const { toolCalls, toolResults } = collectToolPairs(prompt);

    // 1. The aborted tool is dropped before the model (no tool_use for it).
    expect(toolCalls.has('srv-1')).toBe(false);

    // 2. The abort message never reaches the model.
    expect(serialized).not.toContain('The operation was aborted');

    // 3. tool_use / tool_result pairing invariant holds (no orphan).
    expect([...toolCalls].sort()).toEqual([...toolResults].sort());
  });

  it('mixed turn: drops the aborted server tool but keeps the completed client tool as a valid pair', () => {
    const messageList = new MessageList();
    messageList.add(userMessage('write and look up x'), 'memory');
    messageList.add(
      assistantMessage([
        { type: 'text', text: 'On it.' },
        {
          type: 'tool-invocation',
          toolInvocation: { state: 'call', toolCallId: 'srv-1', toolName: 'slowServerTool', args: { q: 'important' } },
        },
        {
          type: 'tool-invocation',
          toolInvocation: {
            state: 'result',
            toolCallId: 'cli-1',
            toolName: 'clientTool',
            args: { topic: 'x' },
            result: { details: 'about x' },
          },
        },
      ]),
      'memory',
    );

    const prompt = messageList.get.all.aiV5.prompt();
    const serialized = JSON.stringify(prompt);
    const { toolCalls, toolResults } = collectToolPairs(prompt);

    // Aborted server tool dropped; its abort message never reaches the model.
    expect(toolCalls.has('srv-1')).toBe(false);
    expect(serialized).not.toContain('The operation was aborted');

    // Completed client tool survives as a valid tool_use + tool_result pair.
    expect(toolCalls.has('cli-1')).toBe(true);
    expect(toolResults.has('cli-1')).toBe(true);

    // Overall pairing invariant holds (no orphan tool_use).
    expect([...toolCalls].sort()).toEqual([...toolResults].sort());
  });
});
