/**
 * Shared agent definition for the cross-process message-persistence test.
 *
 * Both the driver (test process, calls `stream()`) and the worker (separate process, executes the
 * durable loop) build the SAME agent from this factory — mirroring production, where a web replica
 * and a worker pool each construct the agent from the same code but keep their own in-memory
 * `globalRunRegistry`.
 *
 * The model is deterministic and STATELESS: it replies `recall:yes` when any message in its prompt
 * mentions "Zebra", else `recall:no`. Turn 1's user message contains the marker, so turn 2 (which
 * doesn't) proves memory recall: the model can only see "Zebra" if turn-1 history was loaded.
 */
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Agent } from '@mastra/core/agent';
import { createScorer } from '@mastra/core/evals';
import { Mastra } from '@mastra/core/mastra';
import { createSkill } from '@mastra/core/skills';
import { createTool } from '@mastra/core/tools';
import { Workspace, LocalFilesystem } from '@mastra/core/workspace';
import { DefaultStorage } from '@mastra/libsql';
import { Memory } from '@mastra/memory';
import { Observability, MastraStorageExporter } from '@mastra/observability';
import { simulateReadableStream } from 'ai';
import { Inngest } from 'inngest';
import { z } from 'zod';

import { createInngestAgent } from '../../durable-agent';
import { createInngestDurableAgenticWorkflow } from '../../durable-agent/create-inngest-agentic-workflow';

/**
 * Prompt-scripted, STATELESS mock model (no per-process call counters — the driver and the
 * connect worker each construct their own instance):
 *
 * - Prompt asks to "use the tools" and carries no tool results yet → emit two tool calls
 *   (`add` and `mastra_workspace_write_file`), finishReason `tool-calls`.
 * - Prompt asks to "use the tools" and already carries tool results → reply `tools:done`.
 * - Otherwise: the recall probe — reply `recall:yes` iff the prompt contains "Zebra".
 */
function recallProbeModel(): any {
  return {
    specificationVersion: 'v2',
    provider: 'mock',
    modelId: 'mock-model',
    supportedUrls: {},
    // Thread-title generation uses generate (not stream).
    async doGenerate() {
      return {
        content: [{ type: 'text', text: 'Test Thread Title' }],
        finishReason: 'stop',
        usage: { inputTokens: 5, outputTokens: 5, totalTokens: 10 },
        warnings: [],
        rawCall: { rawPrompt: null, rawSettings: {} },
      };
    },
    async doStream(options: any) {
      const promptText = JSON.stringify(options?.prompt ?? []);
      const wantsTools = promptText.includes('use the tools');
      const hasToolResults = promptText.includes('tool-result');

      let chunks: any[];
      if (wantsTools && !hasToolResults) {
        chunks = [
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: 'id-t', modelId: 'mock-model', timestamp: new Date(0) },
          {
            type: 'tool-call',
            toolCallId: 'call-add',
            toolName: 'add',
            input: JSON.stringify({ a: 2, b: 3 }),
            providerExecuted: false,
          },
          {
            type: 'tool-call',
            toolCallId: 'call-write',
            toolName: 'mastra_workspace_write_file',
            input: JSON.stringify({ path: 'result.txt', content: '5' }),
            providerExecuted: false,
          },
          { type: 'finish', finishReason: 'tool-calls', usage: { inputTokens: 5, outputTokens: 5, totalTokens: 10 } },
        ];
      } else {
        const reply = wantsTools ? 'tools:done' : promptText.includes('Zebra') ? 'recall:yes' : 'recall:no';
        chunks = [
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: 'id-0', modelId: 'mock-model', timestamp: new Date(0) },
          { type: 'text-start', id: 't1' },
          { type: 'text-delta', id: 't1', delta: reply },
          { type: 'text-end', id: 't1' },
          { type: 'finish', finishReason: 'stop', usage: { inputTokens: 5, outputTokens: 5, totalTokens: 10 } },
        ];
      }
      return {
        stream: simulateReadableStream({ chunks }),
        rawCall: { rawPrompt: null, rawSettings: {} },
      };
    },
  };
}

