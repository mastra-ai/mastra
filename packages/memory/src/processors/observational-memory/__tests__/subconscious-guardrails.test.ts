import { createSignal, type MastraDBMessage } from '@mastra/core/agent';
import { describe, expect, it } from 'vitest';

import { stripSubconsciousSignals } from '../subconscious/origin';

describe('Subconscious guardrails', () => {
  it('structurally removes Subconscious-originated signals before observation', () => {
    const messages = [
      {
        id: 'assistant-with-signals',
        role: 'assistant',
        createdAt: new Date(),
        content: {
          format: 2,
          parts: [
            { type: 'text', text: 'Keep this' },
            {
              type: 'data-signal',
              data: {
                type: 'reactive',
                tagName: 'remembered',
                contents: 'Do not recapture this',
                metadata: { origin: 'subconscious' },
              },
            },
            {
              type: 'data-signal',
              data: { type: 'reactive', tagName: 'external', contents: 'Keep external signals' },
            },
          ],
        },
      },
      {
        id: 'subconscious-only',
        role: 'system',
        createdAt: new Date(),
        content: {
          format: 2,
          parts: [
            {
              type: 'data-signal',
              data: {
                type: 'reactive',
                tagName: 'remembered',
                contents: 'Drop the whole message',
                attributes: { source: 'subconscious' },
              },
            },
          ],
        },
      },
    ] as MastraDBMessage[];

    const stripped = stripSubconsciousSignals(messages);

    expect(stripped).toHaveLength(1);
    expect(stripped[0]?.content).toMatchObject({
      parts: [
        { type: 'text', text: 'Keep this' },
        { type: 'data-signal', data: { tagName: 'external' } },
      ],
    });
    expect(typeof messages[0]?.content === 'string' ? [] : messages[0]?.content.parts).toHaveLength(3);
  });

  it('removes persisted Subconscious signal messages after reload', () => {
    const remembered = createSignal({
      id: 'remembered',
      type: 'reactive',
      tagName: 'remembered',
      contents: 'Do not recapture this',
      metadata: { origin: 'subconscious' },
    }).toDBMessage();
    const activity = createSignal({
      id: 'subconscious-activity',
      type: 'state',
      tagName: 'state',
      contents: 'Do not recapture this either',
      metadata: { origin: 'subconscious' },
    }).toDBMessage();
    const external = createSignal({
      id: 'external',
      type: 'reactive',
      tagName: 'external',
      contents: 'Keep this signal',
    }).toDBMessage();

    expect(stripSubconsciousSignals([remembered, activity, external])).toEqual([external]);
  });
});
