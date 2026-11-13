import { it, expect } from 'vitest';
import { z } from 'zod/v4';
import { createTool } from '../../../../tools';
import { runLoopScenario, useLoopScenarioAimock, describeForAllEngines } from '../aimock-scenario';

/**
 * Regression for https://github.com/mastra-ai/mastra/issues/27548.
 *
 * When `isTaskComplete` fails, its "Completion Check Results" feedback is added
 * after the model's answer. If the model then calls a tool, the feedback must stay
 * before that tool call in the following request, so the model reads it as the
 * reason for the retry rather than as a comment on the tool result.
 */
describeForAllEngines('AIMock loop scenario: isTaskComplete feedback order', engine => {
  const getMock = useLoopScenarioAimock();

  it('keeps the feedback before the tool call the model makes in response to it', async () => {
    let scorerCalls = 0;
    const scorer = {
      id: 'fail-then-pass-scorer',
      name: 'Fail Then Pass Scorer',
      run: async () =>
        scorerCalls++ === 0 ? { score: 0, reason: 'Task not complete yet' } : { score: 1, reason: 'Task is complete' },
    };
    const lookup = createTool({
      id: 'lookup',
      description: 'Looks up a fact',
      inputSchema: z.object({}),
      execute: async () => ({ fact: 'looked up' }),
    });

    const { output, requests } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'Find the fact.',
      tools: { lookup },
      maxSteps: 6,
      isTaskComplete: { scorers: [scorer as any] },
      fixtures: llm => {
        llm.on({ endpoint: 'chat', sequenceIndex: 0 }, { content: 'Attempt one.' });
        llm.on(
          { endpoint: 'chat', sequenceIndex: 1 },
          { toolCalls: [{ id: 'call-1', name: 'lookup', arguments: {} }] },
        );
        llm.on({ endpoint: 'chat', sequenceIndex: 2 }, { content: 'Done.' });
      },
    });

    expect(await output.text).toContain('Done.');
    expect(requests).toHaveLength(3);

    const messages: Array<{ role: string; content: unknown; tool_calls?: unknown[] }> =
      (requests[2]?.body as any)?.messages ?? [];
    // The first answer's text currently reaches the model as "" on every engine,
    // so anchor on the prompt rather than on "Attempt one.".
    const promptIndex = messages.findIndex(m => m.role === 'user');
    const feedbackIndex = messages.findIndex(m => JSON.stringify(m.content ?? '').includes('Completion Check Results'));
    const toolCallIndex = messages.findIndex(m => m.role === 'assistant' && m.tool_calls?.length);

    expect(promptIndex).toBeGreaterThanOrEqual(0);
    expect(feedbackIndex).toBe(promptIndex + 2);
    expect(toolCallIndex).toBe(feedbackIndex + 1);
    expect(messages.slice(promptIndex).map(m => m.role)).toEqual([
      'user',
      'assistant',
      'assistant',
      'assistant',
      'tool',
    ]);
  });
});
