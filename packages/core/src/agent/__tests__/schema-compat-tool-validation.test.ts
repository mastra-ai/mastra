import { convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { AISDKV5LanguageModel } from '../../llm/model/aisdk/v5/model';
import { Mastra } from '../../mastra';
import { RequestContext } from '../../request-context';
import { createTool } from '../../tools';
import { Agent } from '../agent';

const HAIKU_MODEL_ID = 'claude-3.5-haiku-20241022';
const SHORT_TEXT = 'Short text';

function createHaikuMockModel({ toolName, toolInput }: { toolName: string; toolInput: Record<string, unknown> }) {
  let callCount = 0;

  return new AISDKV5LanguageModel({
    specificationVersion: 'v2',
    provider: 'anthropic',
    modelId: HAIKU_MODEL_ID,
    supportedUrls: {},
    doGenerate: async () => {
      callCount++;
      if (callCount === 1) {
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          finishReason: 'tool-calls' as const,
          usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          content: [
            {
              type: 'tool-call' as const,
              toolCallId: 'call-haiku-1',
              toolName,
              input: JSON.stringify(toolInput),
            },
          ],
          warnings: [],
        };
      }

      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        finishReason: 'stop' as const,
        usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
        content: [{ type: 'text' as const, text: 'Done' }],
        warnings: [],
      };
    },
    doStream: async () => ({
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'id-0', modelId: HAIKU_MODEL_ID, timestamp: new Date(0) },
        {
          type: 'tool-call',
          toolCallId: 'call-haiku-1',
          toolName,
          input: JSON.stringify(toolInput),
          providerExecuted: false,
        },
        {
          type: 'finish',
          finishReason: 'tool-calls',
          usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
        },
      ]),
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
    }),
  });
}

function createShortTextTool(execute = vi.fn(async ({ text }: { text: string }) => ({ success: true, text }))) {
  return createTool({
    id: 'short-text-tool',
    description: 'Accepts text with a minimum length in the author schema',
    inputSchema: z.object({
      text: z.string().min(20).describe('Text with minimum 20 characters'),
    }),
    execute,
  });
}

describe('Agent Haiku schema-compat tool validation', () => {
  it('convertTools strips minLength for Haiku and execute accepts LLM-sized input', async () => {
    const execute = vi.fn(async ({ text }: { text: string }) => ({ success: true, text }));
    const shortTextTool = createShortTextTool(execute);

    const agent = new Agent({
      id: 'haiku-agent',
      name: 'Haiku Agent',
      instructions: 'Call shortTextTool when asked',
      model: createHaikuMockModel({ toolName: 'shortTextTool', toolInput: { text: SHORT_TEXT } }),
      tools: { shortTextTool },
    });

    const tools = await agent['convertTools']({
      requestContext: new RequestContext(),
      methodType: 'generate',
    });

    const llmJsonSchema = (tools.shortTextTool.parameters as { jsonSchema?: { properties?: Record<string, unknown> } })
      .jsonSchema;
    const textProp = llmJsonSchema?.properties?.text as { minLength?: number } | undefined;
    expect(textProp?.minLength).toBeUndefined();

    const executeResult = await tools.shortTextTool.execute?.(
      { text: SHORT_TEXT },
      {
        abortSignal: new AbortController().signal,
        toolCallId: 'call-haiku-1',
        messages: [],
      },
    );

    expect(executeResult).not.toHaveProperty('error');
    expect(executeResult).toEqual({ success: true, text: SHORT_TEXT });
    expect(execute).toHaveBeenCalledWith({ text: SHORT_TEXT }, expect.any(Object));
  });

  it('agent.generate runs the tool when Haiku sends sub-min-length args', async () => {
    const execute = vi.fn(async ({ text }: { text: string }) => ({ success: true, text }));
    const shortTextTool = createShortTextTool(execute);

    const agent = new Agent({
      id: 'haiku-agent',
      name: 'Haiku Agent',
      instructions: 'Call shortTextTool when asked',
      model: createHaikuMockModel({ toolName: 'shortTextTool', toolInput: { text: SHORT_TEXT } }),
      tools: { shortTextTool },
    });

    const mastra = new Mastra({
      agents: { 'haiku-agent': agent },
      logger: false,
    });

    const response = await mastra.getAgent('haiku-agent').generate('Use shortTextTool');

    const toolResult = response.toolResults.find(r => r.payload.toolName === 'shortTextTool')?.payload;
    expect(toolResult?.result).toEqual({ success: true, text: SHORT_TEXT });
    expect(execute).toHaveBeenCalledTimes(1);
    expect(execute).toHaveBeenCalledWith({ text: SHORT_TEXT }, expect.any(Object));
  });
});
