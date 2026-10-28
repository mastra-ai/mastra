/**
 * Shared agent for the HTTP run-abort regression test (#28483).
 *
 * The model (served by aimock) asks for `wait`, a slow tool that writes a marker file when it
 * starts, so the driver process knows the run is mid-tool, and stops early when aborted.
 *
 * Both the driver and the connect() worker build the SAME agent from this factory.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { createOpenAI } from '@ai-sdk/openai-v5';
import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import type { MastraAuthProvider } from '@mastra/core/server';
import { createTool } from '@mastra/core/tools';
import { DefaultStorage } from '@mastra/libsql';
import { Memory } from '@mastra/memory';
import { Inngest } from 'inngest';
import { z } from 'zod';

import { createInngestAgent } from '../../durable-agent';
import { createInngestDurableAgenticWorkflow } from '../../durable-agent/create-inngest-agentic-workflow';

export const ABORT_HTTP_TOOL_MS = 8_000;

export function buildAbortHttpAgent({
  dbUrl,
  agentId,
  inngestPort,
  mockUrl,
  outDir,
  auth,
}: {
  dbUrl: string;
  agentId: string;
  inngestPort: number;
  mockUrl: string;
  outDir: string;
  /** Server auth for the HTTP driver; the connect() worker serves no HTTP routes. */
  auth?: MastraAuthProvider<any>;
}) {
  const inngest = new Inngest({ id: 'abort-http-test', baseUrl: `http://localhost:${inngestPort}` });
  const provider = createOpenAI({ apiKey: 'aimock-test-key', baseURL: `${mockUrl}/v1` });

  const wait = createTool({
    id: 'wait',
    description: 'Wait for a while',
    inputSchema: z.object({}),
    execute: async (_input, context) => {
      mkdirSync(outDir, { recursive: true });
      writeFileSync(`${outDir}/tool-started`, '1');
      const signal = context?.abortSignal;
      await new Promise<void>(resolve => {
        const timer = setTimeout(resolve, ABORT_HTTP_TOOL_MS);
        signal?.addEventListener('abort', () => {
          clearTimeout(timer);
          resolve();
        });
      });
      return { waited: true };
    },
  });

  const storage = new DefaultStorage({ id: `abort-http-${agentId}`, url: dbUrl });

  const agent = new Agent({
    id: agentId,
    name: 'Abort HTTP Agent',
    instructions: 'Call wait, then reply.',
    model: provider.chat('abort-http-model'),
    tools: { wait },
    memory: new Memory({ storage }),
  });

  const durableAgent = createInngestAgent({ agent, inngest });
  const workflow = createInngestDurableAgenticWorkflow({ inngest });

  const mastra = new Mastra({
    storage,
    agents: { [agentId]: durableAgent } as any,
    workflows: { [workflow.id]: workflow } as any,
    ...(auth ? { server: { auth } } : {}),
  });

  return { inngest, mastra, durableAgent, storage };
}
