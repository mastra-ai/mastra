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

/**
 * The converter attaches `metadata` to tool-call content parts (read by
 * `ToolFallback` to drive network badges), but the public assistant-ui
 * `tool-call` type does not surface it. Read it through a narrow structural
 * accessor instead of casting the whole part.
 */
const partMetadata = (part: object): Record<string, unknown> | undefined => {
  const metadata = (part as { metadata?: unknown }).metadata;
  return metadata && typeof metadata === 'object' ? (metadata as Record<string, unknown>) : undefined;
};

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

describe('toAssistantUIMessage network routing JSON reconstruction', () => {
  const textPart = (text: string): MastraMessagePart => ({ type: 'text', text });

  it('reconstructs an agent routing decision into a network tool-call with child messages', () => {
    const routingDecisionJson = JSON.stringify({
      isNetwork: true,
      selectionReason: 'The user asked for the weather agent.',
      primitiveType: 'agent',
      primitiveId: 'weatherAgent',
      input: 'What is the weather in Toronto?',
      finalResult: {
        text: 'Weather in Toronto: 13.6°C, clear sky.',
        messages: [
          {
            type: 'tool-call',
            content: [
              {
                type: 'tool-call',
                toolCallId: 'call-1',
                toolName: 'getWeather',
                args: { city: 'Toronto' },
              },
            ],
          },
          {
            type: 'tool-result',
            content: [
              {
                type: 'tool-result',
                toolCallId: 'call-1',
                toolName: 'getWeather',
                result: { result: { temperature: 13.6 } },
              },
            ],
          },
        ],
      },
    });

    const { content } = toAssistantUIMessage(assistantMessage([textPart(routingDecisionJson)]));
    if (typeof content === 'string') throw new Error('expected structured content parts');

    expect(content).toHaveLength(1);
    const part = content[0];
    expect(part.type).toBe('tool-call');
    if (part.type !== 'tool-call') throw new Error('expected tool-call');
    expect(part.toolName).toBe('weatherAgent');
    expect(part.toolCallId).toBe('weatherAgent');
    expect(part.args).toBe('What is the weather in Toronto?');
    expect(partMetadata(part)).toMatchObject({
      mode: 'network',
      from: 'AGENT',
      selectionReason: 'The user asked for the weather agent.',
      agentInput: 'What is the weather in Toronto?',
    });
    expect(part.result).toEqual({
      childMessages: [
        {
          type: 'tool',
          toolCallId: 'call-1',
          toolName: 'getWeather',
          args: { city: 'Toronto' },
          toolOutput: { result: { temperature: 13.6 } },
        },
        { type: 'text', content: 'Weather in Toronto: 13.6°C, clear sky.' },
      ],
      result: 'Weather in Toronto: 13.6°C, clear sky.',
    });
  });

  it('reconstructs a tool routing decision using finalResult.result and from=TOOL', () => {
    const routingDecisionJson = JSON.stringify({
      isNetwork: true,
      selectionReason: 'Direct tool call.',
      primitiveType: 'tool',
      primitiveId: 'getWeatherTool',
      input: { city: 'Toronto' },
      finalResult: {
        result: { temperature: 13.6, conditions: 'clear sky' },
      },
    });

    const { content } = toAssistantUIMessage(assistantMessage([textPart(routingDecisionJson)]));
    if (typeof content === 'string') throw new Error('expected structured content parts');

    const part = content[0];
    expect(part.type).toBe('tool-call');
    if (part.type !== 'tool-call') throw new Error('expected tool-call');
    expect(part.toolName).toBe('getWeatherTool');
    expect(partMetadata(part)).toMatchObject({ mode: 'network', from: 'TOOL' });
    expect(part.result).toEqual({ temperature: 13.6, conditions: 'clear sky' });
  });

  it('leaves ordinary JSON and invalid JSON text unchanged', () => {
    const ordinary = toAssistantUIMessage(assistantMessage([textPart(JSON.stringify({ hello: 'world' }))]));
    const invalid = toAssistantUIMessage(assistantMessage([textPart('{"isNetwork": true')]));

    if (typeof ordinary.content === 'string' || typeof invalid.content === 'string') {
      throw new Error('expected structured content parts');
    }

    expect(ordinary.content[0]).toMatchObject({ type: 'text', text: '{"hello":"world"}' });
    expect(invalid.content[0]).toMatchObject({ type: 'text', text: '{"isNetwork": true' });
  });
});

