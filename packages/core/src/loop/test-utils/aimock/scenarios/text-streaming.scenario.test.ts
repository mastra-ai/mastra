import { stepCountIs } from '@internal/ai-sdk-v5';
import { it, expect } from 'vitest';
import { z } from 'zod/v4';
import { ChunkFrom } from '../../../../stream/types';
import type { ChunkType } from '../../../../stream/types';
import { createTool } from '../../../../tools';
import {
  createSharedAgent,
  describeForAllEngines,
  isDurableEngineVariant,
  runLoopScenario,
  useLoopScenarioAimock,
} from '../aimock-scenario';

/**
 * Regression class: text-streaming fidelity.
 *
 * The OpenAI SSE → AI SDK → Mastra output pipeline must preserve per-delta
 * ordering and content. When any layer of the stream reassembly breaks
 * (e.g. a dropped delta, reordered chunks, or a mismatched final text vs
 * concatenated deltas) this scenario trips.
 *
 * Asserts:
 *  - every `text-delta` chunk carries non-empty `payload`,
 *  - deltas arrive in order (no reorder between SSE frames),
 *  - their concatenation matches `output.text` exactly.
 *  - text-start/text-end chunks bracket text-delta chunks
 *  - step-start/step-finish bracket each model turn
 *  - start/finish bracket the entire run
 */
