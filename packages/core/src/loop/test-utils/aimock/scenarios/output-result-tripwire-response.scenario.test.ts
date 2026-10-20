import { it, expect } from 'vitest';
import type { Processor } from '../../../../processors';
import { runLoopScenario, useLoopScenarioAimock, describeForAllEngines } from '../aimock-scenario';

/**
 * Story: a support agent's final answer is rejected by a refund-policy gate that runs on the
 * finished result (processOutputResult). The app still reads the model's draft from
 * `response.messages` to show it to a human reviewer, so it must match `text` and `steps`.
 * Bug: #27562 (durable and evented returned an empty assistant message).
 */
describeForAllEngines('A rejected final answer is still reported consistently', engine => {
  const getMock = useLoopScenarioAimock();

  const UNAPPROVED_REFUND = 'I have issued a full refund of $89 to your card.';

  const refundPolicyGate: Processor = {
    id: 'refund-policy',
    processOutputResult: ({ result, abort, messages }) => {
      if (result.text.includes('refund')) abort('Refunds need human approval');
      return messages;
    },
  };

  const assistantText = (messages: any[]) =>
    messages
      .filter(m => m.role === 'assistant')
      .flatMap(m => (typeof m.content === 'string' ? [m.content] : m.content))
      .map((part: any) => (typeof part === 'string' ? part : part.type === 'text' ? part.text : ''))
      .join('');

  // Technical: durable/evented end the stream on the tripwire chunk, whose resolved response
  // carried only `dbMessages`, so `response.messages` was missing while `text` and `steps` kept the answer.
  it('response.messages keeps the assistant draft after processOutputResult trips (#27562)', async () => {
    const { output } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'My order is late, I want my money back.',
      outputProcessors: [refundPolicyGate],
      fixtures: llm => {
        llm.on({ endpoint: 'chat' }, { content: UNAPPROVED_REFUND });
      },
    });

    expect(output.tripwire).toMatchObject({ reason: 'Refunds need human approval', processorId: 'refund-policy' });
    expect(await output.text).toBe(UNAPPROVED_REFUND);
    const steps = await output.steps;
    expect(steps.map(s => s.text).join('')).toBe(UNAPPROVED_REFUND);
    const response = await output.response;
    expect(assistantText(response.messages ?? [])).toBe(UNAPPROVED_REFUND);
  });
});
