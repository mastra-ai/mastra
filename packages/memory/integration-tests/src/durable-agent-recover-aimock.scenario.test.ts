/** T4 durable-recover (COR-1493): real HTTP model, memory and storage, without provider credentials. */
import { randomUUID } from 'node:crypto';
import { createOpenAI } from '@ai-sdk/openai-v5';
import { LLMock } from '@copilotkit/aimock';
import { LibSQLStore } from '@mastra/libsql';
import { Memory } from '@mastra/memory';
import { describe, expect, it, onTestFinished, vi } from 'vitest';
import { z } from 'zod';

const AMOUNT = 42;

describe('T4 durable-recover checkpoint availability (COR-1493)', () => {
  it.each(['off', 'auto'] as const)(
    'handles a mid-tool interruption with recovery %s',
    async policy => {
      const llm = new LLMock({ port: 0 });
      await llm.start();
      onTestFinished(() => llm.stop());
      llm.on(
        { endpoint: 'chat', hasToolResult: false },
        {
          toolCalls: [
            {
              id: 'call_record',
              name: 'fetchRecord',
              arguments: { name: 'comparison', _background: { disposition: 'foreground' } },
            },
          ],
        },
      );
      llm.on({ endpoint: 'chat', hasToolResult: true }, { content: `The amount is ${AMOUNT}.` });
      const storage = new LibSQLStore({ id: randomUUID(), url: ':memory:' });
      onTestFinished(() => storage.close());
      const memory = new Memory({
        storage,
        options: { lastMessages: 40, semanticRecall: false, generateTitle: false },
      });
      const agentId = randomUUID();
      const runId = randomUUID();
      const thread = randomUUID();
      const resource = randomUUID();
      const entered = Promise.withResolvers<void>();
      const release = Promise.withResolvers<void>();
      const loadGraph = async () => {
        const [agent, durable, mastra, tools] = await Promise.all([
          import('@mastra/core/agent'),
          import('@mastra/core/agent/durable'),
          import('@mastra/core/mastra'),
          import('@mastra/core/tools'),
        ]);
        return { ...agent, ...durable, ...mastra, ...tools };
      };
      const originalGraph = await loadGraph();
      const createRunner = (graph: typeof originalGraph, block: boolean) =>
        graph.createDurableAgent({
          agent: new graph.Agent({
            id: agentId,
            name: 'Recover record',
            instructions: 'Fetch the comparison record once, then report its amount.',
            model: createOpenAI({ apiKey: 'aimock-test-key', baseURL: `${llm.url}/v1` }).chat('gpt-4o'),
            memory,
            tools: {
              fetchRecord: graph.createTool({
                id: 'fetchRecord',
                description: 'Fetch a record.',
                inputSchema: z.object({ name: z.string() }),
                background: { enabled: true },
                execute: async ({ name }) => {
                  if (block) {
                    entered.resolve();
                    await release.promise;
                  }
                  return { name, amount: AMOUNT };
                },
              }),
            },
          }),
        });
      const original = createRunner(originalGraph, true);
      const originalMastra = new originalGraph.Mastra({
        agents: { original },
        storage,
        logger: false,
        recovery: { durableAgents: policy, workflows: 'off' },
      });
      onTestFinished(() => originalMastra.shutdown());
      let replacementMastra: InstanceType<typeof originalGraph.Mastra> | undefined;
      let recovered: Awaited<ReturnType<typeof original.recover>> | undefined;
      let drain: Promise<void> | undefined;
      let originalReader: ReadableStreamDefaultReader | undefined;
      let execution: Promise<unknown> | undefined;
      const messages = async () =>
        (await (await storage.getStore('memory'))!.listMessages({ threadId: thread, perPage: false })).messages;
      try {
        const stream = await original.stream('Fetch the comparison record and report its amount.', {
          runId,
          memory: { thread, resource },
        });
        originalReader = stream.fullStream.getReader();
        drain = (async () => {
          while (!(await originalReader!.read()).done) {
            // Consume the original subscription until it finishes or is detached below.
          }
        })();
        execution = originalGraph.getRunRegistryEntry(runId, originalMastra)!.workflowExecution;
        await entered.promise;
        const workflows = (await storage.getStore('workflows'))!;
        const snapshot = await workflows.loadWorkflowSnapshot({
          workflowName: originalGraph.DurableStepIds.AGENTIC_LOOP,
          runId,
        });
        if (policy === 'auto') {
          expect(snapshot).toMatchObject({
            status: 'running',
            context: { input: { __workflowKind: 'durable-agent', agentId } },
          });
        } else {
          expect(snapshot?.status).toBe('pending');
          expect(Object.hasOwn(snapshot!.context, 'input')).toBe(false);
        }
        // Simulate a dead module graph; the separate LibSQL SIGKILL test proves real process isolation.
        originalGraph.__resetExecutionFencesForTests();
        vi.resetModules();
        const replacementGraph = await loadGraph();
        const replacement = createRunner(replacementGraph, false);
        replacementMastra = new replacementGraph.Mastra({
          agents: { replacement },
          storage,
          logger: false,
          recovery: { durableAgents: policy, workflows: 'off' },
        });
        onTestFinished(() => replacementMastra!.shutdown());
        expect(replacementGraph.Mastra).not.toBe(originalGraph.Mastra);
        expect(replacementGraph.getRunRegistryEntry(runId, replacementMastra)).toBeUndefined();
        if (policy === 'off') {
          await expect(replacement.recover(runId, { force: true })).rejects.toMatchObject({
            id: 'DURABLE_AGENT_RECOVER_CHECKPOINT_NOT_AVAILABLE',
          });
          release.resolve();
          await execution;
          return;
        }
        recovered = await replacement.recover(runId, { force: true });
        const types: string[] = [];
        const recoveredDrain = (async () => {
          for await (const chunk of recovered!.fullStream) types.push(chunk.type);
        })();
        const [output] = await Promise.all([recovered.output.getFullOutput(), recoveredDrain]);
        expect(output.text).toContain(String(AMOUNT));
        expect(types).not.toContain('error');
        expect(types.filter(type => type === 'finish')).toHaveLength(1);
        const persisted = await messages();
        const invocations = persisted
          .flatMap(message => message.content.parts ?? [])
          .filter(part => part.type === 'tool-invocation' && part.toolInvocation.toolName === 'fetchRecord');
        expect(invocations).toHaveLength(1);
        for (const part of invocations)
          expect(part).toMatchObject({
            toolInvocation: { state: 'result', result: { name: 'comparison', amount: AMOUNT } },
          });
        const userMessages = persisted.filter(message => message.role === 'user');
        expect(userMessages).toHaveLength(1);
        expect(userMessages[0]!.content.parts).toMatchObject([
          { type: 'text', text: 'Fetch the comparison record and report its amount.' },
        ]);
        release.resolve();
        await execution;
        await originalReader?.cancel();
        await drain;
        expect(await messages()).toEqual(persisted);
      } finally {
        release.resolve();
        await Promise.allSettled([execution]);
        await Promise.allSettled([originalReader?.cancel()]);
        await Promise.allSettled([drain]);
        recovered?.cleanup();
      }
    },
    30_000,
  );
});
