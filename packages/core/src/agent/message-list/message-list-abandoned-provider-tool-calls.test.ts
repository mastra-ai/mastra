import { describe, expect, it } from 'vitest';
import { MessageList } from './message-list';
import type { MastraDBMessage, MastraToolInvocationPart } from './state/types';

/**
 * When a provider-executed tool call is followed by a terminal model error, no
 * result can ever arrive for it. `addOutputErrorsToProviderToolCalls` rewrites
 * the specifically-listed `state:'call'`/`'partial-call'` parts to a terminal
 * `output-error` state so they are no longer indistinguishable from a live
 * pending tool.
 *
 * @see https://github.com/mastra-ai/mastra/issues/23315
 */

const toolParts = (list: MessageList, messageId: string): MastraToolInvocationPart[] => {
  const msg = list.get.all.db().find(m => m.id === messageId);
  return (msg?.content?.parts ?? []).filter((p): p is MastraToolInvocationPart => p?.type === 'tool-invocation');
};

const providerCall = (
  toolCallId: string,
  toolName: string,
  args: unknown,
  state: 'call' | 'partial-call' = 'call',
): MastraToolInvocationPart =>
  ({
    type: 'tool-invocation',
    toolInvocation: { state, toolCallId, toolName, args },
    providerExecuted: true,
  }) as MastraToolInvocationPart;

const buildList = (parts: MastraDBMessage['content']['parts']): { list: MessageList; id: string } => {
  const id = 'assistant-1';
  const message: MastraDBMessage = {
    id,
    role: 'assistant',
    content: { format: 2, parts },
    createdAt: new Date(),
  };
  const list = new MessageList({ threadId: 't', resourceId: 'r' });
  list.add(message, 'response');
  return { list, id };
};

describe('MessageList.addOutputErrorsToProviderToolCalls', () => {
  it('rewrites an abandoned provider call to output-error, preserving args', () => {
    const { list, id } = buildList([providerCall('orphan-1', 'web_search', { query: 'hello' })]);

    expect(list.addOutputErrorsToProviderToolCalls(id, ['orphan-1'])).toBe(true);

    const parts = toolParts(list, id);
    expect(parts).toHaveLength(1);
    expect(parts[0]!.toolInvocation.state).toBe('output-error');
    expect(parts[0]!.toolInvocation.args).toEqual({ query: 'hello' });
    expect(parts[0]!.toolInvocation.errorText).toBeTruthy();
    // No unresolved call remains.
    expect(parts.some(p => p.toolInvocation.state === 'call')).toBe(false);
  });

  it('rewrites a partial-call provider part', () => {
    const { list, id } = buildList([providerCall('orphan-2', 'web_search', { query: 'partial' }, 'partial-call')]);

    expect(list.addOutputErrorsToProviderToolCalls(id, ['orphan-2'])).toBe(true);
    expect(toolParts(list, id)[0]!.toolInvocation.state).toBe('output-error');
  });

  it('leaves provider calls whose id was not passed untouched', () => {
    const { list, id } = buildList([
      providerCall('orphan-1', 'web_search', { query: 'a' }),
      providerCall('orphan-2', 'web_search', { query: 'b' }),
    ]);

    expect(list.addOutputErrorsToProviderToolCalls(id, ['orphan-1'])).toBe(true);
    const byId = Object.fromEntries(
      toolParts(list, id).map(p => [p.toolInvocation.toolCallId, p.toolInvocation.state]),
    );
    expect(byId['orphan-1']).toBe('output-error');
    expect(byId['orphan-2']).toBe('call');
  });

  it('leaves client-executed (non-provider) calls untouched', () => {
    const clientCall: MastraToolInvocationPart = {
      type: 'tool-invocation',
      toolInvocation: { state: 'call', toolCallId: 'client-1', toolName: 'get_weather', args: { city: 'NYC' } },
    } as MastraToolInvocationPart;
    const { list, id } = buildList([clientCall]);

    expect(list.addOutputErrorsToProviderToolCalls(id, ['client-1'])).toBe(false);
    expect(toolParts(list, id)[0]!.toolInvocation.state).toBe('call');
  });

  it('leaves already-resolved provider results and preceding text untouched', () => {
    const parts: MastraDBMessage['content']['parts'] = [
      { type: 'text', text: 'searching…' },
      {
        type: 'tool-invocation',
        toolInvocation: {
          state: 'result',
          toolCallId: 'done-1',
          toolName: 'web_search',
          args: { query: 'x' },
          result: { hits: 3 },
        },
        providerExecuted: true,
      } as MastraToolInvocationPart,
    ];
    const { list, id } = buildList(parts);

    expect(list.addOutputErrorsToProviderToolCalls(id, ['done-1'])).toBe(false);
    const all = list.get.all.db().find(m => m.id === id)!.content.parts!;
    expect(all[0]).toMatchObject({ type: 'text', text: 'searching…' });
    expect(toolParts(list, id)[0]!.toolInvocation.state).toBe('result');
  });

  it('errors only the abandoned call in a multi-tool message', () => {
    const parts: MastraDBMessage['content']['parts'] = [
      {
        type: 'tool-invocation',
        toolInvocation: {
          state: 'result',
          toolCallId: 'done-1',
          toolName: 'web_search',
          args: { query: 'a' },
          result: { hits: 1 },
        },
        providerExecuted: true,
      } as MastraToolInvocationPart,
      providerCall('orphan-1', 'web_search', { query: 'b' }),
    ];
    const { list, id } = buildList(parts);

    expect(list.addOutputErrorsToProviderToolCalls(id, ['done-1', 'orphan-1'])).toBe(true);
    const byId = Object.fromEntries(
      toolParts(list, id).map(p => [p.toolInvocation.toolCallId, p.toolInvocation.state]),
    );
    expect(byId['done-1']).toBe('result');
    expect(byId['orphan-1']).toBe('output-error');
  });

  it('drops the abandoned entry from the legacy toolInvocations array', () => {
    const id = 'assistant-legacy';
    const message: MastraDBMessage = {
      id,
      role: 'assistant',
      content: {
        format: 2,
        parts: [providerCall('orphan-1', 'web_search', { query: 'hello' })],
        toolInvocations: [{ state: 'call', toolCallId: 'orphan-1', toolName: 'web_search', args: { query: 'hello' } }],
      },
      createdAt: new Date(),
    };
    const list = new MessageList({ threadId: 't', resourceId: 'r' });
    list.add(message, 'response');

    expect(list.addOutputErrorsToProviderToolCalls(id, ['orphan-1'])).toBe(true);
    const stored = list.get.all.db().find(m => m.id === id)!;
    expect(stored.content.toolInvocations ?? []).toHaveLength(0);
  });

  it('returns false when no tool call ids are provided', () => {
    const { list, id } = buildList([providerCall('orphan-1', 'web_search', { query: 'hello' })]);
    expect(list.addOutputErrorsToProviderToolCalls(id, [])).toBe(false);
    expect(toolParts(list, id)[0]!.toolInvocation.state).toBe('call');
  });

  it('returns false for an unknown message id', () => {
    const { list } = buildList([providerCall('orphan-1', 'web_search', { query: 'hello' })]);
    expect(list.addOutputErrorsToProviderToolCalls('does-not-exist', ['orphan-1'])).toBe(false);
  });
});
