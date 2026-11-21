import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { Agent } from '../../../agent';
import { MockMemory } from '../../../memory/mock';
import { createTool } from '../../../tools';
import {
  CitationMarkupStreamSanitizer,
  stripCitationMarkup,
  stripCitationMarkupFromToolInput,
} from './citation-markup';

const cite = (...ids: string[]) => `\uE200cite${ids.map(id => `\uE202${id}`).join('')}\uE201`;

function pushAll(sanitizer: CitationMarkupStreamSanitizer, id: string, deltas: string[]) {
  return deltas.map(delta => sanitizer.push(id, delta)).join('') + sanitizer.flush(id);
}

describe('stripCitationMarkup', () => {
  it('removes single and multi-source markers', () => {
    expect(
      stripCitationMarkup(
        `Paris is the capital.${cite('turn0search0')} It is big.${cite('turn0search0', 'turn0search1')}`,
      ),
    ).toBe('Paris is the capital. It is big.');
  });

  it('leaves text without complete markers unchanged', () => {
    expect(stripCitationMarkup('plain text')).toBe('plain text');
    // Lone private-use characters (e.g. icon-font glyphs) must survive.
    expect(stripCitationMarkup('icon \uE200 and \uE201 here')).toBe('icon \uE200 and \uE201 here');
  });

  it('requires at least one source id but accepts any marker family', () => {
    expect(stripCitationMarkup('a\uE200cite\uE201b')).toBe('a\uE200cite\uE201b');
    expect(stripCitationMarkup('a\uE200filecite\uE202turn0file1\uE201b')).toBe('ab');
  });
});

describe('stripCitationMarkupFromToolInput', () => {
  it('strips raw and JSON-escaped markers from string values', () => {
    const raw = JSON.stringify({ text: `Answer${cite('turn1view0')}`, nested: [{ note: `x${cite('turn0file2')}` }] });
    expect(JSON.parse(stripCitationMarkupFromToolInput(raw))).toEqual({ text: 'Answer', nested: [{ note: 'x' }] });

    const escaped = '{"text":"Answer\\ue200cite\\ue202turn0search0\\ue201"}';
    expect(JSON.parse(stripCitationMarkupFromToolInput(escaped))).toEqual({ text: 'Answer' });
  });

  it('returns marker-free input untouched', () => {
    const input = '{ "text": "hello" }';
    expect(stripCitationMarkupFromToolInput(input)).toBe(input);
  });
});

describe('CitationMarkupStreamSanitizer', () => {
  it('strips markers split across deltas', () => {
    const sanitizer = new CitationMarkupStreamSanitizer();
    const marker = cite('turn0search0', 'turn0search1');
    const deltas = ['Paris is the capital.', marker.slice(0, 3), marker.slice(3, 9), marker.slice(9), ' More.'];
    expect(pushAll(sanitizer, 'a', deltas)).toBe('Paris is the capital. More.');
  });

  it('streams text without markers through immediately', () => {
    const sanitizer = new CitationMarkupStreamSanitizer();
    expect(sanitizer.push('a', 'hello ')).toBe('hello ');
    expect(sanitizer.push('a', 'world')).toBe('world');
    expect(sanitizer.flush('a')).toBe('');
  });

  it('releases an unclosed marker start on flush or when it cannot be a marker', () => {
    const sanitizer = new CitationMarkupStreamSanitizer();
    expect(sanitizer.push('a', 'icon \uE200')).toBe('icon ');
    expect(sanitizer.flush('a')).toBe('\uE200');

    expect(sanitizer.push('b', 'icon \uE200')).toBe('icon ');
    expect(sanitizer.push('b', ' next line\nmore')).toBe('\uE200 next line\nmore');
  });

  it('holds a long multi-source marker until it closes', () => {
    const sanitizer = new CitationMarkupStreamSanitizer();
    const marker = cite(...Array.from({ length: 40 }, (_, i) => `turn0search${i}`));
    expect(marker.length).toBeGreaterThan(256);
    const deltas = ['Answer.', ...(marker.match(/[\s\S]{1,50}/g) ?? []), ' End.'];
    expect(pushAll(sanitizer, 'a', deltas)).toBe('Answer. End.');
  });

  it('strips JSON-escaped markers split across tool-input deltas', () => {
    const sanitizer = new CitationMarkupStreamSanitizer({ json: true });
    const json = '{"text":"Answer\\ue200cite\\ue202turn0search0\\ue202turn0search1\\ue201","path":"C:\\\\tmp\\nx\\"y"}';
    const expected = '{"text":"Answer","path":"C:\\\\tmp\\nx\\"y"}';
    for (const size of [1, 2, 3, 5, 7, 11]) {
      const deltas = json.match(new RegExp(`[\\s\\S]{1,${size}}`, 'g')) ?? [];
      expect(pushAll(sanitizer, `call-${size}`, deltas)).toBe(expected);
    }
    expect(JSON.parse(expected)).toEqual({ text: 'Answer', path: 'C:\\tmp\nx"y' });
  });

  it('keeps an escaped backslash before u + E200 text in tool-input deltas', () => {
    // JSON for the literal string "\ue200cite" followed by raw marker separator/end characters.
    const json = '{"text":"a\\\\ue200cite\uE202turn0search0\uE201"}';
    const sanitizer = new CitationMarkupStreamSanitizer({ json: true });
    for (const size of [1, 2, 3, 4, 50]) {
      const deltas = json.match(new RegExp(`[\\s\\S]{1,${size}}`, 'g')) ?? [];
      expect(pushAll(sanitizer, `call-${size}`, deltas)).toBe(stripCitationMarkupFromToolInput(json));
    }
    expect(stripCitationMarkupFromToolInput(json)).toBe(json);
  });

  it('tracks ids independently', () => {
    const sanitizer = new CitationMarkupStreamSanitizer();
    const marker = cite('turn0search0');
    expect(sanitizer.push('a', `one${marker.slice(0, 4)}`)).toBe('one');
    expect(sanitizer.push('b', 'two')).toBe('two');
    expect(sanitizer.push('a', marker.slice(4))).toBe('');
    expect(sanitizer.flushAll()).toEqual([]);
  });
});

