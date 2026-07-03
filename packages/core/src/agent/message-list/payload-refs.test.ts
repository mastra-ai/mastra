import { describe, expect, it } from 'vitest';
import {
  PAYLOAD_REF_KEY,
  PAYLOAD_REF_MIN_LENGTH,
  dedupeMessagePayloadRefs,
  rehydrateMessagePayloadRefs,
} from './payload-refs';
import type { MastraDBMessage } from './state/types';

const BIG_A = `A${'a'.repeat(PAYLOAD_REF_MIN_LENGTH)}`;
const BIG_B = `B${'b'.repeat(PAYLOAD_REF_MIN_LENGTH)}`;
const SMALL = 'small-string';

function makeMessage({
  result,
  modelOutput,
  state = 'result',
}: {
  result?: unknown;
  modelOutput?: unknown;
  state?: string;
}): MastraDBMessage {
  return {
    id: 'msg-1',
    role: 'assistant',
    createdAt: new Date('2026-01-01'),
    threadId: 'thread-1',
    resourceId: 'resource-1',
    content: {
      format: 2,
      parts: [
        {
          type: 'tool-invocation',
          toolInvocation: {
            toolCallId: 'call-1',
            toolName: 'test-tool',
            args: {},
            state,
            ...(result !== undefined ? { result } : {}),
          },
          ...(modelOutput !== undefined ? { providerMetadata: { mastra: { modelOutput } } } : {}),
        } as any,
      ],
    },
  };
}

function getModelOutput(message: MastraDBMessage): unknown {
  const part = message.content.parts[0] as any;
  return part?.providerMetadata?.mastra?.modelOutput;
}

describe('dedupeMessagePayloadRefs', () => {
  it('replaces a large string in modelOutput that matches a string in result with a ref marker', () => {
    const input = [
      makeMessage({
        result: { content: [{ type: 'image', data: BIG_A }] },
        modelOutput: { type: 'content', value: [{ type: 'media', data: BIG_A, mediaType: 'image/png' }] },
      }),
    ];
    const [deduped] = dedupeMessagePayloadRefs(input);
    expect(getModelOutput(deduped!)).toEqual({
      type: 'content',
      value: [{ type: 'media', data: { [PAYLOAD_REF_KEY]: ['content', 0, 'data'] }, mediaType: 'image/png' }],
    });
    // Raw result untouched.
    expect((deduped!.content.parts[0] as any).toolInvocation.result).toEqual({
      content: [{ type: 'image', data: BIG_A }],
    });
  });

  it('leaves strings below the threshold alone', () => {
    const input = [
      makeMessage({
        result: { data: SMALL },
        modelOutput: { type: 'text', value: SMALL },
      }),
    ];
    const output = dedupeMessagePayloadRefs(input);
    expect(output).toBe(input); // unchanged by reference
  });

  it('leaves large modelOutput strings that do not appear in result alone', () => {
    const input = [
      makeMessage({
        result: { data: BIG_A },
        modelOutput: { type: 'text', value: BIG_B },
      }),
    ];
    const output = dedupeMessagePayloadRefs(input);
    expect(output).toBe(input);
  });

  it('handles multiple and nested payloads across arrays and objects', () => {
    const input = [
      makeMessage({
        result: { images: [{ data: BIG_A }, { data: BIG_B }], meta: { note: SMALL } },
        modelOutput: {
          type: 'content',
          value: [
            { type: 'media', data: BIG_A },
            { type: 'media', data: BIG_B },
            { type: 'text', text: SMALL },
          ],
        },
      }),
    ];
    const [deduped] = dedupeMessagePayloadRefs(input);
    expect(getModelOutput(deduped!)).toEqual({
      type: 'content',
      value: [
        { type: 'media', data: { [PAYLOAD_REF_KEY]: ['images', 0, 'data'] } },
        { type: 'media', data: { [PAYLOAD_REF_KEY]: ['images', 1, 'data'] } },
        { type: 'text', text: SMALL },
      ],
    });
  });

  it('uses the first result path deterministically when the same string appears at several paths', () => {
    const input = [
      makeMessage({
        result: { first: BIG_A, second: BIG_A },
        modelOutput: { value: BIG_A },
      }),
    ];
    const [deduped] = dedupeMessagePayloadRefs(input);
    expect(getModelOutput(deduped!)).toEqual({ value: { [PAYLOAD_REF_KEY]: ['first'] } });
  });

  it('dedupes a modelOutput that is itself a bare large string', () => {
    const input = [
      makeMessage({
        result: { data: BIG_A },
        modelOutput: BIG_A,
      }),
    ];
    const [deduped] = dedupeMessagePayloadRefs(input);
    expect(getModelOutput(deduped!)).toEqual({ [PAYLOAD_REF_KEY]: ['data'] });
  });

  it('is idempotent (running dedupe twice equals running it once)', () => {
    const input = [
      makeMessage({
        result: { data: BIG_A },
        modelOutput: { value: BIG_A },
      }),
    ];
    const once = dedupeMessagePayloadRefs(input);
    const twice = dedupeMessagePayloadRefs(once);
    expect(twice).toBe(once);
  });

  it('skips parts without modelOutput, without result state, or with no result', () => {
    const noModelOutput = [makeMessage({ result: { data: BIG_A } })];
    expect(dedupeMessagePayloadRefs(noModelOutput)).toBe(noModelOutput);

    const callState = [makeMessage({ modelOutput: { value: BIG_A }, state: 'call' })];
    expect(dedupeMessagePayloadRefs(callState)).toBe(callState);
  });

  it('does not mutate its input', () => {
    const input = [
      makeMessage({
        result: { data: BIG_A },
        modelOutput: { value: BIG_A },
      }),
    ];
    const snapshot = JSON.parse(JSON.stringify(input));
    dedupeMessagePayloadRefs(input);
    expect(JSON.parse(JSON.stringify(input))).toEqual(snapshot);
  });
});

