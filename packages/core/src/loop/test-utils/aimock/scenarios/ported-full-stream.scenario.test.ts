import { setTimeout as delay } from 'node:timers/promises';
import { expect, it } from 'vitest';
import { z } from 'zod/v4';
import { MockMemory } from '../../../../memory/mock';
import { createTool } from '../../../../tools';
import { describeForAllEngines, runLoopScenario, useLoopScenarioAimock } from '../aimock-scenario';
import { geminiChunk, geminiFinal, useScriptedProviders } from '../scripted-sse';

/**
 * Ported from the AI SDK `result.fullStream` suite (formerly test-utils/fullStream.ts),
 * which drove loop() with hand-built V2/V3 stream parts and snapshotted the
 * output. Here real v6 providers parse scripted wire responses (Gemini for
 * reasoning/sources/files, OpenAI Responses for `rs_*` reasoning items), so the
 * chunks reaching the loop are the ones a provider actually produces, and each
 * case runs on every engine.
 */

const types = (chunks: any[], ...keep: string[]) => chunks.filter(c => keep.includes(c.type));

function responsesEvents(events: unknown[]) {
  return [
    { type: 'response.created', response: { id: 'resp_1', created_at: 1, model: 'gpt-5' } },
    ...events,
    {
      type: 'response.completed',
      response: { incomplete_details: null, usage: { input_tokens: 3, output_tokens: 10 } },
    },
  ];
}

const message = (id: string) => ({
  type: 'response.output_item.added',
  output_index: 1,
  item: { type: 'message', id },
});
const messageDone = (id: string) => ({
  type: 'response.output_item.done',
  output_index: 1,
  item: { type: 'message', id },
});
const textDelta = (id: string, delta: string) => ({ type: 'response.output_text.delta', item_id: id, delta });

async function assistantParts(memory: MockMemory, threadId: string) {
  const { messages } = await memory.recall({ threadId, resourceId: 'ported-user' });
  return messages.filter(m => m.role === 'assistant').flatMap(m => m.content.parts) as any[];
}

