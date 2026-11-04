import { Mastra } from '@mastra/core/mastra';
import { MockStore } from '@mastra/core/storage';
import { createStep, createWorkflow } from '@mastra/core/workflows';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { LIST_AGENT_BUILDER_ACTIONS_ROUTE, STREAM_AGENT_BUILDER_ACTION_ROUTE } from './agent-builder';
import { createTestServerContext } from './test-utils';

// The real agent-builder workflows need a model to finish a step, so this stands in a workflow that
// waits on a gate. That keeps a run in flight while another Mastra instance makes a request.
const gate = vi.hoisted(() => {
  let open!: () => void;
  const opened = new Promise<void>(resolve => (open = resolve));
  return { opened, open: () => open() };
});

vi.mock('@mastra/agent-builder', () => ({
  createAgentBuilderWorkflows: () => {
    const step = createStep({
      id: 'gated-step',
      inputSchema: z.object({}),
      outputSchema: z.object({}),
      execute: async () => {
        await gate.opened;
        return {};
      },
    });
    return {
      gated: createWorkflow({ id: 'gated', inputSchema: z.object({}), outputSchema: z.object({}), steps: [step] })
        .then(step)
        .commit(),
    };
  },
}));

async function loadSnapshot(mastra: Mastra, runId: string) {
  const store = await mastra.getStorage()!.getStore('workflows');
  return store!.loadWorkflowSnapshot({ workflowName: 'gated', runId });
}

describe('agent-builder routes with several Mastra instances', () => {
  it("keeps a streamed run on its own instance's storage when another instance makes a request", async () => {
    const a = new Mastra({ logger: false, storage: new MockStore() });
    const b = new Mastra({ logger: false, storage: new MockStore() });

    const stream = (await STREAM_AGENT_BUILDER_ACTION_ROUTE.handler({
      ...createTestServerContext({ mastra: a }),
      actionId: 'gated',
      runId: 'run-a',
      inputData: {},
    } as any)) as ReadableStream;

    await LIST_AGENT_BUILDER_ACTIONS_ROUTE.handler(createTestServerContext({ mastra: b }) as any);
    gate.open();
    const reader = stream.getReader();
    while (!(await reader.read()).done) {}

    expect((await loadSnapshot(a, 'run-a'))?.status).toBe('success');
    expect(await loadSnapshot(b, 'run-a')).toBeNull();
  });
});