describe('agent streams with OpenAI citation markup', () => {
  it('keeps markers out of text, persisted messages and executed tool args', async () => {
    const marker = cite('turn0search0', 'turn0search1');
    const toolArgs = JSON.stringify({ text: `Paris is the capital of France.${marker}` });
    let call = 0;
    const model = new MockLanguageModelV2({
      doStream: async () => {
        call++;
        if (call === 1) {
          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
            stream: convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              { type: 'tool-input-start', id: 'call-1', toolName: 'reply' },
              { type: 'tool-input-delta', id: 'call-1', delta: toolArgs.slice(0, 40) },
              { type: 'tool-input-delta', id: 'call-1', delta: toolArgs.slice(40) },
              { type: 'tool-input-end', id: 'call-1' },
              { type: 'tool-call', toolCallId: 'call-1', toolName: 'reply', input: toolArgs },
              {
                type: 'finish',
                finishReason: 'tool-calls',
                usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
              },
            ]),
          };
        }
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'text-start', id: 'text-1' },
            { type: 'text-delta', id: 'text-1', delta: 'Paris is the capital.' },
            { type: 'text-delta', id: 'text-1', delta: marker.slice(0, 6) },
            {
              type: 'source',
              sourceType: 'url',
              id: 'source-1',
              url: 'https://example.com/paris',
              title: 'Paris',
            },
            { type: 'text-delta', id: 'text-1', delta: marker.slice(6) },
            { type: 'text-delta', id: 'text-1', delta: ' Done.' },
            { type: 'text-end', id: 'text-1' },
            { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
          ]),
        };
      },
    });

    const received: string[] = [];
    const memory = new MockMemory();
    const agent = new Agent({
      id: 'citation-agent',
      name: 'citation-agent',
      instructions: 'test',
      model,
      memory,
      tools: {
        reply: createTool({
          id: 'reply',
          description: 'reply',
          inputSchema: z.object({ text: z.string() }),
          execute: async ({ text }) => {
            received.push(text);
            return { ok: true };
          },
        }),
      },
    });

    const result = await agent.stream('What is the capital of France?', {
      memory: { thread: 'thread-1', resource: 'resource-1' },
    });
    const text = await result.text;
    const sources = await result.sources;
    const toolCalls = await result.toolCalls;

    expect(text).toBe('Paris is the capital. Done.');
    expect(sources).toEqual([
      expect.objectContaining({
        payload: expect.objectContaining({ id: 'source-1', url: 'https://example.com/paris' }),
      }),
    ]);
    expect(received).toEqual(['Paris is the capital of France.']);
    expect(toolCalls[0]?.payload.args).toEqual({ text: 'Paris is the capital of France.' });

    const { messages } = await memory.recall({ threadId: 'thread-1', resourceId: 'resource-1' });
    expect(JSON.stringify(messages)).not.toMatch(/[\uE200-\uE202]/);
  });
});
