import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { Agent } from '../../agent';
import { convertArrayToReadableStream, MockLanguageModelV2 } from '../../agent/__tests__/mock-model';
import { noopLogger } from '../../logger';
import { runBeforeApprovalHook } from '../../loop/workflows/agentic-execution/tool-approval-verdict';
import { RequestContext } from '../../request-context';
import { createTool } from '../tool';
import { CoreToolBuilder } from './builder';

// Regression coverage for https://github.com/mastra-ai/mastra/issues/27259:
// transforming input schemas must decode the raw model args exactly once.
function createUrlTool(opts: { onTransform?: () => void; beforeApproval?: (input: any) => any } = {}) {
  const inputSchema = z.object({
    url: z.string().transform(s => {
      opts.onTransform?.();
      return new URL(s);
    }),
  });
  return createTool({
    id: 'fetch-url',
    description: 'Fetch a URL',
    inputSchema,
    ...(opts.beforeApproval ? { requireApproval: true, beforeApproval: opts.beforeApproval } : {}),
    execute: async input => ({ isUrl: input.url instanceof URL, href: input.url.href }),
  });
}

function build(tool: ReturnType<typeof createUrlTool>) {
  return new CoreToolBuilder({
    originalTool: tool,
    options: { name: 'fetch-url', logger: noopLogger, requestContext: new RequestContext() } as any,
  }).build();
}

describe('CoreToolBuilder with transforming Standard Schema inputs', () => {
  it('SDK-facing validator accepts raw args and returns them undecoded', async () => {
    const built = build(createUrlTool());
    const result = await (built.parameters as any).validate({ url: 'https://example.com/' });
    expect(result).toEqual({ success: true, value: { url: 'https://example.com/' } });
  });

  it('decodes raw args exactly once when the built tool executes', async () => {
    const onTransform = vi.fn();
    const built = build(createUrlTool({ onTransform }));

    const validated = await (built.parameters as any).validate({ url: 'https://example.com/' });
    const result = await built.execute!(validated.value, { toolCallId: 'call-1', messages: [] });

    expect(result).toEqual({ isUrl: true, href: 'https://example.com/' });
    // Once by the SDK-facing gate, once by createExecute; Tool.execute must not decode again.
    expect(onTransform).toHaveBeenCalledTimes(2);
  });

  it('passes the decoded value to beforeApproval', async () => {
    const beforeApproval = vi.fn().mockReturnValue(undefined);
    const built = build(createUrlTool({ beforeApproval }));

    await runBeforeApprovalHook({
      tool: built as any,
      input: { url: 'https://example.com/' },
      context: { toolCallId: 'call-1', toolName: 'fetch-url', requestContext: new RequestContext() } as any,
    });

    expect(beforeApproval).toHaveBeenCalledTimes(1);
    expect(beforeApproval.mock.calls[0]![0].url).toBeInstanceOf(URL);
  });

  it('runs the handler with decoded input when called by an agent', async () => {
    let callCount = 0;
    const model = new MockLanguageModelV2({
      doStream: async () => {
        callCount++;
        const stream =
          callCount === 1
            ? [
                { type: 'stream-start', warnings: [] },
                { type: 'response-metadata', id: 'id-1', modelId: 'mock', timestamp: new Date(0) },
                {
                  type: 'tool-call',
                  toolCallId: 'call-1',
                  toolName: 'fetchUrl',
                  input: '{"url":"https://example.com/"}',
                  providerExecuted: false,
                },
                {
                  type: 'finish',
                  finishReason: 'tool-calls',
                  usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
                },
              ]
            : [
                { type: 'stream-start', warnings: [] },
                { type: 'response-metadata', id: 'id-2', modelId: 'mock', timestamp: new Date(0) },
                { type: 'text-start', id: 't' },
                { type: 'text-delta', id: 't', delta: 'done' },
                { type: 'text-end', id: 't' },
                { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
              ];
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream: convertArrayToReadableStream(stream as any),
        };
      },
    });

    const agent = new Agent({
      id: 'url-agent',
      name: 'url-agent',
      instructions: 'Fetch URLs',
      model,
      tools: { fetchUrl: createUrlTool() },
    });

    const stream = await agent.stream('fetch https://example.com/');
    let toolResult: unknown;
    for await (const chunk of stream.fullStream) {
      if (chunk.type === 'tool-result') toolResult = chunk.payload.result;
    }
    expect(toolResult).toEqual({ isUrl: true, href: 'https://example.com/' });
  });
});
