import { describe, expect, it } from 'vitest';
import { MessageList } from './message-list';
import type { MastraDBMessage } from './state/types';

/**
 * A tool call that suspended for approval is persisted with no result. When the prompt is
 * rebuilt on a later turn that call must not reach the provider unpaired — providers reject
 * a tool call that has no matching tool result, which breaks every subsequent turn on the
 * thread. Dropping it satisfies that; so does pairing it with a placeholder result, which is
 * what `filterIncompleteToolCalls: false` does so the agent can still see the pending call.
 *
 * @see https://github.com/mastra-ai/mastra/issues/20610
 */
const suspendedToolCall: MastraDBMessage = {
  id: 'm1',
  role: 'assistant',
  content: {
    format: 2,
    parts: [
      {
        type: 'tool-invocation',
        toolInvocation: {
          state: 'call',
          toolCallId: 'tc-1',
          toolName: 'approve_transfer',
          args: { amount: 1000000 },
        },
      },
    ],
  },
  createdAt: new Date(Date.now() - 10_000),
};

const followUp: MastraDBMessage = {
  id: 'm2',
  role: 'user',
  content: { format: 2, parts: [{ type: 'text', text: 'thanks' }], content: 'thanks' },
  createdAt: new Date(),
};

const buildPrompt = (filterIncompleteToolCalls?: boolean) => {
  const list = new MessageList({ threadId: 't', resourceId: 'r', filterIncompleteToolCalls });
  list.add(suspendedToolCall, 'memory');
  list.add(followUp, 'user');
  return list.get.all.aiV5.prompt();
};

const partsOfType = (messages: ReturnType<typeof buildPrompt>, type: 'tool-call' | 'tool-result') =>
  messages.flatMap(m => (Array.isArray(m.content) ? m.content.filter(p => p.type === type) : []));

describe('MessageList suspended tool calls', () => {
  it('drops the suspended call by default', () => {
    const prompt = buildPrompt();

    expect(partsOfType(prompt, 'tool-call')).toHaveLength(0);
    expect(partsOfType(prompt, 'tool-result')).toHaveLength(0);
  });

  it('keeps the suspended call visible and pairs it with a pending result when filtering is disabled', () => {
    const prompt = buildPrompt(false);

    expect(partsOfType(prompt, 'tool-call')).toMatchObject([{ toolCallId: 'tc-1', toolName: 'approve_transfer' }]);
    expect(partsOfType(prompt, 'tool-result')).toMatchObject([
      { toolCallId: 'tc-1', output: { type: 'json', value: { status: 'pending' } } },
    ]);
  });

  it('drops a stale provider-executed call even when suspended calls are kept', () => {
    // A provider-executed call the provider never resolved, stranded on an earlier turn.
    // The caller opting to see suspended calls must not resurrect it — only the provider
    // decides when it resumes its own call, and it will not resume this one.
    const staleProviderCall: MastraDBMessage = {
      id: 'p1',
      role: 'assistant',
      content: {
        format: 2,
        parts: [
          {
            type: 'tool-invocation',
            toolInvocation: { state: 'call', toolCallId: 'ws-1', toolName: 'web_search', args: { q: 'x' } },
            providerExecuted: true,
          },
        ],
      },
      createdAt: new Date(Date.now() - 30_000),
    };

    const list = new MessageList({ threadId: 't', resourceId: 'r', filterIncompleteToolCalls: false });
    list.add(staleProviderCall, 'memory');
    list.add(followUp, 'user');
    list.add({ ...followUp, id: 'p2', createdAt: new Date() }, 'user');
    const prompt = list.get.all.aiV5.prompt();

    expect(partsOfType(prompt, 'tool-call')).toHaveLength(0);
  });

  it('never emits a tool call without a matching result, whichever way it is configured', () => {
    for (const filterIncompleteToolCalls of [undefined, true, false]) {
      const prompt = buildPrompt(filterIncompleteToolCalls);
      const callIds = partsOfType(prompt, 'tool-call').map(p => p.toolCallId);
      const resultIds = new Set(partsOfType(prompt, 'tool-result').map(p => p.toolCallId));

      expect(callIds.filter(id => !resultIds.has(id))).toEqual([]);
    }
  });
});
