import { expect, it } from 'vitest';
import type { ChunkType } from '../../../../stream';
import { MockMemory } from '../../../../memory/mock';
import type { Processor } from '../../../../processors';
import { BatchPartsProcessor } from '../../../../processors';
import { describeForAllEngines, runLoopScenario, useLoopScenarioAimock } from '../aimock-scenario';

/**
 * Story: a support agent batches its streamed reply (BatchPartsProcessor with
 * emitOnNonText: false) so the UI repaints less often. The reply is shorter than
 * one batch, so the batch is still open when the model stream ends. Before
 * #27523 nothing released it and the customer got an empty answer, in the stream
 * and in the saved thread.
 */
describeForAllEngines('Output processors release held parts when the stream ends', engine => {
  const getMock = useLoopScenarioAimock();
  const THREAD = { threadId: 'support-thread', resourceId: 'customer-1' };
  const QUESTION = 'Where is my order?';
  const REPLY = 'Your order shipped yesterday and should arrive by Friday';

  const streamedText = (chunks: ChunkType[] | undefined) =>
    (chunks ?? [])
      .filter(c => c.type === 'text-delta')
      .map(c => (c.payload as { text: string }).text)
      .join('');

  async function savedText(memory: MockMemory) {
    const { messages } = await memory.recall(THREAD);
    return messages
      .filter(m => m.role === 'assistant')
      .flatMap(m => m.content.parts)
      .filter(p => p.type === 'text')
      .map(p => (p as { text: string }).text)
      .join('');
  }

  it('a reply shorter than one batch still reaches the customer (#27523)', async () => {
    const memory = new MockMemory();
    const { output, chunks } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: QUESTION,
      memory,
      ...THREAD,
      collectChunks: true,
      outputProcessors: [new BatchPartsProcessor({ batchSize: 200, emitOnNonText: false })],
      fixtures: llm => {
        llm.on({ endpoint: 'chat' }, { content: REPLY }, { chunkSize: 5 });
      },
    });

    expect(streamedText(chunks), 'batched reply was dropped at end of stream').toBe(REPLY);
    expect(await output.text).toBe(REPLY);
    expect(await savedText(memory)).toBe(REPLY);
  });

  // Technical: a released batch must still pass the processors after the batcher,
  // and only those (re-feeding it to the batcher would hold it again).
  it('released text still goes through the processors after the batcher (#27523)', async () => {
    const shout: Processor = {
      id: 'shout',
      processOutputStream: async ({ part }) =>
        part.type === 'text-delta'
          ? { ...part, payload: { ...part.payload, text: part.payload.text.toUpperCase() } }
          : part,
    };
    const memory = new MockMemory();
    const { output, chunks } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: QUESTION,
      memory,
      ...THREAD,
      collectChunks: true,
      outputProcessors: [new BatchPartsProcessor({ batchSize: 200, emitOnNonText: false }), shout],
      fixtures: llm => {
        llm.on({ endpoint: 'chat' }, { content: REPLY }, { chunkSize: 5 });
      },
    });

    expect(streamedText(chunks), 'released batch skipped the downstream processor').toBe(REPLY.toUpperCase());
    expect(await output.text).toBe(REPLY.toUpperCase());
    expect(await savedText(memory)).toBe(REPLY.toUpperCase());
  });
});
