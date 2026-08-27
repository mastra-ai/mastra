import { describe, expect, it } from 'vitest';

import type { TimelineSpan } from '../build-thread-timeline';
import { promptMessages } from '../prompt-messages';

const span = (input: unknown): TimelineSpan => ({ spanId: 'a', spanType: 'model_generation', input }) as TimelineSpan;

describe('promptMessages', () => {
  it('reads string content', () => {
    expect(promptMessages(span({ messages: [{ role: 'system', content: 'Be helpful' }] }))).toEqual([
      { role: 'system', text: 'Be helpful' },
    ]);
  });

  it('joins the text parts of array content', () => {
    const messages = promptMessages(
      span({
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Hello' },
              { type: 'text', text: 'chef' },
            ],
          },
        ],
      }),
    );

    expect(messages).toEqual([{ role: 'user', text: 'Hello\nchef' }]);
  });

  it('strips authoring indentation while keeping line breaks', () => {
    const content = '\n      You are Michel.\n      Explain steps clearly.\n      ';

    expect(promptMessages(span({ messages: [{ role: 'system', content }] }))).toEqual([
      { role: 'system', text: 'You are Michel.\nExplain steps clearly.' },
    ]);
  });

  it('keeps every message, including repeated roles', () => {
    const messages = promptMessages(
      span({
        messages: [
          { role: 'system', content: 'Instructions' },
          { role: 'system', content: 'Task list preamble' },
          { role: 'user', content: 'hey' },
        ],
      }),
    );

    expect(messages.map(m => m.role)).toEqual(['system', 'system', 'user']);
  });

  it('drops messages with no readable text rather than rendering JSON', () => {
    const messages = promptMessages(
      span({
        messages: [
          { role: 'assistant', content: [{ type: 'tool-call', toolName: 'weatherInfo' }] },
          { role: 'user', content: 'still here' },
        ],
      }),
    );

    expect(messages).toEqual([{ role: 'user', text: 'still here' }]);
  });

  it('degrades to an empty list on unusable payloads', () => {
    expect(promptMessages(span(undefined))).toEqual([]);
    expect(promptMessages(span({ messages: 'nope' }))).toEqual([]);
    expect(promptMessages(span({ messages: [null, 42, { content: 'no role' }] }))).toEqual([]);
  });
});