describeForAllEngines('AIMock loop scenario: ported fullStream (v6 providers)', engine => {
  const p = useScriptedProviders();

  const run = (model: () => any, extra: Record<string, unknown> = {}) =>
    runLoopScenario({
      engine,
      llm: p.llm,
      model,
      prompt: 'test-input',
      collectChunks: true,
      fixtures: () => {},
      ...extra,
    });

  it('streams text deltas between text-start and text-end', async () => {
    p.gemini.responses.push([
      geminiChunk([{ text: 'Hello' }]),
      geminiChunk([{ text: ', ' }]),
      geminiFinal([{ text: 'world!' }]),
    ]);

    const { chunks, output } = await run(p.geminiModel);

    const text = types(chunks!, 'text-start', 'text-delta', 'text-end');
    expect(text.map(c => [c.type, c.payload.text])).toEqual([
      ['text-start', undefined],
      ['text-delta', 'Hello'],
      ['text-delta', ', '],
      ['text-delta', 'world!'],
      ['text-end', undefined],
    ]);
    expect(new Set(text.map(c => c.payload.id)).size).toBe(1);
    expect(await output.text).toBe('Hello, world!');
  });

  it('filters out empty text deltas', async () => {
    const id = 'msg_1';
    p.openai.responses.push(
      responsesEvents([
        message(id),
        textDelta(id, ''),
        textDelta(id, 'Hello'),
        textDelta(id, ''),
        textDelta(id, ', world!'),
        textDelta(id, ''),
        messageDone(id),
      ]),
    );

    const { chunks, output } = await run(p.openaiModel);

    expect(types(chunks!, 'text-delta').map(c => c.payload.text)).toEqual(['Hello', ', world!']);
    expect(await output.text).toBe('Hello, world!');
  });

  it('streams reasoning deltas with provider metadata ahead of text', async () => {
    p.gemini.responses.push([
      geminiChunk([{ text: 'I will open the conversation', thought: true, thoughtSignature: 'sig-1' }]),
      geminiChunk([{ text: ' with witty banter.', thought: true }]),
      geminiChunk([{ text: 'Hi' }]),
      geminiFinal([{ text: ' there!' }]),
    ]);

    const { chunks, output } = await run(p.geminiModel);

    const parts = types(chunks!, 'reasoning-start', 'reasoning-delta', 'reasoning-end', 'text-start');
    expect(parts.map(c => [c.type, c.payload.text, c.payload.providerMetadata])).toEqual([
      ['reasoning-start', undefined, { google: { thoughtSignature: 'sig-1' } }],
      ['reasoning-delta', 'I will open the conversation', { google: { thoughtSignature: 'sig-1' } }],
      ['reasoning-delta', ' with witty banter.', undefined],
      ['reasoning-end', undefined, undefined],
      ['text-start', undefined, undefined],
    ]);
    expect(await output.reasoningText).toBe('I will open the conversation with witty banter.');
    expect(await output.text).toBe('Hi there!');
  });

  // https://github.com/mastra-ai/mastra/issues/9005
  it('stores an empty reasoning item with its provider metadata for item_reference replay', async () => {
    const memory = new MockMemory();
    p.openai.responses.push(
      responsesEvents([
        {
          type: 'response.output_item.added',
          output_index: 0,
          item: { type: 'reasoning', id: 'rs_test123', encrypted_content: null, summary: [] },
        },
        {
          type: 'response.output_item.done',
          output_index: 0,
          item: { type: 'reasoning', id: 'rs_test123', encrypted_content: null, summary: [] },
        },
        message('msg_1'),
        textDelta('msg_1', 'Hello!'),
        messageDone('msg_1'),
      ]),
    );

    await run(p.openaiModel, { memory, threadId: 'empty-reasoning', resourceId: 'ported-user' });

    const reasoning = (await assistantParts(memory, 'empty-reasoning')).filter(part => part.type === 'reasoning');
    expect(reasoning).toHaveLength(1);
    expect(reasoning[0].providerMetadata).toMatchObject({ openai: { itemId: 'rs_test123' } });
  });

  // Regression: an eager flush on text-start split one rs_* item into two
  // reasoning parts, which OpenAI rejects on replay ("Duplicate item found").
  it('keeps one reasoning part per item id when reasoning and text interleave', async () => {
    const memory = new MockMemory();
    p.openai.responses.push(
      responsesEvents([
        {
          type: 'response.output_item.added',
          output_index: 0,
          item: { type: 'reasoning', id: 'rs_abc123', encrypted_content: null, summary: [] },
        },
        { type: 'response.reasoning_summary_part.added', item_id: 'rs_abc123', summary_index: 0 },
        {
          type: 'response.reasoning_summary_text.delta',
          item_id: 'rs_abc123',
          summary_index: 0,
          delta: 'Let me think',
        },
        message('msg_1'),
        textDelta('msg_1', 'Here is '),
        {
          type: 'response.reasoning_summary_text.delta',
          item_id: 'rs_abc123',
          summary_index: 0,
          delta: ' about this...',
        },
        textDelta('msg_1', 'my answer.'),
        {
          type: 'response.output_item.done',
          output_index: 0,
          item: {
            type: 'reasoning',
            id: 'rs_abc123',
            encrypted_content: 'sig_final',
            summary: [{ type: 'summary_text', text: 'Let me think about this...' }],
          },
        },
        messageDone('msg_1'),
      ]),
    );

    await run(p.openaiModel, { memory, threadId: 'interleaved-reasoning', resourceId: 'ported-user' });

    const parts = await assistantParts(memory, 'interleaved-reasoning');
    const reasoning = parts.filter(part => part.type === 'reasoning');
    expect(reasoning).toHaveLength(1);
    expect(reasoning[0].details[0].text).toBe('Let me think about this...');
    // Metadata from the item's done event (the final one) wins.
    expect(reasoning[0].providerMetadata).toEqual({
      openai: { itemId: 'rs_abc123', reasoningEncryptedContent: 'sig_final' },
    });
    expect(parts.filter(part => part.type === 'text').map(part => part.text)).toEqual(['Here is my answer.']);
  });

  it('streams url sources', async () => {
    p.gemini.responses.push([
      geminiFinal([{ text: 'Hello!' }], {
        groundingMetadata: {
          groundingChunks: [
            { web: { uri: 'https://example.com', title: 'Example' } },
            { web: { uri: 'https://example.com/2', title: 'Example 2' } },
          ],
        },
      }),
    ]);

    const { chunks } = await run(p.geminiModel);

    expect(types(chunks!, 'source').map(c => c.payload)).toEqual([
      { id: expect.any(String), sourceType: 'url', url: 'https://example.com', title: 'Example' },
      { id: expect.any(String), sourceType: 'url', url: 'https://example.com/2', title: 'Example 2' },
    ]);
  });

  it('streams files in order around text', async () => {
    p.gemini.responses.push([
      geminiChunk([{ inlineData: { mimeType: 'text/plain', data: 'SGVsbG8gV29ybGQ=' } }]),
      geminiChunk([{ text: 'Hello!' }]),
      geminiFinal([{ inlineData: { mimeType: 'image/jpeg', data: 'QkFVRw==' } }]),
    ]);

    const { chunks } = await run(p.geminiModel);

    expect(
      types(chunks!, 'file', 'text-delta').map(c => [c.type, c.payload.mimeType ?? c.payload.text, c.payload.base64]),
    ).toEqual([
      ['file', 'text/plain', 'SGVsbG8gV29ybGQ='],
      ['text-delta', 'Hello!', undefined],
      ['file', 'image/jpeg', 'QkFVRw=='],
    ]);
  });

  it('falls back to generated response metadata when the provider sends none', async () => {
    // Gemini streams carry no response id/timestamp, so the loop must fill them.
    p.gemini.responses.push([geminiFinal([{ text: 'Hello, world!' }])]);
    const before = Date.now();

    const { chunks, output } = await run(p.geminiModel);

    const [stepFinish] = types(chunks!, 'step-finish');
    const metadata = stepFinish.payload.metadata;
    const response: any = await output.response;
    expect(metadata.id).toEqual(expect.any(String));
    expect(metadata.id.length).toBeGreaterThan(0);
    expect(metadata.modelId).toBe('gemini-2.5-flash');
    expect(new Date(metadata.timestamp).getTime()).toBeGreaterThanOrEqual(before - 1000);
    expect(response.id).toBe(metadata.id);
    expect(new Date(response.timestamp).getTime()).toBeGreaterThanOrEqual(before - 1000);
  });

  it('keeps the provider response id over the generated fallback', async () => {
    p.openai.responses.push(responsesEvents([message('msg_1'), textDelta('msg_1', 'Hello!'), messageDone('msg_1')]));

    const { chunks, output } = await run(p.openaiModel);

    const [stepFinish] = types(chunks!, 'step-finish');
    expect(stepFinish.payload.metadata.id).toBe('resp_1');
    expect(((await output.response) as any).id).toBe('resp_1');
  });
});

