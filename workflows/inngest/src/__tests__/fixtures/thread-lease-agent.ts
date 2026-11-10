import { appendFileSync } from 'node:fs';
import { Agent } from '@mastra/core/agent';
import { UnixSocketPubSub } from '@mastra/core/events';
import { Mastra } from '@mastra/core/mastra';
import { createTool } from '@mastra/core/tools';
import { DefaultStorage } from '@mastra/libsql';
import { Memory } from '@mastra/memory';
import { simulateReadableStream } from 'ai';
import { Inngest } from 'inngest';
import { z } from 'zod';

import { createInngestAgent } from '../../durable-agent';
import { createInngestDurableAgenticWorkflow } from '../../durable-agent/create-inngest-agentic-workflow';

export const WAIT_MS = 20_000;

const usage = { inputTokens: 5, outputTokens: 5, totalTokens: 10 };

function textOf(message: any): string {
  const content = message?.content;
  if (typeof content === 'string') return content;
  return (content ?? [])
    .filter((part: any) => part.type === 'text')
    .map((part: any) => part.text)
    .join('');
}

/** Calls `wait`, then `sideEffect`, then answers. The tag is the turn's user prompt. */
function toolSequenceModel(): any {
  return {
    specificationVersion: 'v2',
    provider: 'mock',
    modelId: 'thread-lease-model',
    supportedUrls: {},
    async doGenerate() {
      return {
        content: [{ type: 'text', text: 'Title' }],
        finishReason: 'stop',
        usage,
        warnings: [],
        rawCall: { rawPrompt: null, rawSettings: {} },
      };
    },
    async doStream(options: any) {
      const prompt: any[] = options?.prompt ?? [];
      const last = prompt.at(-1);
      const tag = textOf(prompt.filter(message => message.role === 'user').at(-1));
      const lastTool = last?.role === 'tool' ? last.content?.at(-1)?.toolName : undefined;
      const toolName = lastTool === undefined ? 'wait' : lastTool === 'wait' ? 'sideEffect' : undefined;
      const chunks: any[] = [
        { type: 'stream-start', warnings: [] },
        {
          type: 'response-metadata',
          id: `response-${Date.now()}`,
          modelId: 'thread-lease-model',
          timestamp: new Date(0),
        },
      ];
      if (toolName) {
        chunks.push(
          { type: 'tool-call', toolCallId: `${toolName}-${tag}`, toolName, input: JSON.stringify({ tag }) },
          { type: 'finish', finishReason: 'tool-calls', usage },
        );
      } else {
        chunks.push(
          { type: 'text-start', id: 'text-1' },
          { type: 'text-delta', id: 'text-1', delta: `done ${tag}` },
          { type: 'text-end', id: 'text-1' },
          { type: 'finish', finishReason: 'stop', usage },
        );
      }
      return { stream: simulateReadableStream({ chunks }), rawCall: { rawPrompt: null, rawSettings: {} } };
    },
  };
}

export function buildThreadLeaseAgent({
  dbUrl,
  agentId,
  inngestPort,
  socketPath,
  logPath,
}: {
  dbUrl: string;
  agentId: string;
  inngestPort: number;
  socketPath: string;
  logPath: string;
}) {
  const log = (event: string, tag: string) =>
    appendFileSync(logPath, `${JSON.stringify({ event, tag, at: Date.now() })}\n`);

  const wait = createTool({
    id: 'wait',
    description: 'Wait a while.',
    inputSchema: z.object({ tag: z.string() }),
    execute: async ({ tag }) => {
      log('wait-start', tag);
      await new Promise(resolve => setTimeout(resolve, WAIT_MS));
      log('wait-end', tag);
      return { waited: true };
    },
  });
  const sideEffect = createTool({
    id: 'sideEffect',
    description: 'Do something that must not run concurrently.',
    inputSchema: z.object({ tag: z.string() }),
    execute: async ({ tag }) => {
      log('side-effect', tag);
      return { done: true };
    },
  });

  const inngest = new Inngest({ id: 'thread-lease-test', baseUrl: `http://localhost:${inngestPort}` });
  const storage = new DefaultStorage({ id: `thread-lease-${agentId}`, url: dbUrl });
  const agent = new Agent({
    id: agentId,
    name: 'Thread Lease Agent',
    instructions: 'Use the tools.',
    model: toolSequenceModel(),
    memory: new Memory({ storage }),
    tools: { wait, sideEffect },
  });

  const durableAgent = createInngestAgent({ agent, inngest });
  const workflow = createInngestDurableAgenticWorkflow({ inngest });
  const pubsub = new UnixSocketPubSub(socketPath);
  const mastra = new Mastra({
    storage,
    pubsub,
    agents: { [agentId]: durableAgent } as any,
    workflows: { [workflow.id]: workflow } as any,
  });

  return { durableAgent, inngest, mastra, pubsub };
}
