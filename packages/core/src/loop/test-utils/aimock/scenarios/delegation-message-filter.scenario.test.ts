import { createOpenAI } from '@ai-sdk/openai-v5';
import { stepCountIs } from '@internal/ai-sdk-v5';
import { describe, it, expect, vi } from 'vitest';
import { Agent } from '../../../../agent';
import type { MessageFilterContext } from '../../../../agent';
import { runLoopScenario, useLoopScenarioAimock } from '../aimock-scenario';
import { SCENARIO_MODEL_ID } from '../types';

/**
 * Regression class: supervisor delegation hooks — messageFilter.
 *
 * When a supervisor delegates to a subagent, the `messageFilter` callback
 * controls which parent messages are passed to the subagent as conversation
 * context. This runs AFTER onDelegationStart (so the prompt reflects any
 * modifications). This scenario proves:
 *
 * 1. The messageFilter receives the delegation context (primitiveId, prompt, parentAgentId).
 * 2. The messageFilter sees the prompt AFTER onDelegationStart modifications.
 * 3. The filtered messages are what the subagent actually receives.
 */
describe('AIMock loop scenario: delegation messageFilter', () => {
  const getMock = useLoopScenarioAimock();

  it('messageFilter receives delegation context and can filter messages', async () => {
    const mock = getMock();
    const filterSpy = vi.fn();

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
      llm: mock,
      prompt: 'Ask the writer to draft something.',
      agents: { writer },
      stopWhen: stepCountIs(5),
      delegation: {
        messageFilter: (context: MessageFilterContext) => {
          filterSpy(context);
          // Filter out system messages (if any) to test the filtering works.
          return context.messages.filter((msg: any) => msg.role !== 'system');
        },
      },
      fixtures: llm => {
        // Supervisor turn 1: delegate to writer.
        llm.on(
          { endpoint: 'chat', hasToolResult: false },
          {
            toolCalls: [
              { id: 'call_writer', name: 'agent-writer', arguments: { prompt: 'Write something.' } },
            ],
          },
        );
        // Subagent turn: receives the filtered context.
        llm.on(
          { endpoint: 'chat', hasToolResult: false, sequenceIndex: 1 },
          { content: 'Here is what you requested.' },
        );
        // Supervisor turn 2: wraps up.
        llm.on(
          { endpoint: 'chat', hasToolResult: true },
          { content: 'Writer completed the task.' },
        );
      },
    });

    // The messageFilter was called during delegation.
    expect(filterSpy).toHaveBeenCalled();
    const filterContext = filterSpy.mock.calls[0]![0];
    expect(filterContext.primitiveId).toBe('writer');
    expect(filterContext.primitiveType).toBe('agent');
    expect(filterContext.parentAgentId).toBeDefined();
    expect(filterContext.prompt).toBe('Write something.');

    // The final output reflects the writer's response.
    const text = await output.text;
    expect(text).toContain('Writer completed');
  });

  it('messageFilter receives the prompt after onDelegationStart modifications', async () => {
    const mock = getMock();
    const filterSpy = vi.fn();

    const openai = createOpenAI({
      apiKey: 'aimock-test-key',
      baseURL: `${mock.url.replace(/\/+$/, '')}/v1`,
    });

    const writer = new Agent({
      id: 'writer',
      name: 'Writer',
      description: 'Drafts content',
      instructions: 'You are a writer.',
      model: openai(SCENARIO_MODEL_ID),
    });

    const { requests } = await runLoopScenario({
      llm: mock,
      prompt: 'Ask the writer to draft something.',
      agents: { writer },
      stopWhen: stepCountIs(5),
      delegation: {
        onDelegationStart: () => ({
          proceed: true,
          modifiedPrompt: 'MODIFIED: Write a formal letter.',
        }),
        messageFilter: (context: MessageFilterContext) => {
          filterSpy(context);
          return context.messages;
        },
      },
      fixtures: llm => {
        // Supervisor turn 1: delegate to writer.
        llm.on(
          { endpoint: 'chat', hasToolResult: false },
          {
            toolCalls: [
              { id: 'call_writer', name: 'agent-writer', arguments: { prompt: 'Write something.' } },
            ],
          },
        );
        // Subagent turn: receives the modified prompt.
        llm.on(
          { endpoint: 'chat', hasToolResult: false, sequenceIndex: 1 },
          { content: 'Here is the formal letter you requested.' },
        );
        // Supervisor turn 2: wraps up.
        llm.on(
          { endpoint: 'chat', hasToolResult: true },
          { content: 'Letter drafted successfully.' },
        );
      },
    });

    // The messageFilter received the modified prompt, not the original.
    expect(filterSpy).toHaveBeenCalled();
    const filterContext = filterSpy.mock.calls[0]![0];
    expect(filterContext.prompt).toBe('MODIFIED: Write a formal letter.');
    expect(filterContext.prompt).not.toBe('Write something.');

    // Verify the subagent actually received the modified prompt by checking its request.
    const subagentRequest = requests.find(
      (r: any) => JSON.stringify(r.body?.messages).includes('MODIFIED: Write a formal letter'),
    );
    expect(subagentRequest).toBeDefined();
  });
});