describeForAllEngines('AIMock loop scenario: ported fullStream (tool parts)', engine => {
  const getMock = useLoopScenarioAimock();

  it('streams tool input deltas, the tool call and a delayed async tool result in order', async () => {
    const tool1 = createTool({
      id: 'tool1',
      description: 'echoes a value after a delay',
      inputSchema: z.object({ value: z.string() }),
      execute: async ({ value }) => {
        await delay(20);
        return `${value}-result`;
      },
    });

    const { chunks, output } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'test-input',
      tools: { tool1 },
      collectChunks: true,
      fixtures: llm => {
        llm.on(
          { endpoint: 'chat', sequenceIndex: 0 },
          { toolCalls: [{ id: 'call-1', name: 'tool1', arguments: { value: 'value' } }] },
        );
        llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'done' });
      },
    });

    const toolChunks = types(
      chunks!,
      'tool-call-input-streaming-start',
      'tool-call-delta',
      'tool-call-input-streaming-end',
      'tool-call',
      'tool-result',
    );
    const order = [...new Set(toolChunks.map(c => c.type))];
    expect(order).toEqual([
      'tool-call-input-streaming-start',
      'tool-call-delta',
      'tool-call-input-streaming-end',
      'tool-call',
      'tool-result',
    ]);
    expect(toolChunks.every(c => c.payload.toolCallId === 'call-1')).toBe(true);
    const streamedArgs = types(toolChunks, 'tool-call-delta')
      .map(c => c.payload.argsTextDelta)
      .join('');
    expect(JSON.parse(streamedArgs)).toEqual({ value: 'value' });
    expect(types(toolChunks, 'tool-call')[0].payload).toMatchObject({ toolName: 'tool1', args: { value: 'value' } });
    expect(types(toolChunks, 'tool-result')[0].payload).toMatchObject({ toolName: 'tool1', result: 'value-result' });
    expect(await output.text).toBe('done');
  });
});
