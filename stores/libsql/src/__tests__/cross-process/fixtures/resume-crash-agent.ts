// Agent with one approval-gated tool whose runs are logged to a file shared by
// every process. Stateless model: a tool call until the prompt carries a tool
// result, then final text.
import { appendFileSync } from 'node:fs';

import { Agent } from '@mastra/core/agent';
import { MastraLanguageModelV2Mock } from '@mastra/core/test-utils/llm-mock';
import { createTool } from '@mastra/core/tools';

export type CrashAt = 'mid-tool' | 'after-tool' | 'none';

function chunks(parts: unknown[]): ReadableStream<any> {
  return new ReadableStream({
    start(controller) {
      for (const part of parts) controller.enqueue(part);
      controller.close();
    },
  });
}

const never = () => new Promise<never>(() => {});

export function createCrashAgent({
  logPath,
  crashAt,
  onCrashPoint,
}: {
  logPath: string;
  crashAt: CrashAt;
  onCrashPoint?: (where: string) => void;
}) {
  const model = new MastraLanguageModelV2Mock({
    doStream: async ({ prompt }: any) => {
      const head = [
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'resp', modelId: 'mock-model-id', timestamp: new Date(0) },
      ];
      const hasToolResult = prompt.some((m: any) => m.role === 'tool');
      if (!hasToolResult) {
        return {
          stream: chunks([
            ...head,
            {
              type: 'tool-call',
              toolCallId: 'call-1',
              toolName: 'act',
              input: JSON.stringify({ n: 1 }),
              providerExecuted: false,
            },
            { type: 'finish', finishReason: 'tool-calls', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
          ]),
          rawCall: { rawPrompt: null, rawSettings: {} },
        };
      }
      if (crashAt === 'after-tool') {
        onCrashPoint?.('model-after-tool');
        return never();
      }
      return {
        stream: chunks([
          ...head,
          { type: 'text-start', id: 't' },
          { type: 'text-delta', id: 't', delta: 'done' },
          { type: 'text-end', id: 't' },
          { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
        ]),
        rawCall: { rawPrompt: null, rawSettings: {} },
      };
    },
  });

  const act = createTool({
    id: 'act',
    description: 'Do the side effect.',
    inputSchema: {
      type: 'object',
      properties: { n: { type: 'number' } },
      required: ['n'],
      additionalProperties: false,
    },
    execute: async () => {
      appendFileSync(logPath, `start ${process.pid}\n`);
      if (crashAt === 'mid-tool') {
        onCrashPoint?.('mid-tool');
        await never();
      }
      appendFileSync(logPath, `commit ${process.pid}\n`);
      return { ok: true };
    },
  });

  const agent = new Agent({
    id: 'crash-agent',
    name: 'crash-agent',
    instructions: 'Follow the script.',
    model,
    tools: { act },
  });
  return { agent };
}
