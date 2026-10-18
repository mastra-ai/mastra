import { createOpenAI } from '@ai-sdk/openai-v5';
import { stepCountIs } from '@internal/ai-sdk-v5';
import { it, expect } from 'vitest';
import { Agent } from '../../../../agent';
import { runLoopScenario, useLoopScenarioAimock, describeForAllEngines } from '../aimock-scenario';
import { SCENARIO_MODEL_ID } from '../types';

/**
 * Concept: agents as tools (supervisor / subagent delegation).
 *
 * A subagent registered via `agents: { writer }` becomes a tool named
 * `agent-writer`. The supervisor calls it like any tool; the subagent runs its
 * own agentic loop and its text result is plumbed back as the tool result for
 * the supervisor's next turn. This pins the delegation contract end-to-end.
 */
describeForAllEngines('AIMock loop scenario: agents as tools', engine => {
  const getMock = useLoopScenarioAimock();

  it('delegates to a subagent and feeds its result back to the supervisor', async () => {
    const mock = getMock();

    // The subagent shares the same AIMock-backed provider as the supervisor.
    const openai = createOpenAI({
      apiKey: 'aimock-test-key',
      baseURL: `${mock.url.replace(/\/+$/, '')}/v1`,
    });

    const writer = new Agent({
      id: 'writer',
      name: 'Writer',
      description: 'Drafts written content',
      instructions: 'You are a skilled writer subagent.',
      model: openai(SCENARIO_MODEL_ID),
    });

    const { output, requests } = await runLoopScenario({
      engine,
      llm: mock,
      prompt: 'Ask the writer to draft a tagline.',
      agents: { writer },
      stopWhen: stepCountIs(5),
      fixtures: llm => {
        // Subagent's own loop turn: the writer drafts the tagline. Routed by its system prompt and
        // registered first so the supervisor's `hasToolResult: false` fixture cannot capture it.
        llm.on(
          { endpoint: 'chat', systemMessage: 'You are a skilled writer subagent.' },
          { content: 'Brewed fresh, served warm.' },
        );
        // Supervisor turn 1: delegate to the writer subagent. No tool result yet.
        llm.on(
          { endpoint: 'chat', hasToolResult: false },
          {
            toolCalls: [
              {
                id: 'call_writer',
                name: 'agent-writer',
                arguments: { prompt: 'Draft a tagline for a coffee shop.' },
              },
            ],
          },
        );
        // Supervisor turn 2: the subagent result comes back as a tool result;
        // the supervisor wraps up.
        llm.on(
          { endpoint: 'chat', toolCallId: 'call_writer', hasToolResult: true },
          { content: 'The writer suggested: Brewed fresh, served warm.' },
        );
      },
    });

    // The supervisor produced its final answer incorporating the subagent output.
    const text = await output.text;
    expect(text).toContain('Brewed fresh, served warm.');

    // The subagent tool result was plumbed back to the supervisor, keyed to the
    // original delegation call id.
    const supervisorFinalTurn = requests.at(-1)?.body?.messages ?? [];
    const toolMessage = supervisorFinalTurn.find(message => (message as { role?: string }).role === 'tool') as
      | { tool_call_id?: string; content?: unknown }
      | undefined;
    expect(toolMessage?.tool_call_id).toBe('call_writer');
    expect(JSON.stringify(toolMessage?.content)).toContain('Brewed fresh, served warm.');

    // Exactly 3 requests reached AIMock: supervisor delegate, subagent draft,
    // supervisor finalize — no misrouted turns.
    expect(requests).toHaveLength(3);
    expect(JSON.stringify(requests.map(r => r.body?.messages))).not.toContain('not found');
  });
});