describe('rehydrateMessagePayloadRefs', () => {
  it('resolves ref markers back to the original strings (roundtrip identity)', () => {
    const original = [
      makeMessage({
        result: { images: [{ data: BIG_A }, { data: BIG_B }] },
        modelOutput: {
          type: 'content',
          value: [
            { type: 'media', data: BIG_A },
            { type: 'media', data: BIG_B },
          ],
        },
      }),
    ];
    const roundtripped = rehydrateMessagePayloadRefs(dedupeMessagePayloadRefs(original));
    expect(JSON.parse(JSON.stringify(roundtripped))).toEqual(JSON.parse(JSON.stringify(original)));
  });

  it('passes old rows (no markers) through untouched by reference', () => {
    const input = [
      makeMessage({
        result: { data: BIG_A },
        modelOutput: { type: 'text', value: 'plain output' },
      }),
    ];
    expect(rehydrateMessagePayloadRefs(input)).toBe(input);
  });

  it('leaves markers whose path does not resolve to a string untouched', () => {
    const input = [
      makeMessage({
        result: { data: { nested: true } },
        modelOutput: { value: { [PAYLOAD_REF_KEY]: ['missing', 'path'] } },
      }),
    ];
    const output = rehydrateMessagePayloadRefs(input);
    expect(output).toBe(input);
    expect(getModelOutput(output[0]!)).toEqual({ value: { [PAYLOAD_REF_KEY]: ['missing', 'path'] } });
  });

  it('leaves marker-shaped objects with extra keys alone (user-data collision safety)', () => {
    const input = [
      makeMessage({
        result: { data: BIG_A },
        modelOutput: { value: { [PAYLOAD_REF_KEY]: ['data'], extra: 1 } },
      }),
    ];
    const output = rehydrateMessagePayloadRefs(input);
    expect(output).toBe(input);
  });

  it('rehydrates a modelOutput that is itself a bare marker', () => {
    const input = [
      makeMessage({
        result: { data: BIG_A },
        modelOutput: { [PAYLOAD_REF_KEY]: ['data'] },
      }),
    ];
    const [rehydrated] = rehydrateMessagePayloadRefs(input);
    expect(getModelOutput(rehydrated!)).toBe(BIG_A);
  });

  it('does not mutate its input', () => {
    const input = [
      makeMessage({
        result: { data: BIG_A },
        modelOutput: { value: { [PAYLOAD_REF_KEY]: ['data'] } },
      }),
    ];
    const snapshot = JSON.parse(JSON.stringify(input));
    rehydrateMessagePayloadRefs(input);
    expect(JSON.parse(JSON.stringify(input))).toEqual(snapshot);
  });
});
