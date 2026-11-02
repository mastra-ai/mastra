/**
 * AIMock Scenario: request context on approval resume.
 *
 * A run suspends on a tool that needs approval. The caller that approves it
 * passes its own request context, which is what the approved tool must see
 * (#25960), including tools an input processor added (#27544). Agents that
 * pick their memory from the request context must still resume against the
 * conversation the run suspended in.
 */

import { stepCountIs } from '@internal/ai-sdk-v5';
import { describe, it, expect } from 'vitest';
import { z } from 'zod/v4';
import type { MastraDBMessage } from '../../../../agent/message-list';
import type { MastraMemory } from '../../../../memory';
import { MockMemory } from '../../../../memory/mock';
import type { Processor } from '../../../../processors';
import { RequestContext } from '../../../../request-context';
import { InMemoryStore } from '../../../../storage';
import { createTool } from '../../../../tools';
import type { ChunkType } from '../../../../stream/types';
import { createSharedAgent, describeForAllEngines, runLoopScenario, useLoopScenarioAimock } from '../aimock-scenario';

const threadId = 'tenant-thread';
const resourceId = 'tenant-resource';
const memoryOption = { thread: threadId, resource: resourceId };
const historyText = (i: number) => `history turn ${i}: tenant a asked about invoice ${1000 + i}`;

function contextWith(key: string, value: string) {
  const requestContext = new RequestContext();
  requestContext.set(key, value);
  return requestContext;
}

async function drainText(stream: { fullStream: AsyncIterable<ChunkType> }) {
  let text = '';
  for await (const chunk of stream.fullStream) {
    if (chunk.type === 'text-delta') text += chunk.payload.text;
  }
  return text;
}

async function storedTexts(storage: InMemoryStore) {
  const memory = (await storage.getStore('memory'))!;
  const { messages } = await memory.listMessages({ threadId, perPage: false });
  return messages.flatMap(m => m.content.parts.flatMap(p => (p.type === 'text' ? [p.text] : [])));
}

