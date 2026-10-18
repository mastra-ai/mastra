import { createOpenAI } from '@ai-sdk/openai-v5';
import { stepCountIs } from '@internal/ai-sdk-v5';
import { it, expect } from 'vitest';
import { Agent } from '../../../../agent';
import { MockMemory } from '../../../../memory/mock';
import { runLoopScenario, useLoopScenarioAimock, describeForAllEngines } from '../aimock-scenario';
import { SCENARIO_MODEL_ID } from '../types';

/**
 * Regression class: delegated sub-agent memory identity (issue #23903).
 *
 * When a supervisor running with `memory: { thread, resource }` delegates to a
 * sub-agent that has its own memory, the sub-agent's conversation must be
 * stored under an identity derived from the caller — resource
 * `${callerResource}-${agentName}` and a thread prefixed by the caller's
 * thread — rather than a parent-derived constant shared by every caller.
 */
describeForAllEngines('AIMock loop scenario: delegation memory identity', engine => {
  const getMock = useLoopScenarioAimock();

  it('stores the sub-agent conversation under a caller-derived thread and resource', async () => {
    const mock = getMock();

    const openai = createOpenAI({
      apiKey: 'aimock-test-key',
      baseURL: `${mock.url.replace(/\/+$/, '')}/v1`,
    });

    const researcherMemory = new MockMemory();
    const researcher = new Agent({
      id: 'researcher',
      name: 'Researcher',
      description: 'Researches topics',
      instructions: 'You are a researcher.',
      model: openai(SCENARIO_MODEL_ID),
      memory: researcherMemory,
    });

    const { output } = await runLoopScenario({
      engine,
      llm: mock,
      prompt: 'Research dolphins',
      agents: { researcher },
      memory: new MockMemory(),
      threadId: 'thread-1',
      resourceId: 'user-1',
      stopWhen: stepCountIs(5),
      fixtures: llm => {
        llm.on(
          { endpoint: 'chat', systemMessage: 'You are a researcher.' },
          { content: 'Dolphins are marine mammals.' },
        );
        llm.on(
          { endpoint: 'chat', hasToolResult: false },
          {
            toolCalls: [
              { id: 'call_researcher', name: 'agent-researcher', arguments: { prompt: 'Research dolphins.' } },
            ],
          },
        );
        llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'The researcher reported back.' });
      },
    });

    expect(await output.text).toContain('researcher reported back');

    const { threads } = await researcherMemory.listThreads({ perPage: false });
    expect(threads).toHaveLength(1);
    expect(threads[0]!.resourceId).toBe('user-1-researcher');
    expect(threads[0]!.id).toMatch(/^thread-1-/);

    const { messages } = await researcherMemory.recall({ threadId: threads[0]!.id, resourceId: 'user-1-researcher' });
    expect(JSON.stringify(messages)).toContain('Dolphins are marine mammals.');
  });
});
