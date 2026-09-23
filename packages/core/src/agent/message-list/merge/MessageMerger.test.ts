import { describe, expect, it } from 'vitest';
import type { MastraDBMessage } from '../';
import { MessageList } from '../index';

type Part = MastraDBMessage['content']['parts'][number];
const createdAt = new Date('2026-09-14T00:00:00Z');
const step: Part = { type: 'step-start' };
const text = (value: string): Part => ({ type: 'text', text: value });
const tool = (id: string, result = false): Part => ({
  type: 'tool-invocation',
  toolInvocation: result
    ? { state: 'result', toolCallId: id, toolName: 'lookup', args: { id }, result: { value: id } }
    : { state: 'call', toolCallId: id, toolName: 'lookup', args: { id } },
});
const message = (parts: Part[]): MastraDBMessage => ({
  id: 'assistant-1',
  role: 'assistant',
  createdAt,
  content: { format: 2, parts: structuredClone(parts) },
});

function merge(initial: Part[], incoming: Part[]) {
  const list = new MessageList();
  list.add(message(initial), 'response');
  list.add({ ...message(incoming), createdAt: new Date(createdAt.getTime() + 1000) }, 'response');
  return list;
}

function expectParts(list: MessageList, expected: Part[]) {
  const parts = list.get.all.db()[0]!.content.parts;
  expect(parts).toHaveLength(expected.length);
  expect(parts).toMatchObject(expected);
}

describe('MessageMerger insertion positions', () => {
  it('keeps a tool anchor after inserted text and before its following text', () => {
    expectParts(merge([step, tool('c1'), tool('c2')], [tool('c1', true), text('mid'), tool('c2', true), text('end')]), [
      step,
      tool('c1', true),
      step,
      text('mid'),
      tool('c2', true),
      step,
      text('end'),
    ]);
  });

  it('preserves reasoning without injecting step-starts', () => {
    const reasoning: Part[] = [
      { type: 'reasoning', reasoning: 'First thought', details: [{ type: 'text', text: 'First thought' }] },
      { type: 'reasoning', reasoning: 'Second thought', details: [{ type: 'text', text: 'Second thought' }] },
    ];
    expectParts(merge([step, tool('c1')], [tool('c1', true), ...reasoning]), [step, tool('c1', true), ...reasoning]);
  });

  it('preserves explicit incoming step-starts', () => {
    expectParts(merge([tool('c1')], [tool('c1', true), step, text('A'), text('B')]), [
      tool('c1', true),
      step,
      text('A'),
      text('B'),
    ]);
  });

  it('appends parts in order when there are no tool anchors', () => {
    expectParts(merge([tool('c1', true)], [text('A'), text('B')]), [tool('c1', true), step, text('A'), text('B')]);
  });

  it('resets synthetic insertion drift when crossing the first anchor', () => {
    expectParts(merge([tool('c1')], [text('before'), tool('c1', true), text('A'), text('B')]), [
      step,
      text('before'),
      tool('c1', true),
      step,
      text('A'),
      text('B'),
    ]);
  });

  it('does not duplicate parts on repeated updates', () => {
    const incoming = [tool('c1', true), text('A'), text('B')];
    const list = merge([step, tool('c1')], incoming);
    const original = structuredClone(list.get.all.db());
    list.add(message(incoming), 'response');
    expect(list.get.all.db()).toEqual(original);
  });

  it('does not shift a right anchor when an existing text part is suppressed', () => {
    expectParts(
      merge(
        [tool('c1'), text('existing'), tool('c2')],
        [tool('c1', true), text('existing'), tool('c2', true), text('A'), text('B')],
      ),
      [tool('c1', true), text('existing'), tool('c2', true), step, text('A'), text('B')],
    );
  });

  it('does not move anchors when insertion is suppressed by the global part count', () => {
    expectParts(
      merge(
        [text('existing'), tool('c1'), tool('c2')],
        [tool('c1', true), text('existing'), tool('c2', true), text('A'), text('B')],
      ),
      [text('existing'), tool('c1', true), tool('c2', true), step, text('A'), text('B')],
    );
  });

  it('preserves ordering and metadata through stored history and model conversion', () => {
    const modelStep: Part = { type: 'step-start', model: 'openai/gpt-4o', createdAt: 1234567890 };
    const result = { ...tool('c1', true), providerMetadata: { test: { source: 'result' } } };
    const list = merge(
      [modelStep, tool('c1'), tool('c2')],
      [result, text('mid'), tool('c2', true), text('end-A'), text('end-B')],
    );
    const stored = list.get.all.db()[0]!;
    expect(stored.createdAt).toEqual(createdAt);
    expect(stored.content.parts[0]).toMatchObject(modelStep);
    expect(stored.content.parts[1]).toMatchObject(result);
    expect(stored.content.toolInvocations).toHaveLength(2);
    for (const part of stored.content.parts.filter(p => p.type === 'step-start')) {
      expect(part).toMatchObject({ model: 'openai/gpt-4o', createdAt: expect.any(Number) });
    }

    const serialized: MastraDBMessage = JSON.parse(JSON.stringify(stored));
    const restored = new MessageList();
    restored.add({ ...serialized, createdAt: new Date(serialized.createdAt) }, 'memory');
    expect(restored.get.all.db()).toEqual(list.get.all.db());
    const modelParts = restored.get.all.aiV5.model().flatMap(msg => {
      if (typeof msg.content === 'string') return [msg.content];
      return msg.content.map(part => {
        if (part.type === 'text') return part.text;
        if (part.type === 'tool-call' || part.type === 'tool-result') return `${part.type}:${part.toolCallId}`;
        return part.type;
      });
    });
    expect(modelParts).toEqual([
      'tool-call:c1',
      'tool-result:c1',
      'mid',
      'tool-call:c2',
      'tool-result:c2',
      'end-A',
      'end-B',
    ]);
  });

  it.each([2, 3, 4, 5, 6])('preserves %i text parts after a tool result', count => {
    const texts = Array.from({ length: count }, (_, i) => text(`text-${i}`));
    const list = merge([step, tool('c1')], [tool('c1', true), ...texts]);
    expectParts(list, [step, tool('c1', true), step, ...texts]);
  });

  it.each([2, 3])('keeps text and results ordered across %i tool anchors', count => {
    const calls = Array.from({ length: count }, (_, i) => tool(`c${i}`));
    const incoming = calls.flatMap((_, i) => [tool(`c${i}`, true), text(`${i}-A`), text(`${i}-B`)]);
    // Preserve the existing marker policy while inserting before a trailing tool.
    const expected = calls.flatMap((_, i) => [
      tool(`c${i}`, true),
      step,
      text(`${i}-A`),
      ...(i < count - 1 ? [step] : []),
      text(`${i}-B`),
    ]);
    expectParts(merge([step, ...calls], incoming), [step, ...expected]);
  });
});
