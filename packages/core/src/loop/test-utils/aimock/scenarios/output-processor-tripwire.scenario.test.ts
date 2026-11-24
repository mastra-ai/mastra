import { stepCountIs } from '@internal/ai-sdk-v5';
import { it, expect } from 'vitest';
import { z } from 'zod/v4';
import { MockMemory } from '../../../../memory/mock';
import type { Processor } from '../../../../processors';
import { createTool } from '../../../../tools';
import { runLoopScenario, useLoopScenarioAimock, describeForAllEngines } from '../aimock-scenario';

/**
 * Story: a customer-support agent for an online store. It looks up orders and answers
 * customers, behind output guardrails that compliance depends on:
 *
 * - a tone check that asks the model to rewrite unprofessional replies (abort with retry),
 * - a data-leak guard that blocks replies exposing card numbers (abort without retry),
 * - a refund-policy gate that rejects the final answer if it promises an unapproved refund
 *   (processOutputResult).
 *
 * If any of these break, a customer sees text the guardrail rejected, or the rejected text
 * is saved to the thread and sent back to the model on the next turn, so the leak repeats.
 * Bugs: #22980, #25996, #26048, #26215.
 */
describeForAllEngines('Support agent output guardrails', engine => {
  const getMock = useLoopScenarioAimock();

  const CUSTOMER_QUESTION = 'Where is my order #4821? It was supposed to arrive Monday.';
  const ORDER_STATUS = 'shipped via UPS, arriving Thursday';
  const CARD_LEAK = 'Your card 4111 1111 1111 1111 was charged $89.';
  const UNAPPROVED_REFUND = 'I have issued a full refund of $89 to your card.';

  const lookupOrder = createTool({
    id: 'lookupOrder',
    description: 'Look up an order by id.',
    inputSchema: z.object({ orderId: z.string() }),
    execute: async () => ({ status: ORDER_STATUS }),
  });
  const lookupOrderCall = { id: 'call_1', name: 'lookupOrder', arguments: { orderId: '4821' } };

  const dataLeakGuard: Processor = {
    id: 'card-number-guard',
    processOutputStep: async ({ text, abort, messageList }) => {
      if (text && /\d{4} \d{4} \d{4} \d{4}/.test(text)) abort('Reply exposes a card number', { retry: false });
      return messageList;
    },
  };
  const refundPolicyGate: Processor = {
    id: 'refund-policy',
    processOutputResult: ({ result, abort, messages }) => {
      if (result.text.includes('refund')) abort('Refunds need human approval');
      return messages;
    },
  };

  // Technical: processOutputStep abort({ retry: true }) must discard the rejected step from the
  // MessageList, append the abort reason as feedback, and re-run the LLM step with retryCount + 1
  // (visible to both output and input-step processors). The rejected text must not reach the next
  // request body, and no tripwire chunk is emitted because the run recovered. (#22980)
  it('a rude draft is rewritten before the customer sees it (#22980)', async () => {
    const retryCounts: number[] = [];
    const inputStepRetryCounts: number[] = [];
    const toneCheck: Processor = {
      id: 'tone-check',
      processOutputStep: async ({ text, abort, retryCount, messageList }) => {
        retryCounts.push(retryCount);
        if (text?.includes('not my problem')) abort('Rewrite this politely', { retry: true });
        return messageList;
      },
    };
    const retryObserver: Processor = {
      id: 'retry-observer',
      processInputStep: async ({ retryCount }) => {
        inputStepRetryCounts.push(retryCount);
      },
    };

    const { output, requests, chunks } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: CUSTOMER_QUESTION,
      collectChunks: true,
      maxProcessorRetries: 3,
      outputProcessors: [toneCheck],
      inputProcessors: [retryObserver],
      fixtures: llm => {
        llm.on({ endpoint: 'chat', sequenceIndex: 0 }, { content: 'Delays are not my problem, ask UPS.' });
        llm.on({ endpoint: 'chat', sequenceIndex: 1 }, { content: 'Sorry for the delay! It arrives Thursday.' });
      },
    });

    // The model is told why, and never sees its own rude draft again.
    expect(requests).toHaveLength(2);
    expect(retryCounts).toEqual([0, 1]);
    expect(inputStepRetryCounts).toEqual([0, 1]);
    const rewriteRequest = JSON.stringify(requests[1]!.body);
    expect(rewriteRequest).toContain('Rewrite this politely');
    expect(rewriteRequest).not.toContain('not my problem');

    // The customer only gets the polite reply, as a normal finish.
    expect(chunks!.map(c => c.type)).not.toContain('tripwire');
    expect(chunks!.at(-1)?.type).toBe('finish');
    expect(await output.finishReason).toBe('stop');
    expect(await output.text).toBe('Sorry for the delay! It arrives Thursday.');
    expect(output.tripwire).toBeFalsy();
  });

  // Technical: when a step that contains tool calls is rejected with retry, the loop must drop
  // the step before tool execution. Otherwise the tool-call step still runs side effects
  // (here: a refund) for output that was thrown away.
  it('tools requested in a rejected draft never run (no side effects from rejected output)', async () => {
    let refundsIssued = 0;
    const issueRefund = createTool({
      id: 'issueRefund',
      description: 'Refund an order.',
      inputSchema: z.object({ orderId: z.string() }),
      execute: async () => {
        refundsIssued++;
        return { ok: true };
      },
    });
    const toneCheck: Processor = {
      id: 'tone-check',
      processOutputStep: async ({ text, abort, messageList }) => {
        if (text?.includes('whatever')) abort('Rewrite this politely', { retry: true });
        return messageList;
      },
    };

    const { output, requests } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: CUSTOMER_QUESTION,
      tools: { issueRefund },
      stopWhen: stepCountIs(5),
      maxProcessorRetries: 3,
      outputProcessors: [toneCheck],
      fixtures: llm => {
        llm.on(
          { endpoint: 'chat', sequenceIndex: 0 },
          {
            content: 'Ugh, whatever, here is your money.',
            toolCalls: [{ id: 'call_1', name: 'issueRefund', arguments: { orderId: '4821' } }],
          },
        );
        llm.on({ endpoint: 'chat', sequenceIndex: 1 }, { content: 'Sorry for the delay! It arrives Thursday.' });
      },
    });

    expect(requests).toHaveLength(2);
    expect(refundsIssued).toBe(0);
    expect(await output.toolResults).toHaveLength(0);
    expect(await output.text).toBe('Sorry for the delay! It arrives Thursday.');
  });

  // Technical: abort({ retry: false }) in processOutputStep must end the run with
  // finishReason 'tripwire', set output.tripwire { reason, processorId }, and clear the text.
  // Before #26168 some engines still surfaced the rejected step text or finished as 'stop'. (#26048)
  it('a reply leaking a card number is blocked and the customer sees nothing of it (#26048)', async () => {
    const { output, requests, chunks } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: CUSTOMER_QUESTION,
      collectChunks: true,
      maxProcessorRetries: 3,
      outputProcessors: [dataLeakGuard],
      fixtures: llm => {
        llm.on({ endpoint: 'chat' }, { content: CARD_LEAK });
      },
    });

    expect(requests).toHaveLength(1);
    expect(chunks!.map(c => c.type)).not.toContain('tripwire');
    expect(chunks!.at(-1)?.type).toBe('finish');
    expect(await output.finishReason).toBe('tripwire');
    expect(output.tripwire).toMatchObject({ reason: 'Reply exposes a card number', processorId: 'card-number-guard' });
    expect(await output.text).toBe('');
    expect((await output.getFullOutput()).text).toBe('');
  });

  // Technical: once retryCount reaches maxProcessorRetries, a retry abort must be treated as a
  // final tripwire (same result as retry: false) instead of returning the last rejected text. (#26048)
  it('when the model keeps failing the tone check, the run stops instead of shipping the bad draft (#26048)', async () => {
    const { output, requests } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: CUSTOMER_QUESTION,
      maxProcessorRetries: 1,
      outputProcessors: [
        {
          id: 'tone-check',
          processOutputStep: async ({ abort, messageList }) => {
            abort('Still unprofessional', { retry: true });
            return messageList;
          },
        } satisfies Processor,
      ],
      fixtures: llm => {
        llm.on({ endpoint: 'chat' }, { content: 'Delays are not my problem, ask UPS.' });
      },
    });

    expect(requests).toHaveLength(2);
    expect(await output.finishReason).toBe('tripwire');
    expect(output.tripwire).toMatchObject({ reason: 'Still unprofessional', processorId: 'tone-check' });
    expect(await output.text).toBe('');
  });

  // Technical: memory is written from the MessageList at the end of the run. A run-ending
  // processOutputStep tripwire must remove only the rejected step's response messages; earlier
  // completed steps (the tool call + result) stay, so the thread remains consistent. (#26048)
  it('a blocked card leak is not saved to the thread, but the order lookup is kept (#26048)', async () => {
    const memory = new MockMemory();

    const { output } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: CUSTOMER_QUESTION,
      tools: { lookupOrder },
      stopWhen: stepCountIs(5),
      memory,
      threadId: 'thread-26048',
      resourceId: 'customer-26048',
      outputProcessors: [dataLeakGuard],
      fixtures: llm => {
        llm.on({ endpoint: 'chat', hasToolResult: false }, { toolCalls: [lookupOrderCall] });
        llm.on({ endpoint: 'chat', hasToolResult: true }, { content: CARD_LEAK });
      },
    });

    expect(await output.finishReason).toBe('tripwire');
    expect(await output.text).toBe('');
    const { messages } = await memory.recall({ threadId: 'thread-26048', resourceId: 'customer-26048' });
    expect(messages.some(m => m.role === 'user')).toBe(true);
    const saved = JSON.stringify(messages);
    expect(saved).toContain(ORDER_STATUS);
    expect(saved).not.toContain('4111 1111 1111 1111');
  });

  // Technical: processOutputResult runs after the whole run finishes. An abort there must set
  // output.tripwire and skip saving the response messages. Before #26178 the durable and Inngest
  // finalize steps ignored the tripwire and persisted the rejected answer. (#25996)
  it('an unapproved refund promise is rejected and never saved to the thread (#25996)', async () => {
    const memory = new MockMemory();

    const { output } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'My order is late, I want my money back.',
      memory,
      threadId: 'thread-25996',
      resourceId: 'customer-25996',
      outputProcessors: [refundPolicyGate],
      fixtures: llm => {
        llm.on({ endpoint: 'chat' }, { content: UNAPPROVED_REFUND });
      },
    });

    expect(output.tripwire).toMatchObject({ reason: 'Refunds need human approval', processorId: 'refund-policy' });
    // Same values as generate() on every engine (#27170: on durable they live on result.output).
    expect(await output.finishReason).toBe('other');
    const { messages } = await memory.recall({ threadId: 'thread-25996', resourceId: 'customer-25996' });
    expect(messages.filter(m => m.role === 'assistant')).toHaveLength(0);
  });

  // Technical: with savePerStep, each step is written to memory in onStepFinish, before the
  // run-level processOutputResult runs. An abort must therefore delete the already-saved response
  // messages, not just skip the final save. Before #26252 the plain Agent left them in the thread,
  // so the next turn sent the rejected reply back to the model. (#26215)
  it('an unapproved refund promise is removed even when each step was already saved (savePerStep, #26215)', async () => {
    const memory = new MockMemory();

    const { output } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'My order #4821 is late, I want my money back.',
      tools: { lookupOrder },
      stopWhen: stepCountIs(5),
      memory,
      threadId: 'thread-26215',
      resourceId: 'customer-26215',
      savePerStep: true,
      outputProcessors: [refundPolicyGate],
      fixtures: llm => {
        llm.on({ endpoint: 'chat', hasToolResult: false }, { toolCalls: [lookupOrderCall] });
        llm.on({ endpoint: 'chat', hasToolResult: true }, { content: UNAPPROVED_REFUND });
      },
    });

    expect(output.tripwire).toMatchObject({ reason: 'Refunds need human approval', processorId: 'refund-policy' });
    await output.consumeStream();
    const { messages } = await memory.recall({ threadId: 'thread-26215', resourceId: 'customer-26215' });
    expect(JSON.stringify(messages)).not.toContain(UNAPPROVED_REFUND);
  });

  // Since #26142 a tripwire ends the stream with exactly one `tripwire` chunk, no `finish`, and
  // status 'tripwire'. The plain Agent runs processOutputResult while handling `finish` in
  // stream/base/output.ts and used to enqueue the original `finish` (reason 'stop') anyway, so
  // chat UIs and the HTTP stream route were told the turn finished normally (#27170, #27377).
  it('a chat UI is told the refund promise was blocked (tripwire chunk, #27170)', async () => {
    const { output, chunks } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'My order is late, I want my money back.',
      collectChunks: true,
      outputProcessors: [refundPolicyGate],
      fixtures: llm => {
        llm.on({ endpoint: 'chat' }, { content: UNAPPROVED_REFUND });
      },
    });

    const types = chunks!.map(c => c.type);
    expect(chunks!.find(c => c.type === 'tripwire')?.payload).toMatchObject({
      reason: 'Refunds need human approval',
      processorId: 'refund-policy',
    });
    expect(types.filter(type => type === 'tripwire')).toHaveLength(1);
    expect(types).not.toContain('finish');
    expect(types.at(-1)).toBe('tripwire');
    expect(output.status).toBe('tripwire');
  });
});
