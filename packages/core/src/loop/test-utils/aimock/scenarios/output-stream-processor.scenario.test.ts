import { stepCountIs } from '@internal/ai-sdk-v5';
import { it, expect } from 'vitest';
import { z } from 'zod/v4';
import { SpanType } from '../../../../observability';
import { captureOutcomeEvents } from '../outcome-test-utils';
import { MockMemory } from '../../../../memory/mock';
import type { Processor } from '../../../../processors';
import { createTool } from '../../../../tools';
import {
  describeForAllEngines,
  isDurableEngineVariant,
  runLoopScenario,
  useLoopScenarioAimock,
} from '../aimock-scenario';

/**
 * Story: a customer-support agent whose replies pass through output processors before the
 * customer sees them: a redactor that masks card digits as they stream, a tagger that stamps
 * the final answer, a tool-result filter that trims internal fields before the model sees
 * them, and a progress writer that pushes UI-only data parts.
 *
 * The thread in memory is replayed to the model on every later turn and shown to the customer
 * when they reopen the chat, so it must hold exactly what the processors produced, not what
 * the model originally wrote. Bugs: #26335, #25826.
 */
describeForAllEngines('Support agent output stream processors', engine => {
  const getMock = useLoopScenarioAimock();

  const CUSTOMER_QUESTION = 'Which card did you charge for order #4821?';
  const CARD_REPLY = 'We charged the card 4111 1111 1111 1111.';
  const MASKED_REPLY = 'We charged the card #### #### #### ####.';
  const THREAD = { threadId: 'support-thread', resourceId: 'customer-1' };

  const maskDigits: Processor = {
    id: 'card-redactor',
    processOutputStream: async ({ part }) => {
      if (part.type !== 'text-delta') return part;
      return { ...part, payload: { ...part.payload, text: part.payload.text.replace(/\d/g, '#') } };
    },
  };

  const crashOnText = (alsoOnResult = false): Processor => ({
    id: 'card-redactor',
    processOutputStream: async ({ part }) => {
      if (part.type === 'text-delta') throw new Error('redactor crashed');
      return part;
    },
    ...(alsoOnResult
      ? {
          processOutputResult: () => {
            throw new Error('redactor crashed');
          },
        }
      : {}),
  });

  async function savedAssistant(memory: MockMemory) {
    const { messages } = await memory.recall(THREAD);
    return messages.filter(m => m.role === 'assistant');
  }
  const savedText = async (memory: MockMemory) =>
    (await savedAssistant(memory))
      .flatMap(m => m.content.parts)
      .filter(p => p.type === 'text')
      .map(p => (p as { text: string }).text)
      .join('');

  // Technical: durable engines run output processors on step-start in the producer and mark
  // it processed, so consumers must not run them on it again (#28231). The processor sees the
  // step-start exactly once, and the stream still delivers it.
  it('an output processor sees the step-start once and the customer still receives it', async () => {
    let seenStepStarts = 0;
    const { chunks } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: CUSTOMER_QUESTION,
      collectChunks: true,
      outputProcessors: [
        {
          id: 'step-start-counter',
          processOutputStream: async ({ part }) => {
            if (part.type === 'step-start') seenStepStarts++;
            return part;
          },
        },
      ],
      fixtures: llm => {
        llm.on({ endpoint: 'chat' }, { content: MASKED_REPLY });
      },
    });

    expect(seenStepStarts).toBe(1);
    expect(chunks!.filter(c => c.type === 'step-start')).toHaveLength(1);
  });

  // Technical: processOutputStream rewrites text-delta chunks. Memory is written from the
  // response messages, which must be built from the processed chunks, not the raw model deltas.
  // Before #26335 durable and evented saved the raw card number while streaming the masked one.
  it('a masked card number stays masked in the saved thread (#26335)', async () => {
    const memory = new MockMemory();
    const { output } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: CUSTOMER_QUESTION,
      memory,
      ...THREAD,
      outputProcessors: [maskDigits],
      fixtures: llm => {
        llm.on({ endpoint: 'chat' }, { content: CARD_REPLY });
      },
    });

    expect(await output.text).toBe(MASKED_REPLY);
    expect(await savedText(memory)).toBe(MASKED_REPLY);
  });

  // Technical: a processor may change a chunk's type (text-delta -> reasoning-delta). The saved
  // message must store the part under its new type, so the hidden text is not saved as text. (#26335)
  it('internal notes moved out of the reply are saved as reasoning, not reply text (#26335)', async () => {
    const memory = new MockMemory();
    const toInternalNotes: Processor = {
      id: 'internal-notes',
      processOutputStream: async ({ part }) => {
        if (part.type !== 'text-delta') return part;
        return { ...part, type: 'reasoning-delta', payload: { id: 'notes', text: part.payload.text } } as typeof part;
      },
    };

    await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: CUSTOMER_QUESTION,
      memory,
      ...THREAD,
      outputProcessors: [toInternalNotes],
      fixtures: llm => {
        llm.on({ endpoint: 'chat' }, { content: 'Escalate: card on file looks stolen.' });
      },
    });

    const parts = (await savedAssistant(memory)).flatMap(m => m.content.parts);
    expect(await savedText(memory)).toBe('');
    expect(parts.some(p => p.type === 'reasoning')).toBe(true);
  });

  // Technical: processOutputResult may rewrite the final assistant message. The rewrite must
  // reach both the saved thread and the run's returned text.
  it('a signature added to the final answer is returned and saved', async () => {
    const memory = new MockMemory();
    const signReply: Processor = {
      id: 'signature',
      processOutputResult: ({ messages }) => {
        const last = messages.at(-1);
        const textPart = last?.content.parts.find(p => p.type === 'text') as { text: string } | undefined;
        if (textPart) textPart.text += ' — Acme Support';
        return messages;
      },
    };

    await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: CUSTOMER_QUESTION,
      memory,
      ...THREAD,
      outputProcessors: [signReply],
      fixtures: llm => {
        llm.on({ endpoint: 'chat' }, { content: 'It was the Visa on file.' });
      },
    });

    expect(await savedText(memory)).toBe('It was the Visa on file. — Acme Support');
  });

  // Technical: COR-1414. Durable and evented save the processOutputResult rewrite but their
  // returned text stays the raw model text. Pinned so this flips when the engines agree.
  const wrapped = isDurableEngineVariant(engine);
  (wrapped ? it.fails : it)('the returned answer carries the signature too (COR-1414)', async () => {
    const signReply: Processor = {
      id: 'signature',
      processOutputResult: ({ messages }) => {
        const textPart = messages.at(-1)?.content.parts.find(p => p.type === 'text') as { text: string } | undefined;
        if (textPart) textPart.text += ' — Acme Support';
        return messages;
      },
    };
    const { output } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: CUSTOMER_QUESTION,
      outputProcessors: [signReply],
      fixtures: llm => {
        llm.on({ endpoint: 'chat' }, { content: 'It was the Visa on file.' });
      },
    });
    expect(await output.text).toBe('It was the Visa on file. — Acme Support');
  });

  // Technical: abort() from processOutputStream on the first text delta ends the run as a
  // tripwire; no model text reaches the stream after it.
  it('a reply blocked on its first words never reaches the customer', async () => {
    const blockAll: Processor = {
      id: 'kill-switch',
      processOutputStream: async ({ part, abort }) => {
        if (part.type === 'text-delta') abort('Support replies are paused');
        return part;
      },
    };

    const { output, chunks } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: CUSTOMER_QUESTION,
      collectChunks: true,
      outputProcessors: [blockAll],
      fixtures: llm => {
        llm.on({ endpoint: 'chat' }, { content: CARD_REPLY });
      },
    });

    const types = chunks!.map(c => c.type);
    expect(types).toContain('tripwire');
    expect(types).not.toContain('text-delta');
    expect(output.tripwire).toMatchObject({ reason: 'Support replies are paused', processorId: 'kill-switch' });
  });

  // Technical: abort() with no reason from processOutputStream must default to the same
  // "Tripwire triggered by <id>" reason as every other hook, on every engine. Durable and
  // evented used to report "Stream part blocked by <id>" instead. (#27538)
  it('a reply stopped without a reason reports which processor stopped it (#27538)', async () => {
    const blockAll: Processor = {
      id: 'kill-switch',
      processOutputStream: async ({ part, abort }) => {
        if (part.type === 'text-delta') abort();
        return part;
      },
    };

    const { output, chunks } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: CUSTOMER_QUESTION,
      collectChunks: true,
      outputProcessors: [blockAll],
      fixtures: llm => {
        llm.on({ endpoint: 'chat' }, { content: CARD_REPLY });
      },
    });

    const tripwire = chunks!.find(c => c.type === 'tripwire') as { payload: { reason: string } } | undefined;
    expect(tripwire?.payload.reason).toBe('Tripwire triggered by kill-switch');
    expect(output.tripwire).toMatchObject({ reason: 'Tripwire triggered by kill-switch', processorId: 'kill-switch' });
  });

  // Technical: a processor's writer.custom() data chunk must reach the stream once and be saved
  // as a data part on the assistant message, so the UI can re-render it from history.
  it('a progress card pushed by a processor is streamed and saved with the reply', async () => {
    const memory = new MockMemory();
    const progress: Processor = {
      id: 'progress',
      processOutputStream: async ({ part, writer, state }) => {
        if (part.type === 'text-delta' && !state.sent) {
          state.sent = true;
          await writer?.custom({ type: 'data-progress', data: { stage: 'answering' } });
        }
        return part;
      },
    };

    const { chunks } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: CUSTOMER_QUESTION,
      collectChunks: true,
      memory,
      ...THREAD,
      outputProcessors: [progress],
      fixtures: llm => {
        llm.on({ endpoint: 'chat' }, { content: 'It was the Visa on file.' });
      },
    });

    expect(chunks!.filter(c => c.type === 'data-progress')).toHaveLength(1);
    const parts = (await savedAssistant(memory)).flatMap(m => m.content.parts);
    expect(parts.filter(p => p.type === 'data-progress')).toHaveLength(1);
  });

  // Technical: processToolResult runs once per tool result, before the result is streamed,
  // sent back to the model, and saved. All three must see the processed result.
  it('internal fields trimmed from an order lookup never reach the model or the thread', async () => {
    const memory = new MockMemory();
    let filterRuns = 0;
    const lookupOrder = createTool({
      id: 'lookupOrder',
      description: 'Look up an order by id.',
      inputSchema: z.object({ orderId: z.string() }),
      execute: async () => ({ status: 'shipped', internalMargin: 'MARGIN-42' }),
    });
    const trimInternal: Processor = {
      id: 'trim-internal',
      processToolResult: ({ messageList, toolCallId, toolName, args, result }) => {
        filterRuns++;
        const { internalMargin: _drop, ...rest } = result as Record<string, unknown>;
        messageList.updateToolInvocation({
          type: 'tool-invocation',
          toolInvocation: { state: 'result', toolCallId, toolName, args, result: rest },
        });
        return messageList;
      },
    };

    const { requests } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: CUSTOMER_QUESTION,
      tools: { lookupOrder },
      stopWhen: stepCountIs(5),
      memory,
      ...THREAD,
      outputProcessors: [trimInternal],
      fixtures: llm => {
        llm.on(
          { endpoint: 'chat', hasToolResult: false },
          { toolCalls: [{ id: 'call_1', name: 'lookupOrder', arguments: { orderId: '4821' } }] },
        );
        llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'Your order has shipped.' });
      },
    });

    expect(filterRuns).toBe(1);
    expect(requests).toHaveLength(2);
    expect(JSON.stringify(requests[1]!.body)).toContain('shipped');
    expect(JSON.stringify(requests[1]!.body)).not.toContain('MARGIN-42');
    expect(JSON.stringify((await memory.recall(THREAD)).messages)).not.toContain('MARGIN-42');
  });

  it('a blocked order result closes the step without rewriting the provider completion', async () => {
    const { observability, ended } = captureOutcomeEvents();
    const { output, requests } = await runLoopScenario({
      engine,
      llm: getMock(),
      observability,
      prompt: CUSTOMER_QUESTION,
      maxSteps: 3,
      tools: {
        lookupOrder: createTool({
          id: 'lookupOrder',
          description: 'Look up the order',
          inputSchema: z.object({}),
          execute: async () => ({ internalMargin: 'MARGIN-42' }),
        }),
      },
      outputProcessors: [
        {
          id: 'result-policy',
          processToolResult: ({ abort }) => abort('Private result blocked'),
        },
      ],
      fixtures: llm =>
        llm.on(
          { endpoint: 'chat' },
          {
            toolCalls: [{ id: 'blocked-order', name: 'lookupOrder', arguments: {} }],
          },
        ),
    });
    expect(output.tripwire).toMatchObject({ processorId: 'result-policy', reason: 'Private result blocked' });
    for (const type of [SpanType.AGENT_RUN, SpanType.MODEL_GENERATION, SpanType.MODEL_STEP]) {
      expect(ended(type).at(-1)).toMatchObject({
        outcome: 'blocked',
        stopReason: 'guardrail',
        stopReasonContext: { tripwire: { processorId: 'result-policy', reason: 'Private result blocked' } },
      });
    }
    expect(ended(SpanType.MODEL_INFERENCE)).toMatchObject([{ outcome: 'success', stopReason: null }]);
    expect(requests).toHaveLength(1);
  });

  const lookupOrderFixtures =
    (name = 'lookupOrder') =>
    (llm: ReturnType<typeof getMock>) => {
      llm.on(
        { endpoint: 'chat', hasToolResult: false },
        { toolCalls: [{ id: 'call_1', name, arguments: { orderId: '4821' } }] },
      );
      llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'Your order has shipped.' });
    };
  const countToolChunks = () => {
    const seen = { 'tool-result': 0, 'tool-error': 0, processToolResult: 0 };
    const processor: Processor = {
      id: 'tool-chunk-tagger',
      processToolResult: ({ messageList }) => {
        seen.processToolResult++;
        return messageList;
      },
      processOutputStream: async ({ part }) => {
        if (part.type !== 'tool-result' && part.type !== 'tool-error') return part;
        seen[part.type]++;
        if (part.type !== 'tool-result') return part;
        return { ...part, payload: { ...part.payload, result: { ...(part.payload.result as object), tagged: true } } };
      },
    };
    return { seen, processor };
  };

  // Technical: tool-result chunks go through processOutputStream exactly once, and the streamed
  // chunk carries the processed payload. Durable/evented process tool chunks worker-side, so the
  // adapter's MastraModelOutput must not run the processor a second time (#22980).
  it('an order lookup result shown to the customer is tagged by the stream processor exactly once', async () => {
    const { seen, processor } = countToolChunks();
    let lookups = 0;
    const lookupOrder = createTool({
      id: 'lookupOrder',
      description: 'Look up an order by id.',
      inputSchema: z.object({ orderId: z.string() }),
      execute: async () => {
        lookups++;
        return { status: 'shipped' };
      },
    });

    const { chunks } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: CUSTOMER_QUESTION,
      tools: { lookupOrder },
      stopWhen: stepCountIs(5),
      collectChunks: true,
      outputProcessors: [processor],
      fixtures: lookupOrderFixtures(),
    });

    expect(lookups).toBe(1);
    expect(seen).toEqual({ 'tool-result': 1, 'tool-error': 0, processToolResult: 1 });
    const results = chunks!.filter(c => c.type === 'tool-result');
    expect(results).toHaveLength(1);
    expect((results[0]!.payload as { result: unknown }).result).toEqual({ status: 'shipped', tagged: true });
    expect(chunks!.at(-1)?.type).toBe('finish');
  });

  // Technical: processOutputStream returning null for a tool-result chunk drops it from the
  // stream; the run still continues to the model's reply.
  it('an order lookup result hidden by the stream processor never reaches the customer', async () => {
    const lookupOrder = createTool({
      id: 'lookupOrder',
      description: 'Look up an order by id.',
      inputSchema: z.object({ orderId: z.string() }),
      execute: async () => ({ status: 'shipped' }),
    });
    const hideToolResults: Processor = {
      id: 'tool-result-hider',
      processOutputStream: async ({ part }) => (part.type === 'tool-result' ? null : part),
    };

    const { output, chunks } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: CUSTOMER_QUESTION,
      tools: { lookupOrder },
      stopWhen: stepCountIs(5),
      collectChunks: true,
      outputProcessors: [hideToolResults],
      fixtures: lookupOrderFixtures(),
    });

    expect(chunks!.filter(c => c.type === 'tool-result')).toHaveLength(0);
    expect(await output.text).toBe('Your order has shipped.');
  });

  // Technical: a tool-error chunk (tool threw, or the model called a tool that does not exist)
  // goes through processOutputStream exactly once and the run still finishes.
  for (const [label, tools, toolName] of [
    [
      'a failing order lookup',
      {
        lookupOrder: createTool({
          id: 'lookupOrder',
          description: 'Look up an order by id.',
          inputSchema: z.object({ orderId: z.string() }),
          execute: async () => {
            throw new Error('order service down');
          },
        }),
      },
      'lookupOrder',
    ],
    ['a call to a tool the agent does not have', {}, 'cancelOrder'],
  ] as const) {
    it(`${label} reaches the stream processor as one tool error`, async () => {
      const { seen, processor } = countToolChunks();

      const { chunks } = await runLoopScenario({
        engine,
        llm: getMock(),
        prompt: CUSTOMER_QUESTION,
        tools,
        stopWhen: stepCountIs(5),
        collectChunks: true,
        outputProcessors: [processor],
        fixtures: lookupOrderFixtures(toolName),
      });

      expect(seen['tool-error']).toBe(1);
      expect(chunks!.filter(c => c.type === 'tool-error')).toHaveLength(1);
      expect(chunks!.at(-1)?.type).toBe('finish');
    });
  }

  // Technical: if processOutputStream throws on a tool-result chunk the run fails closed: no
  // tool-result chunk (raw or processed) is emitted, one error chunk carries the crash, and the
  // model is not called again to write a reply.
  it('a redactor crashing on an order lookup result fails the run without showing the raw result', async () => {
    const lookupOrder = createTool({
      id: 'lookupOrder',
      description: 'Look up an order by id.',
      inputSchema: z.object({ orderId: z.string() }),
      execute: async () => ({ card: 'RAW-CARD-4111' }),
    });
    const crashOnToolResult: Processor = {
      id: 'tool-result-redactor',
      processOutputStream: async ({ part }) => {
        if (part.type === 'tool-result') throw new Error('tool result redactor crashed');
        return part;
      },
    };

    const { chunks } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: CUSTOMER_QUESTION,
      tools: { lookupOrder },
      stopWhen: stepCountIs(5),
      collectChunks: true,
      outputProcessors: [crashOnToolResult],
      fixtures: lookupOrderFixtures(),
    }).catch(() => ({ chunks: undefined }));

    const all = chunks ?? [];
    expect(JSON.stringify(all)).not.toContain('RAW-CARD-4111');
    expect(all.filter(c => c.type === 'tool-result')).toHaveLength(0);
    const errors = all.filter(c => c.type === 'error');
    expect(errors).toHaveLength(1);
    expect(JSON.stringify(errors[0]!.payload)).toContain('tool result redactor crashed');
    expect(all.filter(c => c.type === 'text-delta')).toHaveLength(0);
  });

  // Technical: a processor that throws must fail closed (#25826): the unprocessed text never
  // reaches the stream or the saved thread, and the failure surfaces as an error chunk.
  it('a crashing redactor fails closed instead of leaking the raw reply (#25826)', async () => {
    const memory = new MockMemory();

    const { chunks } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: CUSTOMER_QUESTION,
      collectChunks: true,
      memory,
      ...THREAD,
      outputProcessors: [crashOnText()],
      fixtures: llm => {
        llm.on({ endpoint: 'chat' }, { content: CARD_REPLY });
      },
    }).catch(() => ({ chunks: undefined }));

    const streamed = (chunks ?? [])
      .filter(c => c.type === 'text-delta')
      .map(c => (c as { payload: { text: string } }).payload.text)
      .join('');
    expect(streamed).not.toContain('4111');
    expect((chunks ?? []).some(c => c.type === 'error')).toBe(true);
    expect(JSON.stringify((await memory.recall(THREAD)).messages)).not.toContain('4111');
  });

  // Technical: after a processor crash the saved assistant message holds only the error, so
  // reopening the chat shows "something went wrong" instead of the leaked or half reply.
  it('a crashed reply is saved as an error, not as text', async () => {
    const memory = new MockMemory();
    await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: CUSTOMER_QUESTION,
      memory,
      ...THREAD,
      outputProcessors: [crashOnText()],
      fixtures: llm => {
        llm.on({ endpoint: 'chat' }, { content: CARD_REPLY });
      },
    }).catch(() => undefined);

    const saved = await savedAssistant(memory);
    expect(saved.flatMap(m => m.content.parts.map(p => p.type))).toEqual(['error']);
  });

  // Technical: COR-1414. When a processor throws in processOutputStream AND processOutputResult
  // after a tool step, durable and evented keep the order lookup plus the error; the plain Agent
  // saves no assistant message at all, losing the completed lookup. (With only the stream hook
  // throwing, every engine already keeps both.) Pinned on plain until it matches.
  const plain = engine === 'normal' || engine === 'fs';
  (plain ? it.fails : it)('a crash after an order lookup keeps the lookup and the error (COR-1414)', async () => {
    const memory = new MockMemory();
    const lookupOrder = createTool({
      id: 'lookupOrder',
      description: 'Look up an order by id.',
      inputSchema: z.object({ orderId: z.string() }),
      execute: async () => ({ status: 'shipped' }),
    });
    await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: CUSTOMER_QUESTION,
      tools: { lookupOrder },
      stopWhen: stepCountIs(5),
      memory,
      ...THREAD,
      outputProcessors: [crashOnText(true)],
      fixtures: llm => {
        llm.on(
          { endpoint: 'chat', hasToolResult: false },
          { toolCalls: [{ id: 'call_1', name: 'lookupOrder', arguments: { orderId: '4821' } }] },
        );
        llm.on({ endpoint: 'chat', hasToolResult: true }, { content: CARD_REPLY });
      },
    }).catch(() => undefined);

    const saved = await savedAssistant(memory);
    expect(saved.flatMap(m => m.content.parts.map(p => p.type))).toEqual(['tool-invocation', 'step-start', 'error']);
  });

  // Technical: processOutputStep abort({ retry: true, metadata }) must surface the reason,
  // metadata and processor id on the retried step-finish, emit one data-signal before the next
  // step, and end with a normal finish (no tripwire).
  it('a draft sent back for a rewrite reports why, then finishes normally', async () => {
    const toneCheck: Processor = {
      id: 'tone-check',
      processOutputStep: ({ text, abort, messageList }) => {
        if (text?.includes('Whatever')) abort('Be polite', { retry: true, metadata: { rule: 'tone' } });
        return messageList;
      },
    };

    const { output, chunks, requests } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: CUSTOMER_QUESTION,
      collectChunks: true,
      maxProcessorRetries: 1,
      outputProcessors: [toneCheck],
      fixtures: llm => {
        llm.on({ endpoint: 'chat', sequenceIndex: 0 }, { content: 'Whatever, it was the Visa.' });
        llm.on({ endpoint: 'chat', sequenceIndex: 1 }, { content: 'It was the Visa on file.' });
      },
    });

    expect(requests).toHaveLength(2);
    expect(await output.text).toBe('It was the Visa on file.');
    const types = chunks!.map(c => c.type);
    const retryFinish = chunks!.find(
      c => c.type === 'step-finish' && (c.payload as any)?.stepResult?.reason === 'retry',
    );
    expect(retryFinish?.payload).toMatchObject({
      stepResult: { retryReason: 'Be polite', retryMetadata: { rule: 'tone' }, retryProcessorId: 'tone-check' },
    });
    const signal = types.indexOf('data-signal');
    expect(types.filter(t => t === 'data-signal')).toHaveLength(1);
    expect(types.indexOf('step-start', signal + 1)).toBeGreaterThan(signal);
    expect(types).not.toContain('tripwire');
    expect(types.filter(t => t === 'finish')).toHaveLength(1);
    expect(await output.finishReason).toBe('stop');
  });
});
