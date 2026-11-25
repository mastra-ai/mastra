import { createOpenAI } from '@ai-sdk/openai-v5';
import type { LLMock } from '@copilotkit/aimock';
import { expect, it } from 'vitest';
import { MockMemory } from '../../../../memory/mock';
import { BatchPartsProcessor, PIIDetector, StreamErrorRetryProcessor } from '../../../../processors';
import type { ChunkType } from '../../../../stream';
import { describeForAllEngines, runLoopScenario, useLoopScenarioAimock } from '../aimock-scenario';
import { SCENARIO_MODEL_ID } from '../types';

/**
 * Story: a support agent batches its streamed reply (BatchPartsProcessor with
 * emitOnNonText: false) and redacts emails from it (PIIDetector). #27565 made
 * held parts get released when a model stream ends. These cover what that
 * release must NOT do: repeat a dropped attempt's text when the call is retried,
 * emit held text after the call failed, or lose the parts it releases.
 */
describeForAllEngines('Output processors and held parts when a model call fails', engine => {
  const getMock = useLoopScenarioAimock();
  const THREAD = { threadId: 'support-thread', resourceId: 'customer-1' };
  const QUESTION = 'Can I email someone about my order?';
  const AGENT_INSTRUCTIONS = 'You are a support agent for an online shop.';
  const REPLY = 'Thanks, I passed your note on. You can also write to jane.doe@example.com';
  const REDACTED = 'Thanks, I passed your note on. You can also write to j******e@*******.com';

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

  // The PIIDetector's own detection model is served by the same mock; only the
  // support agent (keyed by its instructions) gets the scripted reply.
  const piiDetector = (llm: LLMock) =>
    new PIIDetector({
      model: createOpenAI({ apiKey: 'test', baseURL: `${llm.url.replace(/\/+$/, '')}/v1` })(SCENARIO_MODEL_ID),
      detectionTypes: ['email'],
      strategy: 'redact',
    });
  const noDetections = (llm: LLMock) =>
    llm.on(
      { endpoint: 'chat' },
      { content: JSON.stringify({ categories: null, detections: null, redacted_content: null }) },
    );

  it('a retried model call does not repeat the text of the attempt that dropped', async () => {
    const memory = new MockMemory();
    const { output, chunks } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: QUESTION,
      memory,
      ...THREAD,
      collectChunks: true,
      errorProcessors: [new StreamErrorRetryProcessor({ maxRetries: 2 })],
      outputProcessors: [new BatchPartsProcessor({ batchSize: 200, emitOnNonText: false })],
      fixtures: llm => {
        llm.on(
          { endpoint: 'chat', sequenceIndex: 0 },
          { content: 'Partial answer that gets cut off' },
          { chunkSize: 5, latency: 20, disconnectAfterMs: 150 },
        );
        llm.on({ endpoint: 'chat', sequenceIndex: 1 }, { content: 'Full answer.' });
      },
    });

    expect(streamedText(chunks), 'dropped attempt text was streamed with the retry').toBe('Full answer.');
    expect(await output.text).toBe('Full answer.');
    expect(await savedText(memory)).toBe('Full answer.');
  });

  it('held text of a call that drops without retry is never emitted', async () => {
    const llm = getMock();
    const { output, chunks } = await runLoopScenario({
      engine,
      llm,
      prompt: QUESTION,
      instructions: AGENT_INSTRUCTIONS,
      maxRetries: 0,
      collectChunks: true,
      outputProcessors: [new BatchPartsProcessor({ batchSize: 200, emitOnNonText: false }), piiDetector(llm)],
      fixtures: l => {
        l.on(
          { endpoint: 'chat', systemMessage: AGENT_INSTRUCTIONS },
          { content: REPLY },
          { chunkSize: 5, latency: 20, disconnectAfterMs: 250 },
        );
        noDetections(l);
      },
    });

    expect(streamedText(chunks), 'held text of the failed call was released').toBe('');
    // The failure itself is never held back: the caller sees the error and the run settles.
    expect(
      (chunks ?? []).map(c => c.type),
      'the error was held back with the text',
    ).toContain('error');
    expect(await output.text).toBe('');
  });

  it('held text of an aborted call is never emitted', async () => {
    const llm = getMock();
    const abort = new AbortController();
    setTimeout(() => abort.abort(), 150);
    const { output, chunks } = await runLoopScenario({
      engine,
      llm,
      prompt: QUESTION,
      instructions: AGENT_INSTRUCTIONS,
      collectChunks: true,
      abortSignal: abort.signal,
      outputProcessors: [new BatchPartsProcessor({ batchSize: 200, emitOnNonText: false }), piiDetector(llm)],
      fixtures: l => {
        l.on(
          { endpoint: 'chat', systemMessage: AGENT_INSTRUCTIONS },
          { content: REPLY },
          { chunkSize: 5, latency: 20 },
        );
        noDetections(l);
      },
    });

    expect(streamedText(chunks), 'held text was emitted after abort').toBe('');
    expect(
      (chunks ?? []).map(c => c.type),
      'the abort was held back with the text',
    ).toContain('abort');
    expect(await output.text).toBe('');
  });

  it('an email at the end of a batched reply is redacted, and the reply still closes', async () => {
    const llm = getMock();
    const { output, chunks } = await runLoopScenario({
      engine,
      llm,
      prompt: QUESTION,
      instructions: AGENT_INSTRUCTIONS,
      collectChunks: true,
      outputProcessors: [new BatchPartsProcessor({ batchSize: 200, emitOnNonText: false }), piiDetector(llm)],
      fixtures: l => {
        l.on({ endpoint: 'chat', systemMessage: AGENT_INSTRUCTIONS }, { content: REPLY }, { chunkSize: 5 });
        noDetections(l);
      },
    });

    expect(streamedText(chunks)).toBe(REDACTED);
    expect(await output.text).toBe(REDACTED);
    // Technical: the PIIDetector defers text-end until its held tail is out. A
    // deferred part re-entering at the batcher would be held again with nothing
    // left to release it, so the text block never closed.
    const types = (chunks ?? []).map(c => c.type);
    expect(
      types.filter(t => t === 'text-end'),
      'text-end lost after release',
    ).toHaveLength(1);
    expect(types.lastIndexOf('text-end')).toBeGreaterThan(types.lastIndexOf('text-delta'));
  });
});
