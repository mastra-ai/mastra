import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import { SpanType, TracingEventType } from '@mastra/core/observability';
import { createCodeMode, createTool } from '@mastra/core/tools';
import { LocalSandbox } from '@mastra/core/workspace';
import { afterEach, describe, expect, it } from 'vitest';
import { z } from 'zod/v4';

import { Observability } from './default';
import { TestExporter } from './exporters';

describe('Code Mode tracing', () => {
  let observability: Observability | undefined;

  afterEach(async () => {
    await observability?.shutdown();
  });

  it('traces each tool the program calls as a tool call under the code-mode span', async () => {
    const lookupOrder = createTool({
      id: 'lookup_order',
      description: 'Look up an order',
      inputSchema: z.object({ orderId: z.string() }),
      execute: async ({ orderId }) => ({ orderId, total: 42 }),
    });
    const codeMode = createCodeMode({ tools: { lookup_order: lookupOrder }, sandbox: new LocalSandbox() });
    const program = `return await external_lookup_order({ orderId: 'o-1' });`;

    let calls = 0;
    const model = new MockLanguageModelV2({
      doStream: async () => ({
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: convertArrayToReadableStream(
          calls++ === 0
            ? [
                { type: 'stream-start', warnings: [] },
                {
                  type: 'tool-call',
                  toolCallId: 'call-1',
                  toolName: codeMode.tool.id,
                  input: JSON.stringify({ code: program }),
                },
                {
                  type: 'finish',
                  finishReason: 'tool-calls',
                  usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
                },
              ]
            : [
                { type: 'stream-start', warnings: [] },
                { type: 'text-start', id: 't' },
                { type: 'text-delta', id: 't', delta: 'done' },
                { type: 'text-end', id: 't' },
                { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
              ],
        ),
      }),
    });
    const exporter = new TestExporter();
    observability = new Observability({ configs: { default: { serviceName: 'code-mode', exporters: [exporter] } } });
    const agent = new Agent({
      id: 'code-agent',
      name: 'code-agent',
      instructions: codeMode.instructions,
      model,
      tools: { [codeMode.tool.id]: codeMode.tool },
    });
    new Mastra({ logger: false, agents: { agent }, observability });

    const output = await agent.stream('Look up order o-1');
    await output.consumeStream();

    const ended = exporter.getByEventType(TracingEventType.SPAN_ENDED).map(event => event.exportedSpan);
    const codeSpan = ended.find(span => span.name === `code-mode:${codeMode.tool.id}`);
    const toolSpan = ended.find(span => span.type === SpanType.TOOL_CALL && span.entityId === 'lookup_order');
    expect(toolSpan).toMatchObject({
      name: "tool: 'lookup_order'",
      parentSpanId: codeSpan?.id,
      input: { orderId: 'o-1' },
      output: { orderId: 'o-1', total: 42 },
      attributes: { success: true },
    });
  }, 30_000);
});
