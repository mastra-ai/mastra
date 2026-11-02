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