describeForAllEngines('AIMock loop scenario: text-streaming fidelity', engine => {
  const getMock = useLoopScenarioAimock();

  it('reassembles multi-delta text in order and matches output.text', async () => {
    const scriptedText =
      'The quick brown fox jumps over the lazy dog. ' +
      'Pack my box with five dozen liquor jugs. ' +
      'How vexingly quick daft zebras jump!';

    const { output, chunks } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'Write a long pangram paragraph.',
      stopWhen: stepCountIs(2),
      collectChunks: true,
      fixtures: llm => {
        llm.on({ endpoint: 'chat' }, { content: scriptedText });
      },
    });

    if (!chunks) {
      throw new Error('collectChunks should have populated chunks');
    }

    const textDeltas = chunks.filter((c): c is Extract<ChunkType, { type: 'text-delta' }> => c.type === 'text-delta');
    expect(textDeltas.length).toBeGreaterThan(0);

    // Every delta carries non-empty text.
    for (const delta of textDeltas) {
      expect(delta.payload).toBeTruthy();
      expect(typeof delta.payload.text).toBe('string');
      expect(delta.payload.text.length).toBeGreaterThan(0);
    }

    // Concatenation in arrival order equals the streamed text.
    const reassembled = textDeltas.map(d => d.payload.text).join('');
    const finalText = await (output as unknown as { text: Promise<string> }).text;
    expect(reassembled).toBe(finalText);

    // The reassembled text matches the scripted fixture content exactly.
    expect(finalText).toBe(scriptedText);
  });

  // runLoopScenario does not forward `onChunk` to durable/evented engines (harness gap, #27408).
  // Durable `onChunk` delivery stays covered by durable-agent-stream.test.ts until then.
  const itOnChunk = isDurableEngineVariant(engine) ? it.skip : it;

  itOnChunk('onChunk receives every text-delta in order and matches output.text', async () => {
    const scriptedText = 'Hello, world! Streaming through onChunk.';
    const seen: ChunkType[] = [];

    const { output, chunks } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'Say hello.',
      stopWhen: stepCountIs(2),
      collectChunks: true,
      onChunk: (chunk: ChunkType) => {
        seen.push(chunk);
      },
      fixtures: llm => {
        llm.on({ endpoint: 'chat' }, { content: scriptedText });
      },
    });

    if (!chunks) {
      throw new Error('collectChunks should have populated chunks');
    }

    const textOf = (list: ChunkType[]) =>
      list
        .filter((c): c is Extract<ChunkType, { type: 'text-delta' }> => c.type === 'text-delta')
        .map(d => d.payload.text);
    const streamedDeltas = textOf(chunks);
    const callbackDeltas = textOf(seen);

    const finalText = await (output as unknown as { text: Promise<string> }).text;
    expect(streamedDeltas.length).toBeGreaterThan(1);
    expect(callbackDeltas).toEqual(streamedDeltas);
    expect(callbackDeltas.join('')).toBe(finalText);
    expect(finalText).toBe(scriptedText);
  });

  it('final finish chunk after a tool step comes from the agent with reason "stop" and the final text', async () => {
    const finalText = 'tool returned hello';
    const echoTool = createTool({
      id: 'echo',
      description: 'Echo the input',
      inputSchema: z.object({ text: z.string() }),
      outputSchema: z.object({ echoed: z.string() }),
      execute: async ({ text }) => ({ echoed: text }),
    });

    const { output, chunks, requests } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'Run echo with hello.',
      tools: { echo: echoTool },
      maxSteps: 4,
      collectChunks: true,
      fixtures: llm => {
        llm.on(
          { endpoint: 'chat', hasToolResult: false },
          { toolCalls: [{ id: 'call_echo', name: 'echo', arguments: { text: 'hello' } }] },
        );
        llm.on({ endpoint: 'chat', hasToolResult: true }, { content: finalText });
      },
    });

    if (!chunks) {
      throw new Error('collectChunks should have populated chunks');
    }

    expect(requests).toHaveLength(2);
    const types = chunks.map(c => c.type);
    expect(types).toContain('tool-call');
    expect(types).toContain('tool-result');
    expect(types).not.toContain('response-metadata');

    const finish = chunks.findLast(c => c.type === 'finish') as Extract<ChunkType, { type: 'finish' }> | undefined;
    expect(finish?.runId).toBe(output.runId);
    expect(finish?.from).toBe(ChunkFrom.AGENT);
    expect(finish?.payload.stepResult.reason).toBe('stop');
    expect((finish?.payload as { output?: { text?: string } } | undefined)?.output?.text).toBe(finalText);
  });

  it('generate emits one opening message-identity event before its output chunks', async () => {
    const scriptedText = 'A generated response with a correlated message.';
    const llm = getMock();
    llm.onMessage('Generate a response', { content: scriptedText });
    const { agent } = await createSharedAgent(llm, { engine });
    const chunks: ChunkType[] = [];

    const output = await agent.generate('Generate a response', {
      onChunk: chunk => {
        chunks.push(chunk);
      },
    });

    expect(output.text).toBe(scriptedText);
    expect(chunks.some(c => c.type === 'text-delta')).toBe(true);
    // Non-durable generate callbacks expose model chunks, not the stream envelope.
    if (isDurableEngineVariant(engine)) {
      expect(chunks[0]?.type).toBe('start');
      const starts = chunks.filter(c => c.type === 'start');
      expect(starts).toHaveLength(1);
      expect(starts[0]).toMatchObject({
        runId: output.runId,
        from: ChunkFrom.AGENT,
        payload: { id: agent.id, messageId: expect.any(String) },
      });
    }
  });

  it('emits text-start/text-end bracketing and step/finish lifecycle chunks in order', async () => {
    const scriptedText = 'Hello world, this is a streaming fidelity test.';

    const { output, chunks, agent } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'Test chunk ordering.',
      stopWhen: stepCountIs(2),
      collectChunks: true,
      fixtures: llm => {
        llm.on({ endpoint: 'chat' }, { content: scriptedText });
      },
    });

    if (!chunks) {
      throw new Error('collectChunks should have populated chunks');
    }

    // Extract chunk types in order
    const types = chunks.map(c => c.type);

    // COR-1467: consumers need the opening event to identify the streamed message.
    expect(types[0]).toBe('start');
    const starts = chunks.filter(c => c.type === 'start');
    expect(starts).toHaveLength(1);
    const stepStart = chunks.find(c => c.type === 'step-start');
    expect(starts[0]).toMatchObject({
      runId: output.runId,
      from: ChunkFrom.AGENT,
      payload: { id: agent.id, messageId: expect.any(String) },
    });
    expect(starts[0]?.payload.messageId).toBe(stepStart?.payload.messageId);

    // Must end with 'finish' chunk
    expect(types[types.length - 1]).toBe('finish');

    // step-start must appear before text-delta
    const firstStepStart = types.indexOf('step-start');
    const firstTextDelta = types.indexOf('text-delta');
    expect(firstStepStart).toBeGreaterThanOrEqual(0);
    expect(firstTextDelta).toBeGreaterThan(firstStepStart);

    // text-start must appear before or at the same position as the first text-delta
    const textStartIdx = types.indexOf('text-start');
    expect(textStartIdx).toBeGreaterThanOrEqual(0);
    expect(textStartIdx).toBeLessThanOrEqual(firstTextDelta);

    // text-end must appear after the last text-delta
    const lastTextDelta = types.lastIndexOf('text-delta');
    const textEndIdx = types.indexOf('text-end');
    expect(textEndIdx).toBeGreaterThan(lastTextDelta);

    // step-finish must appear after text-end
    const stepFinishIdx = types.indexOf('step-finish');
    expect(stepFinishIdx).toBeGreaterThan(textEndIdx);

    // Verify the output text still matches
    const finalText = await (output as unknown as { text: Promise<string> }).text;
    expect(finalText).toBe(scriptedText);
  });
});
