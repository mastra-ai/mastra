import { it, expect } from 'vitest';
import { MockMemory } from '../../../../memory/mock';
import type { Processor } from '../../../../processors';
import {
  describeForAllEngines,
  isDurableEngineVariant,
  runLoopScenario,
  useLoopScenarioAimock,
} from '../aimock-scenario';

/**
 * Story: a support agent whose finished answer passes through processOutputResult processors
 * before it is saved: a brand-name fixer and a ticket tagger chained in order, a redactor that
 * can empty the answer entirely, a tone gate that blocks without giving a reason, and an audit
 * hook that must still run when the provider fails.
 */
describeForAllEngines('Support agent final-answer processors', engine => {
  const getMock = useLoopScenarioAimock();

  const THREAD = { threadId: 'support-thread', resourceId: 'customer-1' };
  const QUESTION = 'Where is my acme order?';
  const SECRET = 'SENSITIVE_MARKER_9d4f1c';

  type Messages = Parameters<NonNullable<Processor['processOutputResult']>>[0]['messages'];
  const rewriteText = (messages: Messages, fn: (text: string) => string): Messages =>
    messages.map(msg => ({
      ...msg,
      content: {
        ...msg.content,
        parts: msg.content.parts.map(part => (part.type === 'text' ? { ...part, text: fn(part.text) } : part)),
      },
    }));

  const savedText = async (memory: MockMemory) =>
    (await memory.recall(THREAD)).messages
      .filter(m => m.role === 'assistant')
      .flatMap(m => m.content.parts)
      .filter(p => p.type === 'text')
      .map(p => (p as { text: string }).text)
      .join('');

  // Technical: processOutputResult processors run in declared order, each receiving the
  // previous one's messages; an entry without processOutputResult is skipped, not fatal.
  it('chained final-answer processors run in order and skip one that does not handle results', async () => {
    const memory = new MockMemory();
    const passive = { id: 'no-result-hook' } as Processor;
    const brandFixer: Processor = {
      id: 'brand-fixer',
      processOutputResult: ({ messages }) => rewriteText(messages, t => t.replace(/acme/g, 'ACME')),
    };
    const ticketTagger: Processor = {
      id: 'ticket-tagger',
      processOutputResult: ({ messages }) => rewriteText(messages, t => `[T-42] ${t}`),
    };

    await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: QUESTION,
      memory,
      ...THREAD,
      outputProcessors: [passive, brandFixer, ticketTagger],
      fixtures: llm => {
        llm.on({ endpoint: 'chat' }, { content: 'Your acme order ships today.' });
      },
    });

    // The tagger saw the fixer's output: reversing the order would leave "acme" lowercase.
    expect(await savedText(memory)).toBe('[T-42] Your ACME order ships today.');
  });

  // Technical: a processor may set every text part to ''. The empty string must win over the
  // raw model text on every public surface (no `|| original` fallback), and nothing is saved.
  // COR-1414: durable and evented save the redaction but still return the raw model text in
  // response.uiMessages and text, so those assertions come last and are pinned as it.fails there.
  const wrapped = isDurableEngineVariant(engine);
  (wrapped ? it.fails : it)('a reply redacted down to nothing is returned and saved empty (COR-1414)', async () => {
    const memory = new MockMemory();
    const redactAll: Processor = {
      id: 'redact-all',
      processOutputResult: ({ messages }) => rewriteText(messages, () => ''),
    };

    const { output } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: QUESTION,
      memory,
      ...THREAD,
      outputProcessors: [redactAll],
      fixtures: llm => {
        llm.on({ endpoint: 'chat' }, { content: SECRET });
      },
    });

    expect(await savedText(memory)).toBe('');
    const full = await output.getFullOutput();
    expect(JSON.stringify(full.response.uiMessages ?? [])).not.toContain(SECRET);
    expect(await output.text).toBe('');
  });

  // Technical: abort() with no reason from processOutputResult uses the default
  // "Tripwire triggered by <processor id>" and ends the run with finishReason 'other'.
  it('a final answer blocked without a reason reports which processor blocked it', async () => {
    const memory = new MockMemory();
    const toneGate: Processor = {
      id: 'tone-gate',
      processOutputResult: ({ abort }) => abort(),
    };

    const { output } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: QUESTION,
      memory,
      ...THREAD,
      outputProcessors: [toneGate],
      fixtures: llm => {
        llm.on({ endpoint: 'chat' }, { content: 'Ugh, check the tracking page yourself.' });
      },
    });

    expect(output.tripwire).toMatchObject({ reason: 'Tripwire triggered by tone-gate', processorId: 'tone-gate' });
    expect(await output.finishReason).toBe('other');
    expect(await savedText(memory)).toBe('');
  });

  const orderCard = { type: 'data-order-card', data: { orderId: 'A-1' } } as const;

  // Technical: writer.custom() in processOutputResult must stream its chunk once, before `finish`,
  // without passing through processOutputStream, and a non-transient chunk is saved as a data part
  // of the reply. Durable engines passed no writer. (#29213)
  it('follow-up suggestions written by a final-answer processor are streamed and the card is saved (#29213)', async () => {
    const memory = new MockMemory();
    const streamedDataParts: string[] = [];
    const suggester: Processor = {
      id: 'suggester',
      processOutputStream: async ({ part }) => {
        if (part.type.startsWith('data-')) streamedDataParts.push(part.type);
        return part;
      },
      processOutputResult: async ({ messages, writer }) => {
        await writer?.custom({ type: 'data-suggestions', data: { prompts: ['Track it'] }, transient: true });
        await writer?.custom(orderCard);
        return messages;
      },
    };

    const { chunks } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: QUESTION,
      collectChunks: true,
      memory,
      ...THREAD,
      outputProcessors: [suggester],
      fixtures: llm => {
        llm.on({ endpoint: 'chat' }, { content: 'Your order ships today.' });
      },
    });

    const types = chunks!.map(c => c.type);
    expect(types.filter(t => t.startsWith('data-'))).toEqual(['data-suggestions', 'data-order-card']);
    expect(types.indexOf('data-order-card')).toBeLessThan(types.indexOf('finish'));
    expect(streamedDataParts).toEqual([]);

    const saved = (await memory.recall(THREAD)).messages.filter(m => m.role === 'assistant');
    expect(saved).toHaveLength(1);
    expect(saved[0]!.content.parts.map(p => p.type)).toEqual(expect.arrayContaining(['text', 'data-order-card']));
    expect(saved[0]!.content.parts.some(p => p.type === 'data-suggestions')).toBe(false);
  });

  // Technical: a failed isTaskComplete check rotates the response message id, so the card must be
  // saved with the retried answer, not the rejected one. (#29213)
  it('the card is saved with the answer that passed the completion check (#29213)', async () => {
    const memory = new MockMemory();
    const suggester: Processor = {
      id: 'suggester',
      processOutputResult: async ({ messages, writer }) => {
        await writer?.custom(orderCard);
        return messages;
      },
    };
    let checks = 0;
    const answerCheck = {
      id: 'answer-check',
      name: 'Answer Check',
      run: async () => (checks++ === 0 ? { score: 0, reason: 'No date given' } : { score: 1, reason: 'Answered' }),
    };

    await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: QUESTION,
      memory,
      ...THREAD,
      maxSteps: 4,
      isTaskComplete: { scorers: [answerCheck as any] },
      outputProcessors: [suggester],
      fixtures: llm => {
        llm.on({ endpoint: 'chat', sequenceIndex: 0 }, { content: 'Let me check.' });
        llm.on({ endpoint: 'chat', sequenceIndex: 1 }, { content: 'Your order ships today.' });
      },
    });

    const withCard = (await memory.recall(THREAD)).messages.filter(m =>
      m.content.parts.some(p => p.type === 'data-order-card'),
    );
    expect(withCard).toHaveLength(1);
    expect(JSON.stringify(withCard[0]!.content.parts)).toContain('Your order ships today.');
  });

  // Technical: when the provider call fails, processOutputResult still runs and sees
  // finishReason 'error', so audit processors can record failed turns.
  it('an audit processor still runs when the provider fails, and sees the error finish', async () => {
    const seen: Array<string | undefined> = [];
    const audit: Processor = {
      id: 'audit',
      processOutputResult: ({ messages, result }) => {
        seen.push(result?.finishReason);
        return messages;
      },
    };

    const { output } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: QUESTION,
      maxRetries: 0,
      outputProcessors: [audit],
      fixtures: llm => {
        llm.on(
          { endpoint: 'chat' },
          { error: { message: 'provider exploded', type: 'invalid_request_error' }, status: 400 },
        );
      },
    });

    expect(output.error).toBeInstanceOf(Error);
    expect(seen).toEqual(['error']);
  });
});
