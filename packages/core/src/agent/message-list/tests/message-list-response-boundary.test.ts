import { describe, expect, it } from 'vitest';

import { createSignal } from '../../signals';
import { MessageList } from '../message-list';
import type { MastraDBMessage } from '../state/types';

function assistant(id: string, parts: MastraDBMessage['content']['parts'], createdAt: Date): MastraDBMessage {
  return { id, role: 'assistant', content: { format: 2, parts }, createdAt, threadId: 't' };
}

describe('MessageList response boundary', () => {
  it('folds late parts for a rotated message into that message instead of replacing it', () => {
    const list = new MessageList({ threadId: 't' });
    list.add({ role: 'user', content: 'Hello' }, 'input');
    list.add(
      assistant(
        'running',
        [
          { type: 'step-start' },
          {
            type: 'tool-invocation',
            toolInvocation: { state: 'call', toolCallId: 'call-1', toolName: 'slowTool', args: {} },
          },
        ],
        new Date(1_000),
      ),
      'response',
    );

    // A signal arrives mid-tool: the in-flight message is sealed and the id rotates.
    const nextId = list.rotateResponseMessageId('running');
    expect(nextId).not.toBe('running');
    list.addSignal(createSignal({ type: 'reactive', contents: 'reminder' }));

    // The still-running tool reports under the id it started with.
    list.add(
      assistant('running', [{ type: 'data-tool-exit', data: { toolCallId: 'call-1' } }], new Date(2_000)),
      'response',
    );
    expect(
      list.get.all
        .db()
        .find(message => message.id === 'running')
        ?.content.parts.map(part => part.type),
    ).toEqual(['step-start', 'tool-invocation', 'data-tool-exit']);
    list.add(
      assistant(
        'running',
        [
          {
            type: 'tool-invocation',
            toolInvocation: { state: 'result', toolCallId: 'call-1', toolName: 'slowTool', args: {}, result: 'ok' },
          },
        ],
        new Date(3_000),
      ),
      'response',
    );

    const running = list.get.all.db().filter(message => message.id === 'running');
    expect(running).toHaveLength(1);
    expect(running[0]!.content.parts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'tool-invocation',
          toolInvocation: expect.objectContaining({ toolCallId: 'call-1', state: 'result', result: 'ok' }),
        }),
        expect.objectContaining({ type: 'data-tool-exit' }),
      ]),
    );

    // The boundary still holds for the next response: a different id never folds back in.
    list.add(assistant(nextId, [{ type: 'text', text: 'next response' }], new Date(4_000)), 'response');
    expect(list.get.all.db().find(message => message.id === nextId)?.content.parts).toEqual([
      expect.objectContaining({ type: 'text', text: 'next response' }),
    ]);
    expect(running[0]!.content.parts.some(part => part.type === 'text')).toBe(false);
  });

  it('keeps a running tool call when its message was sealed by observation before the signal', () => {
    const list = new MessageList({ threadId: 't' });
    list.add({ role: 'user', content: 'Hello' }, 'input');
    const running = assistant(
      'running',
      [
        { type: 'step-start' },
        {
          type: 'tool-invocation',
          toolInvocation: { state: 'call', toolCallId: 'call-1', toolName: 'slowTool', args: {} },
        },
      ],
      new Date(1_000),
    );
    list.add(running, 'response');

    // Observation seals the in-flight message mid-tool (as observational memory's
    // buffering does), then a signal seals the response and rotates the id.
    const live = list.get.all.db().find(message => message.id === 'running')!;
    observationSeal(live);
    list.removeByIds(['running']);
    list.add(live, 'memory');
    const sealedSnapshot = structuredClone(live.content.parts);
    list.rotateResponseMessageId('running');
    list.addSignal(createSignal({ type: 'reactive', contents: 'reminder' }));

    list.add(
      assistant('running', [{ type: 'data-tool-exit', data: { toolCallId: 'call-1' } }], new Date(2_000)),
      'response',
    );
    list.add(
      assistant(
        'running',
        [
          {
            type: 'tool-invocation',
            toolInvocation: { state: 'result', toolCallId: 'call-1', toolName: 'slowTool', args: {}, result: 'ok' },
          },
        ],
        new Date(3_000),
      ),
      'response',
    );

    // Sealed content is not rewritten...
    const sealed = list.get.all.db().find(message => message.id === 'running')!;
    expect(sealed.content.parts).toEqual(sealedSnapshot);
    // ...but the call, its data part, and its result all survive, and the
    // prompt carries the call paired with its result.
    const parts = list.get.all.db().flatMap(message => message.content.parts);
    expect(parts.some(part => part.type === 'data-tool-exit')).toBe(true);
    expect(
      parts.some(
        part =>
          part.type === 'tool-invocation' &&
          part.toolInvocation.toolCallId === 'call-1' &&
          part.toolInvocation.state === 'result',
      ),
    ).toBe(true);
    const prompt = JSON.stringify(list.get.all.aiV5.model());
    expect(prompt).toContain('"type":"tool-call"');
    expect(prompt).toContain('"type":"tool-result"');
    expect(prompt).toContain('"ok"');
  });

  it('still protects observation markers and post-resume rows from same-id rewrites', () => {
    const list = new MessageList({ threadId: 't' });
    list.add({ role: 'user', content: 'Hello' }, 'input');
    list.add(
      assistant(
        'observed',
        [
          { type: 'text', text: 'observed answer' },
          { type: 'data-om-observation-end', data: { cycleId: 'c1' } },
        ],
        new Date(1_000),
      ),
      'response',
    );
    const observed = list.get.all.db().find(message => message.id === 'observed')!;
    observationSeal(observed);
    const markerSnapshot = structuredClone(observed.content.parts);

    // A boundary on an observed message must not reopen it to same-id writes.
    list.rotateResponseMessageId('observed');
    list.add(assistant('observed', [{ type: 'text', text: 'rewritten' }], new Date(2_000)), 'response');
    expect(list.get.all.db().find(message => message.id === 'observed')!.content.parts).toEqual(markerSnapshot);
    expect(list.get.all.db().filter(message => message.id === 'observed')).toHaveLength(1);

    // Post-resume: the flushed row only resolves its own pending call; the
    // continuation streams under the rotated id and never folds into the row.
    list.add(
      assistant(
        'suspended',
        [
          {
            type: 'reasoning',
            reasoning: '',
            details: [{ type: 'text', text: 'before' }],
            providerMetadata: { anthropic: { signature: 'sig-before' } },
          },
          {
            type: 'tool-invocation',
            toolInvocation: { state: 'call', toolCallId: 'call-2', toolName: 'approve', args: {} },
          },
        ],
        new Date(3_000),
      ),
      'response',
    );
    list.add(
      assistant(
        'suspended',
        [
          {
            type: 'tool-invocation',
            toolInvocation: { state: 'result', toolCallId: 'call-2', toolName: 'approve', args: {}, result: 'yes' },
          },
        ],
        new Date(4_000),
      ),
      'response',
    );
    const continuationId = list.rotateResponseMessageId('suspended');
    list.add(
      assistant(
        continuationId,
        [
          {
            type: 'reasoning',
            reasoning: '',
            details: [{ type: 'text', text: 'after' }],
            providerMetadata: { anthropic: { signature: 'sig-after' } },
          },
        ],
        new Date(5_000),
      ),
      'response',
    );
    const row = list.get.all.db().find(message => message.id === 'suspended')!;
    expect(row.content.parts.map(part => part.type)).toEqual(['reasoning', 'tool-invocation']);
    expect(JSON.stringify(row.content.parts)).not.toContain('sig-after');
    expect(row.content.parts[1]).toMatchObject({ toolInvocation: { state: 'result', result: 'yes' } });
  });
});

function observationSeal(message: MastraDBMessage) {
  message.content.metadata = { ...message.content.metadata, mastra: { sealed: true } };
  const last = message.content.parts.at(-1) as { metadata?: { mastra?: { sealedAt?: number } } };
  last.metadata = { mastra: { sealedAt: 1 } };
}
