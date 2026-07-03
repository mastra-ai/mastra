import { createOpenAI } from '@ai-sdk/openai-v5';
import { stepCountIs } from '@internal/ai-sdk-v5';
import { it, expect, vi } from 'vitest';
import { Agent } from '../../../../agent';
import type { DelegationCompleteContext } from '../../../../agent';
import { runLoopScenario, useLoopScenarioAimock, describeForAllEngines } from '../aimock-scenario';
import { SCENARIO_MODEL_ID } from '../types';

/**
 * Regression class: supervisor delegation hooks — onDelegationComplete with bail().
 *
 * When a supervisor delegates to a subagent and the delegation completes, the
 * `onDelegationComplete` callback receives the result and can optionally call
 * `bail()` to stop the supervisor loop. This scenario proves:
 *
 * 1. The `onDelegationComplete` callback is called after delegation completes.
 * 2. The callback receives the delegation context (primitiveId, result, success).
 * 3. Calling `context.bail()` stops the supervisor loop.
 * 4. The loop does not continue to additional delegations after bail().
 */
describeForAllEngines('AIMock loop scenario: onDelegationComplete bail()', engine => {
  const getMock = useLoopScenarioAimock();

  it('onDelegationComplete receives result context when subagent succeeds', async () => {
    const mock = getMock();
    const completeSpy = vi.fn();

    const openai = createOpenAI({
      apiKey: 'aimock-test-key',
      baseURL: `${mock.url.replace(/\/+$/, '')}/v1`,
    });

    const writer = new Agent({
      id: 'writer',
      name: 'Writer',
      description: 'Drafts written content',
      instructions: 'You are a writer.',
      model: openai(SCENARIO_MODEL_ID),
    });

    const { output } = await runLoopScenario({
      engine,
      llm: mock,
      prompt: 'Ask the writer to draft something.',
      agents: { writer },
      stopWhen: stepCountIs(5),
      delegation: {
        onDelegationComplete: (context: DelegationCompleteContext) => {
          completeSpy(context);
          return undefined;
        },
      },
      fixtures: llm => {
        // Supervisor turn 1: delegate to writer.
        llm.on(
          { endpoint: 'chat', hasToolResult: false },
          {
            toolCalls: [{ id: 'call_writer', name: 'agent-writer', arguments: { prompt: 'Write something.' } }],
          },
        );
        // Subagent turn: receives the delegation and responds.
        llm.on(
          { endpoint: 'chat', hasToolResult: false, sequenceIndex: 1 },
          { content: 'Here is what you requested.' },
        );
        // Supervisor turn 2: wraps up.
        llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'Writer completed the task.' });
      },
    });

    // The onDelegationComplete callback was called.
    expect(completeSpy).toHaveBeenCalled();
    const completeContext = completeSpy.mock.calls[0]![0];
    expect(completeContext.primitiveId).toBe('writer');
    expect(completeContext.primitiveType).toBe('agent');
    expect(completeContext.success).toBe(true);
    expect(completeContext.result).toBeDefined();

    // The loop completed successfully
    const text = await output.text;
    expect(text).toContain('Writer completed');
  });

  it('bail() stops the supervisor loop from continuing to additional delegations', async () => {
    const mock = getMock();
    let bailCalled = false;
    let additionalDelegations = 0;

    const openai = createOpenAI({
      apiKey: 'aimock-test-key',
      baseURL: `${mock.url.replace(/\/+$/, '')}/v1`,
    });

    const agent1 = new Agent({
      id: 'agent1',
      name: 'Agent 1',
      description: 'First agent',
      instructions: 'You are agent 1.',
      model: openai(SCENARIO_MODEL_ID),
    });

    const agent2 = new Agent({
      id: 'agent2',
      name: 'Agent 2',
      description: 'Second agent',
      instructions: 'You are agent 2.',
      model: openai(SCENARIO_MODEL_ID),
    });

    const { requests } = await runLoopScenario({
      engine,
      llm: mock,
      prompt: 'Ask agent1, then agent2.',
      agents: { agent1, agent2 },
      stopWhen: stepCountIs(10),
      delegation: {
        onDelegationComplete: (context: DelegationCompleteContext) => {
          if (context.primitiveId === 'agent1') {
            bailCalled = true;
            context.bail();
            return { feedback: 'Stopping after agent1 completes.' };
          }
          // Track if we reach agent2 after bail
          if (context.primitiveId === 'agent2') {
            additionalDelegations++;
          }
          return undefined;
        },
      },
      fixtures: llm => {
        // Supervisor turn 1: delegate to agent1.
        llm.on(
          { endpoint: 'chat', hasToolResult: false },
          {
            toolCalls: [{ id: 'call_agent1', name: 'agent-agent1', arguments: { prompt: 'Task 1' } }],
          },
        );
        // Agent1 turn: completes successfully.
        llm.on({ endpoint: 'chat', hasToolResult: false, sequenceIndex: 1 }, { content: 'Agent1 completed task 1.' });
        // Supervisor would normally delegate to agent2 next, but bail() should prevent it.
        // We don't script agent2 because bail() should stop the loop.
      },
    });

    // Bail was called when agent1 completed
    expect(bailCalled).toBe(true);

    // Agent2 should NOT have been called after bail
    expect(additionalDelegations).toBe(0);

    // Verify no request was made to agent2
    const agent2Requests = requests.filter((r: any) => JSON.stringify(r.body?.messages).includes('agent-agent2'));
    expect(agent2Requests.length).toBe(0);

    // Bail should stop the loop immediately — supervisor turn 1 (delegates to agent1),
    // agent1 turn (completes), supervisor turn 2 (sees agent1 result, bail stops loop)
    // Without bail, the loop would continue to a 4th iteration
    expect(requests.length).toBe(3);
  });
});