describe('toAssistantUIMessage file and image parts', () => {
  /**
   * The stream accumulator emits file parts in the V5 shape `{ mediaType, url }`
   * (see client-sdks/react/src/lib/mastra-db/accumulator.ts, which casts to
   * `MastraMessagePart` because the stored union describes the V4 `{ mimeType, data }`).
   * User uploads via `fromCoreUserMessage` produce the same V5 shape. The converter
   * receives exactly this at render time, so we build it with a single narrow
   * boundary cast (mirroring the accumulator) to reflect the real runtime input.
   */
  const streamedFilePart = (part: { mediaType: string; url: string; filename?: string }): MastraMessagePart =>
    ({ type: 'file', ...part }) as unknown as MastraMessagePart;

  it('renders a streamed image file part (mediaType/url) as an image content part', () => {
    const dataUrl =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC';
    const { content } = toAssistantUIMessage(
      assistantMessage([streamedFilePart({ mediaType: 'image/png', url: dataUrl })]),
    );
    if (typeof content === 'string') throw new Error('expected structured content parts');

    const part = content[0];
    expect(part.type).toBe('image');
    if (part.type !== 'image') throw new Error('expected image');
    expect(part.image).toBe(dataUrl);
  });

  it('renders a streamed non-image file part with its media type and data', () => {
    const dataUrl = 'data:application/pdf;base64,JVBERi0xLjQ=';
    const { content } = toAssistantUIMessage(
      assistantMessage([streamedFilePart({ mediaType: 'application/pdf', url: dataUrl, filename: 'doc.pdf' })]),
    );
    if (typeof content === 'string') throw new Error('expected structured content parts');

    const part = content[0];
    expect(part.type).toBe('file');
    if (part.type !== 'file') throw new Error('expected file');
    expect(part.mimeType).toBe('application/pdf');
    expect(part.data).toBe(dataUrl);
  });

  it('still renders a persisted V4 image part (mimeType/data) on reload', () => {
    const dataUrl = 'data:image/gif;base64,R0lGODlhAQABAAAAACw=';
    const persistedImage = { type: 'file', mimeType: 'image/gif', data: dataUrl } as MastraMessagePart;
    const { content } = toAssistantUIMessage(assistantMessage([persistedImage]));
    if (typeof content === 'string') throw new Error('expected structured content parts');

    const part = content[0];
    expect(part.type).toBe('image');
    if (part.type !== 'image') throw new Error('expected image');
    expect(part.image).toBe(dataUrl);
  });
});

describe('toAssistantUIMessage source parts', () => {
  /**
   * The stream accumulator emits V5-shaped, flat source parts (see
   * client-sdks/react/src/lib/mastra-db/accumulator.ts): `source-url` with
   * `{ sourceId, url, title }` and `source-document` with
   * `{ sourceId, mediaType, title, filename }`. These are V5 storage-boundary
   * extensions not described by the stored `MastraMessagePart` union, so we build
   * them with a single narrow boundary cast (mirroring the accumulator) to reflect
   * the real runtime input the converter receives.
   */
  const streamedSourceUrlPart = (part: { sourceId: string; url: string; title?: string }): MastraMessagePart =>
    ({ type: 'source-url', ...part }) as unknown as MastraMessagePart;

  const streamedSourceDocumentPart = (part: {
    sourceId: string;
    mediaType: string;
    title?: string;
    filename?: string;
  }): MastraMessagePart => ({ type: 'source-document', ...part }) as unknown as MastraMessagePart;

  it('renders a streamed source-url part as a source content part', () => {
    const { content } = toAssistantUIMessage(
      assistantMessage([streamedSourceUrlPart({ sourceId: 's1', url: 'https://example.com', title: 'Example' })]),
    );
    if (typeof content === 'string') throw new Error('expected structured content parts');

    const part = content[0];
    expect(part.type).toBe('source');
    if (part.type !== 'source') throw new Error('expected source');
    expect(part.sourceType).toBe('url');
    expect(part.id).toBe('s1');
    expect(part.url).toBe('https://example.com');
    expect(part.title).toBe('Example');
  });

  it('does not emit a blank text part for a source-url part', () => {
    const { content } = toAssistantUIMessage(
      assistantMessage([streamedSourceUrlPart({ sourceId: 's1', url: 'https://example.com' })]),
    );
    if (typeof content === 'string') throw new Error('expected structured content parts');

    const part = content[0];
    expect(part.type).toBe('source');
    expect(part.type).not.toBe('text');
  });

  it('renders a streamed source-document part as a file content part', () => {
    const { content } = toAssistantUIMessage(
      assistantMessage([
        streamedSourceDocumentPart({
          sourceId: 's2',
          mediaType: 'application/pdf',
          title: 'Doc',
          filename: 'doc.pdf',
        }),
      ]),
    );
    if (typeof content === 'string') throw new Error('expected structured content parts');

    const part = content[0];
    expect(part.type).toBe('file');
    if (part.type !== 'file') throw new Error('expected file');
    expect(part.mimeType).toBe('application/pdf');
    expect(part.filename).toBe('doc.pdf');
  });
});

describe('toAssistantUIMessage reasoning reload', () => {
  /**
   * Persisted reasoning parts arrive from the DB with an empty `reasoning` string
   * and the actual thinking text inside `details` (AIV5Adapter writes
   * `reasoning: '', details: [{ type: 'text', text }]`, and core's own reader
   * falls back to `details` when `reasoning` is empty). On reload the converter
   * receives this shape, so the visible reasoning text must come from `details`.
   */
  const persistedReasoningPart = (text: string): MastraMessagePart =>
    ({ type: 'reasoning', reasoning: '', details: [{ type: 'text', text }] }) as MastraMessagePart;

  it('renders persisted reasoning text from details when reasoning is empty', () => {
    const { content } = toAssistantUIMessage(
      assistantMessage([persistedReasoningPart('Let me think about this step by step.')]),
    );
    if (typeof content === 'string') throw new Error('expected structured content parts');

    const part = content[0];
    expect(part.type).toBe('reasoning');
    if (part.type !== 'reasoning') throw new Error('expected reasoning');
    expect(part.text).toBe('Let me think about this step by step.');
  });

  it('still renders live reasoning text from the reasoning field while streaming', () => {
    const livePart = { type: 'reasoning', reasoning: 'thinking out loud' } as MastraMessagePart;
    const { content } = toAssistantUIMessage(assistantMessage([livePart]));
    if (typeof content === 'string') throw new Error('expected structured content parts');

    const part = content[0];
    expect(part.type).toBe('reasoning');
    if (part.type !== 'reasoning') throw new Error('expected reasoning');
    expect(part.text).toBe('thinking out loud');
  });
});
