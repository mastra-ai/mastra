import { createOpenAI } from '@ai-sdk/openai-v5';
import { LLMock } from '@copilotkit/aimock';
import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import { InMemoryStore } from '@mastra/core/storage';
import { createTool } from '@mastra/core/tools';
import { Inngest } from 'inngest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { createInngestAgent } from '../../durable-agent';
import { createInngestDurableAgenticWorkflow } from '../../durable-agent/create-inngest-agentic-workflow';
import { InngestWorkflow } from '../../workflow';

// This package-boundary regression needs no Inngest dev server (#27898).
// Only durable step delivery and realtime transport are replaced: the real
// agent workflow, nested engines, tools, snapshot persistence and listing run.
afterEach(() => vi.restoreAllMocks());

describe('Inngest approval lifecycle agrees with suspended-run listing', () => {
  it.each(['approval', 'finish'])('has the correct listing when %s reaches the subscriber', async phase => {
    const llm = new LLMock({ port: 0 });
    await llm.start();
    const storage = new InMemoryStore();
    try {
      llm.on(
        { endpoint: 'chat', hasToolResult: false },
        { toolCalls: [{ id: 'call_lookup', name: 'lookup_status', arguments: { query: 'alpha' } }] },
      );
      llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'Status is OK.' });
      let executions = 0;
      const agent = new Agent({
        id: 'listing-agent',
        name: 'Listing agent',
        instructions: 'Look up the status, then report it.',
        model: createOpenAI({ apiKey: 'test', baseURL: `${llm.url}/v1` }).chat('gpt-4o-mini'),
        tools: {
          lookup_status: createTool({
            id: 'lookup_status',
            description: 'Look up a status.',
            inputSchema: z.object({ query: z.string() }),
            requireApproval: true,
            execute: async ({ query }) => {
              executions++;
              return { status: `OK:${query}` };
            },
          }),
        },
      });
      const inngest = new Inngest({ id: 'approval-listing-test', isDev: true });
      // Preserve the real function objects; only bypass Inngest's delivery.
      const handlers = new Map<string, Parameters<Inngest['createFunction']>[1]>();
      const createFunction = inngest.createFunction.bind(inngest);
      vi.spyOn(inngest, 'createFunction').mockImplementation((config, handler) => {
        const fn = createFunction(config, handler);
        handlers.set(config.id, handler);
        return fn;
      });
      const durable = createInngestAgent({ agent, inngest });
      const workflow = createInngestDurableAgenticWorkflow({ inngest });
      const mastra = new Mastra({ logger: false, storage, agents: { agent }, workflows: { loop: workflow } });
      durable.__setMastra(mastra);
      workflow.__registerMastra(mastra);
      if (!(workflow instanceof InngestWorkflow)) throw new Error('Expected an Inngest workflow');
      workflow.getFunction();
      const observed: { phase: string; listed: boolean }[] = [];
      const streamEvent = z.object({ type: z.string(), data: z.object({ type: z.string().optional() }).passthrough() });
      vi.spyOn(inngest.realtime, 'publish').mockImplementation(async (topic, data) => {
        if (topic.topic !== 'agent-stream') return;
        const event = streamEvent.parse(data);
        const currentPhase = event.data.type === 'tool-call-approval' ? 'approval' : event.type;
        if (currentPhase === 'approval' || currentPhase === 'finish') {
          const { runs } = await agent.listSuspendedRuns();
          observed.push({ phase: currentPhase, listed: runs.some(run => run.runId === runId) });
        }
      });
      // JSON round trips match durable transport rather than sharing references.
      const json = (value: unknown): unknown => JSON.parse(JSON.stringify(value));
      const dispatch = async (id: string, data: unknown): Promise<unknown> => {
        const handler = handlers.get(id);
        if (!handler) throw new Error(`Missing function ${id}`);
        // The SDK supplies a much larger context; these are the only transport
        // capabilities used by these real workflow handlers.
        return handler({ event: { data: json(data) }, step, attempt: 0 } as Parameters<typeof handler>[0]);
      };
      const step = {
        run: async (_id: string, callback: () => Promise<unknown>) => {
          const value = await callback();
          return value === undefined ? undefined : json(value);
        },
        invoke: async (_id: string, invocation: { function: ReturnType<Inngest['createFunction']>; data: unknown }) =>
          dispatch(invocation.function.id(), invocation.data),
        sendEvent: async () => ({ ids: [] }),
      };
      const { runId, workflowInput } = await durable.prepare('Look up alpha', { maxSteps: 5 });
      const outcome = z.object({ result: z.object({ status: z.string() }) });
      expect(
        outcome.parse(await dispatch(`workflow.${workflow.id}`, { runId, inputData: workflowInput })).result.status,
      ).toBe('suspended');
      expect(executions).toBe(0);
      const workflowsStore = await storage.getStore('workflows');
      if (!workflowsStore) throw new Error('Workflow store missing');
      const snapshot = await workflowsStore.loadWorkflowSnapshot({ workflowName: workflow.id, runId });
      if (!snapshot) throw new Error('Suspended snapshot missing');
      const [outerStep] = Object.keys(snapshot.suspendedPaths);
      if (!outerStep) throw new Error('Suspended step missing');
      const { suspendPayload } = z
        .object({
          suspendPayload: z.object({ __workflow_meta: z.object({ path: z.array(z.string()) }) }),
        })
        .parse(snapshot.context[outerStep]);
      const path = suspendPayload.__workflow_meta.path;
      const resume = {
        steps: [outerStep, ...path],
        resumePayload: { approved: true },
        resumePath: snapshot.suspendedPaths[outerStep],
      };
      expect(
        outcome.parse(await dispatch(`workflow.${workflow.id}`, { runId, inputData: { approved: true }, resume }))
          .result.status,
      ).toBe('success');
      expect(executions).toBe(1);
      expect(observed.filter(event => event.phase === phase)).toEqual([{ phase, listed: phase === 'approval' }]);
      expect((await agent.listSuspendedRuns()).runs).toEqual([]);
    } finally {
      await llm.stop();
      await storage.close();
    }
  });
});
