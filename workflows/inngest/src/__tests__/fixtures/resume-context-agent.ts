/**
 * Shared agent for the resume-context regression test (issue #19873).
 *
 * A durable run that suspends for tool approval must, on resume, see the SAME `requestContext` it
 * had on the initial run and continue the SAME trace. Both are lost today because the Inngest
 * engine's suspend snapshot never persists `requestContext`/`tracingContext`.
 *
 * The tool records the `tenant` it observed from `requestContext` into a file under a per-run OUT
 * dir, so the driver process (which can't see the worker's memory) can assert what the resumed tool
 * saw. Observability is configured so the workflow root span gets a real traceId — the test compares
 * the suspend snapshot's traceId with the resumed run's to prove the trace is continuous.
 *
 * Both the driver and the connect() worker build the SAME agent from this factory, mirroring
 * production where a web replica and a worker pool each construct the agent from the same code but
 * keep their own in-memory globalRunRegistry.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import { createTool } from '@mastra/core/tools';
import { DefaultStorage } from '@mastra/libsql';
import { Memory } from '@mastra/memory';
import { Observability, MastraStorageExporter } from '@mastra/observability';
import { simulateReadableStream } from 'ai';
import { Inngest } from 'inngest';
import { z } from 'zod';

import { createInngestAgent } from '../../durable-agent';
import { createInngestDurableAgenticWorkflow } from '../../durable-agent/create-inngest-agentic-workflow';

/** First turn calls the approval tool; a later turn answers with text. */
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
                toolName: 'save_note',
                input: JSON.stringify({ text: 'note' }),
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

export function buildResumeContextAgent({
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
  const inngest = new Inngest({ id: 'resume-context-test', baseUrl: `http://localhost:${inngestPort}` });

  // Suspends for approval; on approve, writes the tenant it read from requestContext into
  // `${outDir}/<tenant>/note.txt`. Before the fix the resumed invocation reads an empty
  // requestContext, so tenant falls back to 'anon' and the file lands in the wrong place.
  const saveNote = createTool({
    id: 'save_note',
    description: 'Save a note after the user approves',
    inputSchema: z.object({ text: z.string() }),
    suspendSchema: z.object({ text: z.string() }),
    resumeSchema: z.object({ approved: z.boolean() }),
    execute: async (input: any, execCtx: any) => {
      const agentCtx = execCtx?.agent ?? execCtx ?? {};
      if (agentCtx.resumeData == null) {
        await agentCtx.suspend?.({ text: input.text });
        return { saved: false };
      }
      if (!agentCtx.resumeData.approved) return { saved: false };
      const tenant = execCtx?.requestContext?.get?.('tenant') ?? 'anon';
      const dir = `${outDir}/${tenant}`;
      mkdirSync(dir, { recursive: true });
      writeFileSync(`${dir}/note.txt`, input.text);
      return { saved: true, tenant };
    },
  });

  const storage = new DefaultStorage({ id: `resume-ctx-${agentId}`, url: dbUrl });

  const agent = new Agent({
    id: agentId,
    name: 'Resume Context Agent',
    instructions: 'Call save_note, then confirm.',
    model: toolCallThenText(),
    tools: { save_note: saveNote },
    memory: new Memory({ storage }),
  });

  const durableAgent = createInngestAgent({ agent, inngest });
  const workflow = createInngestDurableAgenticWorkflow({ inngest });

  const mastra = new Mastra({
    storage,
    agents: { [agentId]: durableAgent } as any,
    workflows: { [workflow.id]: workflow } as any,
    observability: new Observability({
      configs: { default: { serviceName: 'resume-context-test', exporters: [new MastraStorageExporter()] } },
    }),
  });

  return { inngest, mastra, durableAgent, storage };
}