/**
 * Pass-through CUSTOM processor implementing all four span-producing phases. Exists purely
 * so the span test can assert custom processors trace in the durable path exactly like the
 * non-durable one: `input processor` (preparation), `input step processor` + `output step
 * processor` (per LLM step, on the worker), `output processor` (finish, on the worker).
 */
export const customProbeProcessor: any = {
  id: 'custom-probe',
  processInput: async ({ messages }: any) => messages,
  processInputStep: async () => undefined,
  processOutputStep: async ({ messages }: any) => messages,
  processOutputResult: async ({ messages }: any) => messages,
};

/** Trivial deterministic tool so the durable path exercises a real tool_call span. */
const addTool = createTool({
  id: 'add',
  description: 'Add two numbers and return the sum.',
  inputSchema: z.object({ a: z.number(), b: z.number() }),
  outputSchema: z.object({ sum: z.number() }),
  execute: async (input: any) => ({ sum: (input?.a ?? 0) + (input?.b ?? 0) }),
});

export function buildXprocTestAgent({
  dbUrl,
  agentId,
  inngestPort,
}: {
  dbUrl: string;
  agentId: string;
  inngestPort: number;
}) {
  const inngest = new Inngest({ id: 'message-persistence-test', baseUrl: `http://localhost:${inngestPort}` });

  const storage = new DefaultStorage({ id: `msg-persist-${agentId}`, url: dbUrl });

  // Full agent surface so the span test covers every durable span source: a regular
  // tool (tool_call), a workspace (workspace-instructions step processor + the
  // mastra_workspace_* tools and their WORKSPACE_ACTION child spans), and an inline
  // skill (skills-processor step processor).
  const workspace = new Workspace({
    id: `ws-${agentId}`,
    name: 'Test Workspace',
    filesystem: new LocalFilesystem({ basePath: mkdtempSync(path.join(tmpdir(), 'msg-persist-ws-')) }),
  });

  // Trivial deterministic scorer so the scorer-execution test can assert the durable
  // engine runs configured scorers (fire-and-forget, scores persisted via storage).
  const probeScorer = createScorer({
    id: 'xproc-probe-scorer',
    name: 'xprocProbeScorer',
    description: 'Always scores 0.95 — presence of a persisted score proves execution.',
  }).generateScore(() => 0.95);

  const agent = new Agent({
    id: agentId,
    name: 'Message Persistence Agent',
    instructions: 'Reply briefly.',
    model: recallProbeModel(),
    scorers: { probe: { scorer: probeScorer } },
    // generateTitle exercises the cross-process thread-title path: the connect worker's
    // finish step must rebuild agent + memory and generate/persist the title.
    memory: new Memory({ storage, options: { generateTitle: true } }),
    tools: { add: addTool },
    inputProcessors: [customProbeProcessor],
    outputProcessors: [customProbeProcessor],
    workspace,
    skills: [
      createSkill({
        name: 'test-skill',
        description: 'A trivial skill so the skills-processor runs.',
        instructions: '# Test Skill\n\nNo-op.',
      }),
    ],
  });

  const durableAgent = createInngestAgent({ agent, inngest });
  const workflow = createInngestDurableAgenticWorkflow({ inngest });

  const mastra = new Mastra({
    storage,
    scorers: { xprocProbeScorer: probeScorer } as any,
    agents: { [agentId]: durableAgent } as any,
    workflows: { [workflow.id]: workflow } as any,
    // Storage-backed tracing so the span test can assert the durable span tree
    // (agent_run root, parented processor/memory spans) from the shared sqlite db.
    observability: new Observability({
      configs: { default: { serviceName: 'msg-persist-test', exporters: [new MastraStorageExporter()] } },
    }),
  });

  return { inngest, mastra, durableAgent, storage };
}
