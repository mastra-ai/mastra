import { createOpenAI } from '@ai-sdk/openai-v5';
import { stepCountIs } from '@internal/ai-sdk-v5';
import { it, expect } from 'vitest';
import { Agent } from '../../../../agent';
import { runLoopScenario, useLoopScenarioAimock, describeForAllEngines } from '../aimock-scenario';
import { SCENARIO_MODEL_ID } from '../types';

/**
 * Regression coverage for the background sub-agent tool-content bug, across
 * engines.
 *
 * When a sub-agent delegation (`agent-<name>` tool) is dispatched as a
 * background task, the agentic loop hands `toModelOutput` the placeholder
 * string ("Background task started...") instead of the sub-agent's
 * `agentOutputSchema` object. The sub-agent tool's `toModelOutput` read
 * `output.text`, which is undefined for that string, so the supervisor's
 * continuation request carried a `role: "tool"` message with null content —
 * rejected by providers (e.g. Anthropic) with a 500.
 *
 * The background manager runs in `mode: 'producer'` so the dispatched task
 * stays pending and the supervisor's continuation turn deterministically
 * carries the placeholder (the previously-buggy path). `startWorkers: false`
 * alone is not enough: dispatch lazily auto-starts execution workers
 * (#19339), and on durable/evented the continuation crosses pubsub hops, so
 * the fast-completing task would win the race and the real sub-agent output
 * would replace the placeholder before the second LLM call. Producer mode
 * never registers a local worker, matching the source test's
 * "workers intentionally NOT started" condition on every engine.
 *
 * Ported from packages/core/src/agent/__tests__/subagent-background-tool-content.test.ts
 * to the cross-engine scenario matrix.
 */

const SUB_AGENT_INSTRUCTIONS = 'Say hello.';

/** Tool-message contents for a given delegation call id across all captured requests. */
function toolResultContentsFor(requests: Array<{ body?: { messages?: unknown[] } }>, toolCallId: string): unknown[] {
  return requests
    .flatMap(request => request?.body?.messages ?? [])
    .filter(
      (message): message is { role: string; tool_call_id?: string; content?: unknown } =>
        (message as { role?: string })?.role === 'tool' &&
        (message as { tool_call_id?: string })?.tool_call_id === toolCallId,
    )
    .map(message => message.content);
}

describeForAllEngines('AIMock loop scenario: sub-agent background dispatch tool content', engine => {
  const getMock = useLoopScenarioAimock();

  function makeSubAgent(mockUrl: string) {
    const openai = createOpenAI({
      apiKey: 'aimock-test-key',
      baseURL: `${mockUrl.replace(/\/+$/, '')}/v1`,
    });
    return new Agent({
      id: 'helper',
      name: 'helper',
      description: 'A helper sub-agent.',
      instructions: SUB_AGENT_INSTRUCTIONS,
      model: openai(SCENARIO_MODEL_ID),
    });
  }

  function scenarioFixtures(llm: any) {
    // AIMock matches fixtures in registration order (first match wins), so the
    // sub-agent's fixture must come first: the supervisor's turn-1 matcher
    // below (`hasToolResult: false`) would otherwise also match the
    // sub-agent's request and feed it the delegation tool call.
    llm.on({ endpoint: 'chat', systemMessage: SUB_AGENT_INSTRUCTIONS }, { content: 'Hello from the sub-agent.' });
    // Supervisor turn 1: delegate to the helper.
    llm.on(
      { endpoint: 'chat', hasToolResult: false },
      { toolCalls: [{ id: 'call-1', name: 'agent-helper', arguments: { prompt: 'hi' } }] },
    );
    // Supervisor turn 2: the continuation that previously failed with null
    // tool content when the delegation was backgrounded.
    llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'done' });
  }

  it('sends non-empty tool content (the placeholder) for a backgrounded sub-agent delegation', async () => {
    const mock = getMock();

    const { requests } = await runLoopScenario({
      engine,
      llm: mock,
      prompt: 'Please delegate.',
      instructions: 'Delegate to the helper sub-agent.',
      agents: { helper: makeSubAgent(mock.url) },
      // Opt the delegation into background dispatch — this is what produces
      // the placeholder result.
      agentBackgroundTasks: { tools: { helper: { enabled: true } } },
      // Producer mode: the task is persisted and the placeholder returned, but
      // no local worker ever executes it — keeps the dispatched task pending so
      // the continuation deterministically carries the placeholder (see
      // docblock; startWorkers: false alone loses the race on durable/evented).
      backgroundTasks: { enabled: true, mode: 'producer' },
      startWorkers: false,
      stopWhen: stepCountIs(3),
      fixtures: scenarioFixtures,
    });

    const values = toolResultContentsFor(requests as any, 'call-1');
    expect(values.length).toBeGreaterThan(0);
    for (const value of values) {
      // Before the fix this was undefined/null (toModelOutput read the absent
      // `.text`), serializing to a null tool-message content the provider
      // rejects with a 500.
      expect(typeof value).toBe('string');
      expect(value).toContain('Background task started');
    }
  });

  it('runs the sub-agent inline (real content) when not opted into background', async () => {
    const mock = getMock();

    const { requests } = await runLoopScenario({
      engine,
      llm: mock,
      prompt: 'Please delegate.',
      instructions: 'Delegate to the helper sub-agent.',
      agents: { helper: makeSubAgent(mock.url) },
      // No background opt-in: the delegation runs inline and returns the real answer.
      stopWhen: stepCountIs(3),
      fixtures: scenarioFixtures,
    });

    const values = toolResultContentsFor(requests as any, 'call-1');
    expect(values.length).toBeGreaterThan(0);
    for (const value of values) {
      expect(value).toContain('Hello from the sub-agent.');
    }
  });
});
