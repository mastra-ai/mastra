/**
 * Shared agent for the input-processor requestContext regression test (issue #23904).
 *
 * An input processor writes a value into the requestContext during preparation (which runs in the
 * driver process). The durable loop — and the tool call — execute on a separate connect() worker,
 * whose globalRunRegistry is empty, so the tool's requestContext is rebuilt from the serialized
 * `requestContextEntries` on the workflow input. Before the fix, that snapshot was taken BEFORE
 * input processors ran, so the processor's write never reached the worker.
 *
 * The tool records the values it observed from requestContext into `${outDir}/observed.json`, so
 * the driver process (which can't see the worker's memory) can assert what the tool actually saw.
 *
 * Both the driver and the connect() worker build the SAME agent from this factory, mirroring
 * production where a web replica and a worker pool each construct the agent from the same code but
 * keep their own in-memory globalRunRegistry.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import type { Processor } from '@mastra/core/processors';
import { createTool } from '@mastra/core/tools';
import { DefaultStorage } from '@mastra/libsql';
import { simulateReadableStream } from 'ai';
import { Inngest } from 'inngest';
import { z } from 'zod';

import { createInngestAgent } from '../../durable-agent';
import { createInngestDurableAgenticWorkflow } from '../../durable-agent/create-inngest-agentic-workflow';

/** First turn calls the recording tool; the next turn answers with text. */
function toolCallThenText(): any {
  let call = 0;
  return {
    specificationVersion: 'v2',
    provider: 'mock',
    modelId: 'mock-model',
    supportedUrls: {},
    async doStream() {
      call++;
      const chunks =
        call === 1
          ? [
              { type: 'stream-start', warnings: [] },
              { type: 'response-metadata', id: 'id-0', modelId: 'mock-model', timestamp: new Date(0) },
              {
                type: 'tool-call',
                toolCallId: 'call-1',
                toolName: 'record_context',
                input: JSON.stringify({}),
                providerExecuted: false,
              },
              {
                type: 'finish',
                finishReason: 'tool-calls',
                usage: { inputTokens: 5, outputTokens: 5, totalTokens: 10 },
              },
            ]
          : [
              { type: 'stream-start', warnings: [] },
              { type: 'response-metadata', id: 'id-1', modelId: 'mock-model', timestamp: new Date(0) },
              { type: 'text-start', id: 't1' },
              { type: 'text-delta', id: 't1', delta: 'Done.' },
              { type: 'text-end', id: 't1' },
              { type: 'finish', finishReason: 'stop', usage: { inputTokens: 5, outputTokens: 5, totalTokens: 10 } },
            ];
      return {
        stream: simulateReadableStream({ chunks: chunks as any }),
        rawCall: { rawPrompt: null, rawSettings: {} },
      };
    },
  };
}

export function buildProcessorContextAgent({
  dbUrl,
  agentId,
  inngestPort,
  outDir,
}: {
  dbUrl: string;
  agentId: string;
  inngestPort: number;
  outDir: string;
}) {
  const inngest = new Inngest({ id: 'processor-context-test', baseUrl: `http://localhost:${inngestPort}` });

  // Runs during preparation in the DRIVER process. Its write must survive the
  // serialization boundary to reach the tool on the worker.
  const routePinProcessor: Processor = {
    id: 'route-pin',
    name: 'route-pin',
    processInput: async ({ requestContext, messages }) => {
      requestContext?.set('route', 'processor-pinned');
      return messages;
    },
  };

  // Records what it observed from requestContext so the driver can assert on it.
  const recordContext = createTool({
    id: 'record_context',
    description: 'Record the request context values this tool observed',
    inputSchema: z.object({}),
    execute: async (_input: any, execCtx: any) => {
      const route = execCtx?.requestContext?.get?.('route') ?? 'missing';
      const tenant = execCtx?.requestContext?.get?.('tenant') ?? 'missing';
      mkdirSync(outDir, { recursive: true });
      writeFileSync(path.join(outDir, 'observed.json'), JSON.stringify({ route, tenant }));
      return { recorded: true };
    },
  });

  const storage = new DefaultStorage({ id: `processor-ctx-${agentId}`, url: dbUrl });

  const agent = new Agent({
    id: agentId,
    name: 'Processor Context Agent',
    instructions: 'Call record_context, then confirm.',
    model: toolCallThenText(),
    tools: { record_context: recordContext },
    inputProcessors: [routePinProcessor as any],
  });

  const durableAgent = createInngestAgent({ agent, inngest });
  const workflow = createInngestDurableAgenticWorkflow({ inngest });

  const mastra = new Mastra({
    storage,
    agents: { [agentId]: durableAgent } as any,
    workflows: { [workflow.id]: workflow } as any,
  });

  return { inngest, mastra, durableAgent, storage };
}
