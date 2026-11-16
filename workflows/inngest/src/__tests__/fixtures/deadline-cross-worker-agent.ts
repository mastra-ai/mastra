/**
 * Shared agent for the cross-worker deadline test.
 *
 * The model (served by aimock) asks for `slow`, a tool that records which worker started it and,
 * when its abort signal fires, the abort reason. It stops early when aborted.
 *
 * An output processor records each process that runs the turn's output pass (`output-pass`) and the
 * finish reason it saw, so a test can tell how a worker ended the run.
 *
 * The driver and every serve() worker build the SAME agent from this factory.
 */
import { appendFileSync, mkdirSync } from 'node:fs';
import { createOpenAI } from '@ai-sdk/openai-v5';
import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import { createTool } from '@mastra/core/tools';
import { DefaultStorage } from '@mastra/libsql';
import { Memory } from '@mastra/memory';
import { Inngest } from 'inngest';
import { z } from 'zod';

import { createInngestAgent } from '../../durable-agent';
import { createInngestDurableAgenticWorkflow } from '../../durable-agent/create-inngest-agentic-workflow';

export const DEADLINE_TOOL_MS = 8_000;

export function buildDeadlineCrossWorkerAgent({
  dbUrl,
  agentId,
  inngestPort,
  mockUrl,
  outDir,
  workerName,
}: {
  dbUrl: string;
  agentId: string;
  inngestPort: number;
  mockUrl: string;
  outDir: string;
  workerName: string;
}) {
  const inngest = new Inngest({ id: 'deadline-cross-worker-test', baseUrl: `http://localhost:${inngestPort}` });
  const provider = createOpenAI({ apiKey: 'aimock-test-key', baseURL: `${mockUrl}/v1` });
  const log = (line: object) => {
    mkdirSync(outDir, { recursive: true });
    appendFileSync(`${outDir}/events.jsonl`, `${JSON.stringify({ worker: workerName, ...line })}\n`);
  };

  const slow = createTool({
    id: 'slow',
    description: 'Do slow work',
    inputSchema: z.object({}),
    execute: async (_input, context) => {
      log({ event: 'tool-started' });
      const signal = context?.abortSignal;
      await new Promise<void>(resolve => {
        const timer = setTimeout(resolve, DEADLINE_TOOL_MS);
        signal?.addEventListener('abort', () => {
          log({ event: 'tool-aborted', reason: (signal.reason as Error | undefined)?.name });
          clearTimeout(timer);
          resolve();
        });
      });
      return { done: true };
    },
  });

  const storage = new DefaultStorage({ id: `deadline-cross-worker-${agentId}`, url: dbUrl });
  const memory = new Memory({ storage });

  const agent = new Agent({
    id: agentId,
    name: 'Deadline Cross Worker Agent',
    instructions: 'Call slow, then reply.',
    model: provider.chat('deadline-cross-worker-model'),
    tools: { slow },
    memory,
    outputProcessors: [
      {
        id: 'output-pass-probe',
        processOutputResult: ({ messages, result }) => {
          log({ event: 'output-pass', finishReason: result.finishReason });
          return messages;
        },
      },
    ],
  });

  const durableAgent = createInngestAgent({ agent, inngest });
  const workflow = createInngestDurableAgenticWorkflow({ inngest });

  const mastra = new Mastra({
    storage,
    agents: { [agentId]: durableAgent } as any,
    workflows: { [workflow.id]: workflow } as any,
  });

  return { inngest, mastra, durableAgent, memory };
}
