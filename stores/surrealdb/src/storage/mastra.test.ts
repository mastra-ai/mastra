import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import { createMockModel } from '@mastra/core/test-utils/llm-mock';
import { createStep, createWorkflow } from '@mastra/core/workflows';
import { Memory } from '@mastra/memory';
import { afterAll, describe, expect, it } from 'vitest';
import { z } from 'zod';

import { testConfig } from './test-utils';
import { SurrealDBStore } from './index';

/** End-to-end: a Mastra app whose agent memory and workflow state live in SurrealDB. */
describe('SurrealDBStore with Mastra', () => {
  const storage = new SurrealDBStore(testConfig('mastra_e2e'));

  const approval = createStep({
    id: 'approval',
    inputSchema: z.object({ amount: z.number() }),
    outputSchema: z.object({ approved: z.boolean(), amount: z.number() }),
    resumeSchema: z.object({ approved: z.boolean() }),
    execute: async ({ inputData, resumeData, suspend }) => {
      if (!resumeData) return suspend({ reason: 'needs approval' });
      return { approved: resumeData.approved, amount: inputData.amount };
    },
  });
  const workflow = createWorkflow({
    id: 'approval-workflow',
    inputSchema: z.object({ amount: z.number() }),
    outputSchema: z.object({ approved: z.boolean(), amount: z.number() }),
  })
    .then(approval)
    .commit();

  const agent = new Agent({
    id: 'assistant',
    name: 'assistant',
    instructions: 'You are a helpful assistant.',
    model: createMockModel({ mockText: 'Nice to meet you, Alice!' }),
    memory: new Memory({ options: { lastMessages: 10, workingMemory: { enabled: true } } }),
  });

  const mastra = new Mastra({ storage, agents: { agent }, workflows: { workflow }, logger: false });

  afterAll(async () => {
    await storage.close();
  });

  it('persists agent conversations and working memory', async () => {
    const threadId = `thread-${Date.now()}`;
    const memory = { thread: threadId, resource: 'user-alice' };
    const assistant = mastra.getAgent('agent');

    await assistant.generate('Hi, my name is Alice', { memory });
    await assistant.generate('What is my name?', { memory });

    const agentMemory = (await assistant.getMemory())!;
    const thread = await agentMemory.getThreadById({ threadId });
    expect(thread?.resourceId).toBe('user-alice');

    const { messages } = await agentMemory.recall({ threadId, resourceId: 'user-alice' });
    expect(messages.filter(m => m.role === 'user')).toHaveLength(2);
    expect(messages.filter(m => m.role === 'assistant')).toHaveLength(2);

    await agentMemory.updateWorkingMemory({
      threadId,
      resourceId: 'user-alice',
      workingMemory: '# User\n- Name: Alice',
    });
    expect(await agentMemory.getWorkingMemory({ threadId, resourceId: 'user-alice' })).toContain('Alice');
  });

  it('suspends a workflow run and resumes it from storage', async () => {
    const run = await mastra.getWorkflow('workflow').createRun();
    const suspended = await run.start({ inputData: { amount: 42 } });
    expect(suspended.status).toBe('suspended');

    const persisted = await (await storage.getStore('workflows'))!.getWorkflowRunById({
      workflowName: 'approval-workflow',
      runId: run.runId,
    });
    expect((persisted?.snapshot as { status?: string }).status).toBe('suspended');

    const resumed = await run.resume({ step: 'approval', resumeData: { approved: true } });
    expect(resumed.status).toBe('success');
    if (resumed.status === 'success') expect(resumed.result).toEqual({ approved: true, amount: 42 });
  });
});
