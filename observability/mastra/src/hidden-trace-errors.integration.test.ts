/**
 * Errors on traces started with `tracingOptions.hideInput`/`hideOutput`.
 *
 * The flags clear span input and output at export, but a failed span also exports its
 * error. An error's message, stack header and details often quote the very data the flags
 * hide: a tool rejecting the user's input, or a provider echoing the prompt it refused.
 * On a hidden trace the exported error keeps what identifies it and drops that text.
 *
 * Runs a real Agent, Observability instance and TestExporter; only the model is mocked.
 */
import { APICallError } from '@internal/ai-sdk-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { Agent } from '@mastra/core/agent';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import { Mastra } from '@mastra/core/mastra';
import { SpanType } from '@mastra/core/observability';
import { MockStore } from '@mastra/core/storage';
import { createTool } from '@mastra/core/tools';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { Observability } from './default';
import { TestExporter } from './exporters';
import { REDACTED_ERROR_MESSAGE, redactErrorInfo } from './spans/base';

const SECRET = 'DE89370400440532013000';

type Hide = { hideInput?: boolean; hideOutput?: boolean };

const finish = {
  type: 'finish',
  finishReason: 'stop',
  usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
} as const;

/** First call asks for the IBAN tool, the next answers in text. */
function toolThenTextModel() {
  let call = 0;
  return new MockLanguageModelV2({
    doStream: async () => ({
      stream: convertArrayToReadableStream(
        call++ === 0
          ? [
              { type: 'stream-start', warnings: [] },
              { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
              {
                type: 'tool-call',
                toolCallId: 'call-1',
                toolName: 'validateIban',
                input: JSON.stringify({ iban: SECRET }),
              },
              { ...finish, finishReason: 'tool-calls' },
            ]
          : [
              { type: 'stream-start', warnings: [] },
              { type: 'response-metadata', id: 'id-1', modelId: 'mock-model-id', timestamp: new Date(0) },
              { type: 'text-start', id: 'text-1' },
              { type: 'text-delta', id: 'text-1', delta: 'That IBAN does not look valid.' },
              { type: 'text-end', id: 'text-1' },
              finish,
            ],
      ),
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
    }),
  });
}

/** A provider that refuses the request and echoes the prompt back in its response body. */
function refusingProviderModel() {
  return new MockLanguageModelV2({
    doStream: async () => {
      throw new APICallError({
        message: `Content policy violation in: "my IBAN is ${SECRET}"`,
        url: 'https://provider.example.com/v1/chat?api_key=sk-test',
        requestBodyValues: {},
        statusCode: 400,
        isRetryable: false,
        responseBody: JSON.stringify({ error: { message: 'Rejected', prompt: `my IBAN is ${SECRET}` } }),
      });
    },
  });
}

const validateIban = createTool({
  id: 'validateIban',
  description: 'Checks an IBAN',
  inputSchema: z.object({ iban: z.string() }),
  execute: async ({ iban }) => {
    throw new Error(`Invalid IBAN\n    at ${iban}`);
  },
});

function setup(model: MockLanguageModelV2, tracingOptions: Hide) {
  const exporter = new TestExporter();
  const agent = new Agent({
    id: 'banking',
    name: 'Banking',
    instructions: 'Help with payments.',
    model,
    tools: { validateIban },
    defaultOptions: { tracingOptions },
  });
  const observability = new Observability({
    configs: { test: { serviceName: 'hidden-trace-errors-it', exporters: [exporter] } },
  });
  const mastra = new Mastra({
    agents: { banking: agent },
    storage: new MockStore(),
    observability,
  });
  return { exporter, observability, agent: mastra.getAgent('banking') };
}

/**
 * Every exported error. A single flag leaves the other side of the trace visible
 * (hideInput still exports model output that holds tool-call arguments), so only
 * errors are checked: they quote either side.
 */
function exportedErrors(exporter: TestExporter): string {
  return JSON.stringify(exporter.getAllSpans().map(span => span.errorInfo));
}

async function runToolError(tracingOptions: Hide) {
  const { exporter, observability, agent } = setup(toolThenTextModel(), tracingOptions);
  const res = await agent.stream(`Please pay to ${SECRET}`);
  await res.consumeStream();
  await observability?.flush();
  const toolSpan = exporter.getAllSpans().find(span => span.type === SpanType.TOOL_CALL && span.errorInfo);
  return { exporter, toolSpan };
}

async function runProviderError(tracingOptions: Hide) {
  const { exporter, observability, agent } = setup(refusingProviderModel(), tracingOptions);
  // The run fails; only what it exported matters here.
  await agent
    .stream(`my IBAN is ${SECRET}`)
    .then(res => res.consumeStream())
    .catch(() => undefined);
  await observability?.flush();
  const failed = exporter.getAllSpans().filter(span => span.errorInfo);
  return { exporter, failed };
}

describe.each<[string, Hide]>([
  ['hideInput', { hideInput: true }],
  ['hideOutput', { hideOutput: true }],
])('span errors on a trace with %s', (_label, tracingOptions) => {
  it('a tool rejecting the user input exports its error without the input', async () => {
    const { exporter, toolSpan } = await runToolError(tracingOptions);

    expect(toolSpan?.errorInfo).toMatchObject({ name: 'Error', message: REDACTED_ERROR_MESSAGE });
    // The frames still say where it failed.
    expect(toolSpan?.errorInfo?.stack).toMatch(/^Error: \[REDACTED\]\n\s+at /);
    expect(exportedErrors(exporter)).not.toContain(SECRET);
  });

  it('a provider refusing the prompt omits its free-form details', async () => {
    const { exporter, failed } = await runProviderError(tracingOptions);

    expect(failed.length).toBeGreaterThan(0);
    expect(failed.every(span => span.errorInfo?.details === undefined)).toBe(true);
    expect(exportedErrors(exporter)).not.toContain(SECRET);
  });
});

// Guards the cases above: without the flags the same errors must carry the data,
// or the hidden-case checks would pass vacuously.
describe('span errors on a trace that is not hidden', () => {
  it('exports the tool error in full', async () => {
    const { toolSpan } = await runToolError({});

    expect(toolSpan?.errorInfo?.message).toContain(SECRET);
    expect(toolSpan?.errorInfo?.stack).toContain(SECRET);
  });

  it('exports the provider response body', async () => {
    const { failed } = await runProviderError({});

    const responseBody = failed.find(span => span.errorInfo?.details?.responseBody)?.errorInfo?.details?.responseBody;
    expect(JSON.stringify(responseBody)).toContain(SECRET);
  });
});

it('redacts the complete multiline cause message from a wrapped error stack', () => {
  const observability = new Observability({
    configs: { test: { serviceName: 'wrapped-cause-error-it', exporters: [new TestExporter()] } },
  });
  const span = observability.getDefaultInstance()!.startSpan({
    type: SpanType.GENERIC,
    name: 'wrapped operation',
    tracingOptions: { hideInput: true },
  });
  const cause = new Error(`Tool execution failed\n${SECRET}`);
  cause.stack = `Error: ${cause.message}\n    at execute (tool.ts:1:1)`;

  span.error({
    error: new MastraError(
      {
        id: 'TOOL_EXECUTION_FAILED',
        domain: ErrorDomain.TOOL,
        category: ErrorCategory.USER,
        text: 'Tool execution failed',
      },
      cause,
    ),
  });

  const exported = span.exportSpan();
  expect(exported.errorInfo?.stack).toBe('Error: [REDACTED]\n    at execute (tool.ts:1:1)');
  expect(JSON.stringify(exported.errorInfo)).not.toContain(SECRET);
});

describe('redactErrorInfo', () => {
  it('keeps only identity fields and real frames after a frame-shaped line in a multi-line message', () => {
    const message = `line one\n    at ${SECRET}`;
    const redacted = redactErrorInfo({
      id: 'TOOL_EXECUTION_FAILED',
      name: 'MastraError',
      domain: 'TOOL',
      category: 'USER',
      message,
      stack: `MastraError: ${message}\n    at run (tool.ts:1:1)\n    at next (loop.ts:2:2)`,
      details: { toolId: 'validateIban', input: SECRET },
      responseBody: SECRET,
    });

    expect(redacted).toEqual({
      id: 'TOOL_EXECUTION_FAILED',
      name: 'MastraError',
      domain: 'TOOL',
      category: 'USER',
      message: REDACTED_ERROR_MESSAGE,
      stack: 'MastraError: [REDACTED]\n    at run (tool.ts:1:1)\n    at next (loop.ts:2:2)',
    });
  });

  it("keeps a wrapped cause's frames when its stack name differs from the exported identity", () => {
    expect(
      redactErrorInfo({
        name: 'MastraError',
        message: 'Tool execution failed',
        stack: 'Error: Tool execution failed\n    at execute (tool.ts:1:1)',
      }),
    ).toEqual({
      name: 'MastraError',
      message: REDACTED_ERROR_MESSAGE,
      stack: 'MastraError: [REDACTED]\n    at execute (tool.ts:1:1)',
    });
  });

  it('drops a stack body that cannot be correlated with the captured message', () => {
    expect(
      redactErrorInfo({
        name: 'Error',
        message: 'captured message',
        stack: `Error: different message\n    at ${SECRET}\n    at execute (tool.ts:1:1)`,
      }),
    ).toEqual({
      name: 'Error',
      message: REDACTED_ERROR_MESSAGE,
      stack: 'Error: [REDACTED]',
    });

    expect(
      redactErrorInfo({
        name: 'Error',
        message: 'captured message',
        stack: 'Error: captured message and untrusted continuation',
      }),
    ).toEqual({
      name: 'Error',
      message: REDACTED_ERROR_MESSAGE,
      stack: 'Error: [REDACTED]',
    });
  });

  it('handles a stack with no frames and an error with no stack', () => {
    expect(redactErrorInfo({ name: 'TypeError', message: SECRET, stack: `TypeError: ${SECRET}` })).toEqual({
      name: 'TypeError',
      message: REDACTED_ERROR_MESSAGE,
      stack: 'TypeError: [REDACTED]',
    });
    expect(redactErrorInfo({ message: SECRET })).toEqual({ message: REDACTED_ERROR_MESSAGE });
    expect(redactErrorInfo(undefined)).toBeUndefined();
  });
});
