/**
 * Shared agent for the HTTP tool-approval regression test (issue #25154).
 *
 * The agent calls `save_note`, which has `requireApproval: true`, so the durable run suspends on a
 * pending approval. When the approval resumes the run, the tool writes a marker file under OUT dir so
 * the driver process (which can't see the worker's memory) can prove the tool really executed.
 *
 * Both the driver and the connect() worker build the SAME agent from this factory.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import type { MastraAuthProvider } from '@mastra/core/server';
import { createTool } from '@mastra/core/tools';
import { DefaultStorage } from '@mastra/libsql';
import { Memory } from '@mastra/memory';
import { simulateReadableStream } from 'ai';
import { Inngest } from 'inngest';
import { z } from 'zod';

import { createInngestAgent } from '../../durable-agent';
import { createInngestDurableAgenticWorkflow } from '../../durable-agent/create-inngest-agentic-workflow';

/** First call: request save_note. Every later call: reply with text so the run can finish. */
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

export function buildApprovalHttpAgent({
  dbUrl,
  agentId,
  inngestPort,
  outDir,
  auth,
}: {
  dbUrl: string;
  agentId: string;
  inngestPort: number;
  outDir: string;
  /** Server auth for the HTTP driver; the connect() worker serves no HTTP routes. */
  auth?: MastraAuthProvider<any>;
}) {
  const inngest = new Inngest({ id: 'approval-http-test', baseUrl: `http://localhost:${inngestPort}` });

  const saveNote = createTool({
    id: 'save_note',
    description: 'Save a note',
    inputSchema: z.object({ text: z.string() }),
    requireApproval: true,
    execute: async input => {
      mkdirSync(outDir, { recursive: true });
      writeFileSync(`${outDir}/note.txt`, input.text);
      return { saved: true };
    },
  });

  const storage = new DefaultStorage({ id: `approval-http-${agentId}`, url: dbUrl });

  const agent = new Agent({
    id: agentId,
    name: 'Approval HTTP Agent',
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
    ...(auth ? { server: { auth } } : {}),
  });

  return { inngest, mastra, durableAgent, storage };
}
