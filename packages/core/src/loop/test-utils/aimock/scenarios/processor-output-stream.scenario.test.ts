import { it, expect } from 'vitest';
import { z } from 'zod/v4';
import type { Processor } from '../../../../processors';
import { describeForAllEngines, runLoopScenario, useLoopScenarioAimock } from '../aimock-scenario';

/**
 * Story: a support agent whose reply is filtered chunk by chunk as it streams: two masking
 * processors chained per chunk, a kill switch that drops every chunk, a breaker that stops the
 * reply without giving a reason, and an order-summary agent whose structured answer is
 * rewritten while it streams.
 */
describeForAllEngines('Support agent streaming chunk processors', engine => {
  const getMock = useLoopScenarioAimock();

  const QUESTION = 'Which card did you charge for order #4821?';
  const CARD_REPLY = 'We charged card 4111 ending 1111.';

  const textDeltas = (chunks: Array<{ type: string; payload?: any }>) =>
    chunks
      .filter(c => c.type === 'text-delta')
      .map(c => c.payload.text as string)
      .join('');

  const mapText =
    (fn: (text: string) => string): Processor['processOutputStream'] =>
    async ({ part }) =>
      part.type === 'text-delta' ? { ...part, payload: { ...part.payload, text: fn(part.payload.text) } } : part;

  // Technical: processOutputStream processors run per chunk in declared order, each receiving
  // the previous one's chunk. The digit masker must run before the star masker; reversed, the
  // reply would stream '#' instead of '*'.
  it('two chained chunk processors mask the card in declared order on every chunk', async () => {
    const digitsToHash: Processor = { id: 'digits-to-hash', processOutputStream: mapText(t => t.replace(/\d/g, '#')) };
    const hashToStar: Processor = { id: 'hash-to-star', processOutputStream: mapText(t => t.replace(/#/g, '*')) };

    const { output, chunks } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: QUESTION,
      collectChunks: true,
      outputProcessors: [digitsToHash, hashToStar],
      fixtures: llm => {
        llm.on({ endpoint: 'chat' }, { content: CARD_REPLY });
      },
    });

    const MASKED = 'We charged card **** ending ****.';
    expect(textDeltas(chunks!)).toBe(MASKED);
    expect(await output.text).toBe(MASKED);
  });

  // Technical: returning null from processOutputStream drops the chunk; no text-delta reaches
  // the stream and the run still finishes normally.
  it('a kill switch that drops every text chunk streams no reply text', async () => {
    const dropText: Processor = {
      id: 'drop-text',
      processOutputStream: async ({ part }) => (part.type === 'text-delta' ? null : part),
    };

    const { output, chunks } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: QUESTION,
      collectChunks: true,
      outputProcessors: [dropText],
      fixtures: llm => {
        llm.on({ endpoint: 'chat' }, { content: CARD_REPLY });
      },
    });

    expect(chunks!.map(c => c.type)).not.toContain('text-delta');
    expect(chunks!.map(c => c.type)).toContain('finish');
    expect(output.tripwire).toBeUndefined();
    expect(await output.text).toBe('');
  });

  // Technical: abort() with no reason from processOutputStream uses the default
  // "Tripwire triggered by <processor id>" on the tripwire chunk and output.tripwire
  // on every engine (#27538).
  it('a reply stopped without a reason reports which processor stopped it', async () => {
    const breaker: Processor = {
      id: 'stream-breaker',
      processOutputStream: async ({ part, abort }) => {
        if (part.type === 'text-delta') abort();
        return part;
      },
    };

    const { output, chunks } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: QUESTION,
      collectChunks: true,
      outputProcessors: [breaker],
      fixtures: llm => {
        llm.on({ endpoint: 'chat' }, { content: CARD_REPLY });
      },
    });

    const DEFAULT_REASON = 'Tripwire triggered by stream-breaker';
    expect(textDeltas(chunks!)).toBe('');
    expect(output.tripwire).toMatchObject({ processorId: 'stream-breaker' });
    expect(chunks!.find(c => c.type === 'tripwire')?.payload).toMatchObject({ reason: DEFAULT_REASON });
    expect(output.tripwire).toMatchObject({ reason: DEFAULT_REASON });
  });

  // Technical: with structuredOutput, the JSON answer streams as text-delta chunks through
  // processOutputStream; the rewritten chunks are what the client receives and what the final
  // object is parsed from.
  it('a structured order summary rewritten while streaming yields the rewritten object', async () => {
    const shoutCarrier: Processor = {
      id: 'carrier-upper',
      processOutputStream: mapText(t => t.replace(/fedex/gi, 'FEDEX')),
    };

    const { output, chunks } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'Summarize order #4821.',
      collectChunks: true,
      structuredOutput: { schema: z.object({ carrier: z.string(), status: z.string() }) },
      outputProcessors: [shoutCarrier],
      fixtures: llm => {
        llm.on({ endpoint: 'chat' }, { content: '{"carrier":"FedEx Ground","status":"shipped"}' });
      },
    });

    expect(textDeltas(chunks!)).toBe('{"carrier":"FEDEX Ground","status":"shipped"}');
    expect(await output.object).toEqual({ carrier: 'FEDEX Ground', status: 'shipped' });
  });
});
