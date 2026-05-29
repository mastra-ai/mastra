import type { MastraDBMessage, MastraMessagePart } from '@mastra/core/agent/message-list';
import { describe, expect, it } from 'vitest';

import { buildGlobalOmPartsByCycleId, convertOmPartsInMastraMessage } from '../om-parts-converter';
import { toAssistantUIMessage } from '../to-assistant-ui-message';

const OM_TOOL_NAME = 'mastra-memory-om-observation';

/**
 * Build a `data-om-*` part using the persisted `DataUIPart` shape (a valid
 * `MastraMessagePart` union member). No casts are needed because `data-${string}`
 * parts are first-class union members.
 */
const omPart = (name: string, data: Record<string, unknown>): MastraMessagePart => ({
  type: `data-${name}`,
  data,
});

/**
 * The runtime-only `dynamic-tool` shape produced by the OM pipeline (and any
 * other `dynamic-tool` consumer). It is not part of the persisted
 * `MastraMessagePart` union, so we build it with its real structural fields and
 * apply a single narrow boundary cast (no `as unknown as`) to feed it through
 * the converter. This covers the generic `output-error` branch, which the OM
 * pipeline itself never emits.
 */
type DynamicToolPart = {
  type: string;
  toolCallId: string;
  toolName: string;
  input: unknown;
  output?: unknown;
  state?: string;
  errorText?: string;
  data?: unknown;
};

const dynamicToolPart = (part: DynamicToolPart): MastraMessagePart => part as MastraMessagePart;

const assistantMessage = (parts: MastraMessagePart[]): MastraDBMessage => ({
  id: 'msg-1',
  role: 'assistant',
  createdAt: new Date('2026-05-29T00:00:00.000Z'),
  threadId: 'thread-1',
  resourceId: 'resource-1',
  content: {
    format: 2,
    parts,
    metadata: {},
  },
});

/**
 * Run a message through the real OM conversion pipeline (the same one
 * `mastra-runtime-provider` uses) so the runtime-only `dynamic-tool` part is
 * produced by production code, then convert it to an assistant-ui content part.
 */
const firstConvertedPart = (parts: MastraMessagePart[]) => {
  const message = assistantMessage(parts);
  const globalOmParts = buildGlobalOmPartsByCycleId([message]);
  const converted = convertOmPartsInMastraMessage(message, globalOmParts);
  const { content } = toAssistantUIMessage(converted);
  if (typeof content === 'string') throw new Error('expected structured content parts');
  return content[0];
};

describe('toAssistantUIMessage dynamic-tool conversion (via OM pipeline)', () => {
  it('converts a loading OM observation into a tool-call without a result', () => {
    const part = firstConvertedPart([omPart('om-observation-start', { cycleId: 'cycle-1' })]);

    expect(part.type).toBe('tool-call');
    if (part.type !== 'tool-call') throw new Error('expected tool-call');
    expect(part.toolName).toBe(OM_TOOL_NAME);
    expect(part.toolCallId).toBe('om-observation-cycle-1');
    expect(part.args).toMatchObject({ cycleId: 'cycle-1', _state: 'loading' });
    expect(part.argsText).toBe(JSON.stringify(part.args));
    expect(part.result).toBeUndefined();
    expect(part.isError).toBeUndefined();
  });

  it('converts a completed OM observation into a tool-call with the output as result', () => {
    const part = firstConvertedPart([
      omPart('om-observation-start', { cycleId: 'cycle-2', tokensObserved: 4200 }),
      omPart('om-observation-end', { cycleId: 'cycle-2', compressionRatio: 60 }),
    ]);

    expect(part.type).toBe('tool-call');
    if (part.type !== 'tool-call') throw new Error('expected tool-call');
    expect(part.toolName).toBe(OM_TOOL_NAME);
    expect(part.toolCallId).toBe('om-observation-cycle-2');
    expect(part.args).toMatchObject({
      cycleId: 'cycle-2',
      tokensObserved: 4200,
      compressionRatio: 60,
      _state: 'complete',
    });
    expect(part.result).toEqual({ status: 'complete', omData: part.args });
    expect(part.isError).toBeUndefined();
  });

  it('converts a failed OM observation into a tool-call with a failed status result', () => {
    const part = firstConvertedPart([
      omPart('om-observation-start', { cycleId: 'cycle-3' }),
      omPart('om-observation-failed', { cycleId: 'cycle-3' }),
    ]);

    expect(part.type).toBe('tool-call');
    if (part.type !== 'tool-call') throw new Error('expected tool-call');
    expect(part.args).toMatchObject({ cycleId: 'cycle-3', _state: 'failed' });
    expect(part.result).toEqual({ status: 'failed', omData: part.args });
  });

  it('maps a dynamic-tool output-error into a tool-call with errorText as the result', () => {
    const message = assistantMessage([
      dynamicToolPart({
        type: 'dynamic-tool',
        toolCallId: 'call-err-1',
        toolName: 'some-tool',
        input: { query: 'value' },
        state: 'output-error',
        errorText: 'tool blew up',
      }),
    ]);

    const { content } = toAssistantUIMessage(message);
    if (typeof content === 'string') throw new Error('expected structured content parts');
    const part = content[0];

    expect(part.type).toBe('tool-call');
    if (part.type !== 'tool-call') throw new Error('expected tool-call');
    expect(part.toolName).toBe('some-tool');
    expect(part.toolCallId).toBe('call-err-1');
    expect(part.args).toEqual({ query: 'value' });
    expect(part.argsText).toBe(JSON.stringify({ query: 'value' }));
    expect(part.result).toBe('tool blew up');
    expect(part.isError).toBe(true);
  });
});