describeForAllEngines('AIMock loop scenario: request context on approval resume', engine => {
  const getMock = useLoopScenarioAimock();

  const scriptToolThenDone = (toolName: string) => (llm: ReturnType<typeof getMock>) => {
    llm.on(
      { endpoint: 'chat', hasToolResult: false },
      { toolCalls: [{ id: 'call-1', name: toolName, arguments: {} }] },
    );
    llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'done' });
  };

  async function suspendOnApproval(
    shared: Awaited<ReturnType<typeof createSharedAgent>>,
    toolName: string,
    extra: { requestContext: RequestContext; memory?: MastraMemory; outputProcessors?: Processor[] },
  ) {
    const { output, chunks } = await runLoopScenario({
      engine,
      llm: getMock(),
      sharedAgent: shared,
      prompt: 'Look it up',
      requestContext: extra.requestContext,
      ...(extra.outputProcessors ? { outputProcessors: extra.outputProcessors } : {}),
      ...(extra.memory ? { memory: extra.memory, threadId, resourceId } : {}),
      stopWhen: stepCountIs(5),
      collectChunks: true,
      fixtures: scriptToolThenDone(toolName),
    });
    const approval = chunks!.find(c => c.type === 'tool-call-approval');
    expect(approval?.payload).toMatchObject({ toolCallId: 'call-1', toolName });
    return { runId: output.runId, toolCallId: 'call-1' };
  }

  describe('the approved tool', () => {
    function whoamiTool(seen: unknown[]) {
      return createTool({
        id: 'whoami',
        description: 'Reports the caller',
        inputSchema: z.object({}),
        requireApproval: true,
        execute: async (_input, context) => {
          seen.push(context?.requestContext?.get('who'));
          return { ok: true };
        },
      });
    }

    it('runs with the request context passed to approveToolCall, not the one the run suspended with', async () => {
      const seen: unknown[] = [];
      const shared = await createSharedAgent(getMock(), { engine, tools: { whoami: whoamiTool(seen) } });
      const run = await suspendOnApproval(shared, 'whoami', { requestContext: contextWith('who', 'first') });
      expect(seen).toEqual([]);

      const text = await drainText(
        await shared.agent.approveToolCall({ ...run, requestContext: contextWith('who', 'second') }),
      );

      expect(text).toBe('done');
      expect(seen).toEqual(['second']);
      const requests = getMock().getRequests();
      expect(requests).toHaveLength(2);
      expect(requests[1]!.body!.messages.at(-1)).toMatchObject({ role: 'tool', content: JSON.stringify({ ok: true }) });
    });

    it('is the replacement an input processor put in place of the configured tool', async () => {
      const seen: unknown[] = [];
      const replaceWhoami: Processor = {
        id: 'replace-whoami',
        processInputStep: ({ tools }) => ({
          tools: {
            ...(tools ?? {}),
            whoami: createTool({
              id: 'whoami',
              description: 'Reports the caller (replaced)',
              inputSchema: z.object({}),
              requireApproval: true,
              execute: async () => {
                seen.push('replacement');
                return { ok: true };
              },
            }),
          },
        }),
      };
      const shared = await createSharedAgent(getMock(), {
        engine,
        tools: { whoami: whoamiTool(seen) },
        inputProcessors: [replaceWhoami],
      });
      const run = await suspendOnApproval(shared, 'whoami', { requestContext: contextWith('who', 'first') });

      const text = await drainText(
        await shared.agent.approveToolCall({ ...run, requestContext: contextWith('who', 'second') }),
      );

      expect(text).toBe('done');
      expect(seen).toEqual(['replacement']);
    });

    async function approveProcessorAddedTool() {
      const seen: unknown[] = [];
      const addTool: Processor = {
        id: 'add-whoami',
        processInputStep: ({ tools }) => ({ tools: { ...(tools ?? {}), whoami: whoamiTool(seen) } }),
      };
      const shared = await createSharedAgent(getMock(), { engine, inputProcessors: [addTool] });
      const run = await suspendOnApproval(shared, 'whoami', { requestContext: contextWith('who', 'first') });
      const text = await drainText(
        await shared.agent.approveToolCall({ ...run, requestContext: contextWith('who', 'second') }),
      );
      return { seen, text };
    }

    it('can be a tool only an input processor added', async () => {
      const { seen, text } = await approveProcessorAddedTool();

      expect(text).toBe('done');
      expect(seen).toHaveLength(1);
    });

    it('a tool only an input processor added sees the request context passed to approveToolCall', async () => {
      const { seen } = await approveProcessorAddedTool();

      expect(seen).toEqual(['second']);
    });

    // The normal and fs loops do not run output processors on a resumed tool result.
    it.skipIf(engine === 'normal' || engine === 'fs')(
      'output processors see the request context passed to approveToolCall on the approved tool result',
      async () => {
        const seen = new Set<unknown>();
        const recordWho: Processor = {
          id: 'record-who',
          // The approved tool's result is processed by the resumed run. The
          // original stream stays subscribed with its own context, so other
          // parts would mix both callers' contexts.
          processOutputStream: async ({ part, requestContext }) => {
            if (part.type === 'tool-result') seen.add(requestContext?.get('who'));
            return part;
          },
        };
        const shared = await createSharedAgent(getMock(), { engine, tools: { whoami: whoamiTool([]) } });
        const run = await suspendOnApproval(shared, 'whoami', {
          requestContext: contextWith('who', 'first'),
          outputProcessors: [recordWho],
        });
        seen.clear();

        const text = await drainText(
          await shared.agent.approveToolCall({ ...run, requestContext: contextWith('who', 'second') }),
        );

        expect(text).toBe('done');
        expect([...seen]).toEqual(['second']);
      },
    );
  });

  describe('memory chosen from the request context', () => {
    // Tenant 'a' gets its own store; any other caller gets the shared store.
    async function setupTenantMemory() {
      const tenantStore = new InMemoryStore();
      const sharedStore = new InMemoryStore();
      const tenantMemory = new MockMemory({ storage: tenantStore, options: { lastMessages: 20 } });
      const sharedMemory = new MockMemory({ storage: sharedStore, options: { lastMessages: 20 } });
      await tenantMemory.createThread({ threadId, resourceId });
      const history: MastraDBMessage[] = Array.from({ length: 4 }, (_, i) => ({
        id: `history-${i}`,
        threadId,
        resourceId,
        role: i % 2 === 0 ? 'user' : 'assistant',
        createdAt: new Date(1_000 + i * 1_000),
        content: { format: 2, parts: [{ type: 'text', text: historyText(i) }] },
      }));
      await tenantMemory.saveMessages({ messages: history });

      const lookup = createTool({
        id: 'lookup',
        description: 'Looks something up',
        inputSchema: z.object({}),
        requireApproval: true,
        execute: async () => ({ found: true }),
      });
      const shared = await createSharedAgent(getMock(), {
        engine,
        tools: { lookup },
        // The harness types `memory` as an instance; Agent also accepts a function of the request context.
        memory: (({ requestContext }: { requestContext: RequestContext }) =>
          requestContext.get('tenant') === 'a' ? tenantMemory : sharedMemory) as unknown as MastraMemory,
      });
      const run = await suspendOnApproval(shared, 'lookup', {
        requestContext: contextWith('tenant', 'a'),
        memory: tenantMemory,
      });
      return { shared, run, tenantStore, sharedStore };
    }

    const expectHistoryInResumedRequest = () => {
      const requests = getMock().getRequests();
      expect(requests).toHaveLength(2);
      const sent = JSON.stringify(requests[1]!.body!.messages);
      for (let i = 0; i < 4; i++) expect(sent).toContain(historyText(i));
    };

    it('resumes against the tenant conversation when approved with the same request context', async () => {
      const { shared, run, tenantStore, sharedStore } = await setupTenantMemory();

      const text = await drainText(
        await shared.agent.approveToolCall({
          ...run,
          memory: memoryOption,
          requestContext: contextWith('tenant', 'a'),
        }),
      );

      expect(text).toBe('done');
      expectHistoryInResumedRequest();
      expect(await storedTexts(tenantStore)).toContain('done');
      expect(await storedTexts(sharedStore)).toEqual([]);
    });

    it('still sends the recalled conversation when the approval omits the request context that chose memory', async () => {
      const { shared, run } = await setupTenantMemory();

      const text = await drainText(await shared.agent.approveToolCall({ ...run, memory: memoryOption }));

      expect(text).toBe('done');
      expectHistoryInResumedRequest();
    });
  });
});
