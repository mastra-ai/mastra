import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Agent } from '@mastra/core/agent';
import { createScorer } from '@mastra/core/evals';
import { Mastra } from '@mastra/core/mastra';
import { LibSQLStore } from '@mastra/libsql';
import { Memory } from '@mastra/memory';

/**
 * Deterministic v2 mock model — no network/API key required.
 * Echoes whatever the agent last received as `user` content.
 */
export function createEchoModel() {
  return {
    specificationVersion: 'v2' as const,
    provider: 'mock',
    modelId: 'mock-echo',
    doGenerate: async ({ prompt }: any) => {
      const lastUser = [...prompt].reverse().find((m: any) => m.role === 'user');
      const text =
        typeof lastUser?.content === 'string'
          ? lastUser.content
          : (lastUser?.content?.find?.((p: any) => p.type === 'text')?.text ?? 'hello');
      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        finishReason: 'stop' as const,
        usage: { inputTokens: 5, outputTokens: 5, totalTokens: 10 },
        content: [{ type: 'text' as const, text: `echo:${text}` }],
        warnings: [],
      };
    },
    doStream: async ({ prompt }: any) => {
      const lastUser = [...prompt].reverse().find((m: any) => m.role === 'user');
      const text =
        typeof lastUser?.content === 'string'
          ? lastUser.content
          : (lastUser?.content?.find?.((p: any) => p.type === 'text')?.text ?? 'hello');
      const delta = `echo:${text}`;
      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: new ReadableStream({
          start(controller) {
            controller.enqueue({ type: 'stream-start', warnings: [] });
            controller.enqueue({
              type: 'response-metadata',
              id: 'r1',
              modelId: 'mock-echo',
              timestamp: new Date(0),
            });
            controller.enqueue({ type: 'text-start', id: 't1' });
            controller.enqueue({ type: 'text-delta', id: 't1', delta });
            controller.enqueue({ type: 'text-end', id: 't1' });
            controller.enqueue({
              type: 'finish',
              finishReason: 'stop',
              usage: { inputTokens: 5, outputTokens: 5, totalTokens: 10 },
            });
            controller.close();
          },
        }),
      };
    },
  };
}

/** Simple scorer: did the assistant output mention the substring in groundTruth? */
export const containsScorer = createScorer({
  id: 'contains',
  name: 'contains',
  description: 'Returns 1 if assistant output contains groundTruth substring, else 0',
}).generateScore(({ run }: any) => {
  const out = JSON.stringify(run?.output ?? '');
  const expected = String(run?.groundTruth ?? '');
  return out.includes(expected) ? 1 : 0;
});

export function makeTmpDb(prefix: string) {
  const dir = mkdtempSync(join(tmpdir(), `${prefix}-`));
  const url = `file:${join(dir, 'eval.db')}`;
  return {
    dir,
    url,
    cleanup: () => rmSync(dir, { recursive: true, force: true }),
  };
}

export type AgentBundle = {
  mastra: Mastra;
  agent: Agent;
  storage: LibSQLStore;
  cleanup: () => void;
};

/**
 * Build a Mastra app with a single agent backed by Memory + LibSQL storage.
 * Observational memory is enabled in thread scope — the configuration that
 * triggered the original "threadId is required" complaint.
 */
export function buildAgent(opts: { observationalMemory?: boolean } = {}): AgentBundle {
  const { url, cleanup } = makeTmpDb('evals-with-memory');
  const storage = new LibSQLStore({ id: `evals-with-memory-${Date.now()}`, url });

  const memory = new Memory({
    storage,
    options: {
      lastMessages: 10,
      workingMemory: { enabled: false },
      ...(opts.observationalMemory
        ? {
            observationalMemory: {
              enabled: true,
              scope: 'thread',
              observation: {
                model: createEchoModel() as any,
                messageTokens: 200,
                bufferTokens: false,
              },
            },
          }
        : {}),
    },
  });

  const agent = new Agent({
    id: 'echo-agent',
    name: 'echo-agent',
    instructions: 'Echo the user input.',
    model: createEchoModel() as any,
    memory,
  });

  const mastra = new Mastra({
    storage,
    agents: { 'echo-agent': agent },
    scorers: { contains: containsScorer as any },
  });
  // Touch the agent through Mastra so memory inherits storage as expected.
  void mastra.getAgent('echo-agent');

  return {
    mastra,
    agent,
    storage,
    cleanup: () => {
      try {
        cleanup();
      } catch {
        void 0;
      }
    },
  };
}
