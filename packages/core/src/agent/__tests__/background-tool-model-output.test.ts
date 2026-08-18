import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { Mastra } from '../../mastra';
import { MockMemory } from '../../memory';
import { MockStore } from '../../storage';
import { createTool } from '../../tools';
import { Agent } from '../agent';

/**
 * Regression test for the background-task stale `modelOutput` bug.
 *
 * When a tool is dispatched as a background task, the dispatch turn stores a
 * placeholder ("Background task started...") and — for tools with `toModelOutput`
 * — a `providerMetadata.mastra.modelOutput` derived from that placeholder. On
 * completion the real result is written to `toolInvocation.result`, but the
 * dispatch `providerMetadata` was carried through unchanged, so the stale
 * `modelOutput` survived. `llmPrompt()` prefers `mastra.modelOutput` over the raw
 * result, so every later turn showed the model the placeholder and never the
 * answer.
 *
 * The distinctive marker below can only come from the tool's real return value,
 * so finding it in a later prompt proves the model saw the actual result.
 */
describe('background tool completion updates the model-facing output', () => {
  const ANSWER = 'ZEBRA-7742-QUOKKA';
  const storage = new MockStore();
  let mastra: Mastra;

  beforeEach(() => {
    mastra = new Mastra({
      logger: false,
      storage,
      backgroundTasks: { enabled: true },
    });
  });

  afterEach(async () => {
    await mastra.backgroundTaskManager?.shutdown();
    const bgStore = await storage.getStore('backgroundTasks');
    await bgStore?.dangerouslyClearAll();
  });

  function researchTool(toModelOutputOverride?: { toModelOutput?: (output: any) => unknown }) {
    return createTool({
      id: 'research',
      description: 'Research a topic.',
      inputSchema: z.object({ topic: z.string() }),
      outputSchema: z.object({ summary: z.string() }),
      execute: async ({ topic }) => ({ summary: `Research on "${topic}": ${ANSWER}` }),
      // `toModelOutput` is what makes the bug observable: it is the field
      // `llmPrompt()` substitutes for the raw result.
      toModelOutput: (output: any) =>
        typeof output === 'string' ? { type: 'text', value: output } : { type: 'text', value: output.summary },
      background: { enabled: true },
      ...toModelOutputOverride,
    });
  }

  // Turn 1 calls the tool; every later turn just answers, so the run goes idle.
  function capturingModel(capturedPrompts: any[]) {
    let call = 0;
    return new MockLanguageModelV2({
      doStream: async (options: any) => {
        capturedPrompts.push(options.prompt);
        call++;
        const parts: any[] =
          call === 1
            ? [
                {
                  type: 'tool-call',
                  toolCallId: 'call-1',
                  toolName: 'research',
                  input: JSON.stringify({ topic: 'otters' }),
                },
                {
                  type: 'finish',
                  finishReason: 'tool-calls',
                  usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
                },
              ]
            : [
                { type: 'text-start', id: 't' },
                { type: 'text-delta', id: 't', delta: 'done' },
                { type: 'text-end', id: 't' },
                { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
              ];
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: `s${call}`, modelId: 'mock', timestamp: new Date(0) },
            ...parts,
          ]),
        };
      },
    });
  }

  function toolResultTextsFor(capturedPrompts: any[], toolCallId: string): string[] {
    return capturedPrompts
      .flat()
      .filter((m: any) => m?.role === 'tool')
      .flatMap((m: any) => (Array.isArray(m.content) ? m.content : []))
      .filter((p: any) => p?.type === 'tool-result' && p.toolCallId === toolCallId)
      .map((p: any) => JSON.stringify(p.output));
  }

  it('shows the model the real tool result, not the dispatch placeholder', async () => {
    const capturedPrompts: any[] = [];
    const agent = new Agent({
      id: 'bg-agent',
      name: 'bg-agent',
      instructions: 'Use the research tool.',
      model: capturingModel(capturedPrompts),
      tools: { research: researchTool() },
      memory: new MockMemory(),
    });
    mastra.addAgent(agent, 'bg-agent');

    const result = await agent.streamUntilIdle('Research otters.', {
      memory: { thread: 'thread-bg', resource: 'user-1' },
      maxSteps: 5,
    });
    const reader = (result.fullStream as ReadableStream<any>).getReader();
    while (true) {
      const { done } = await reader.read();
      if (done) break;
    }

    const outputs = toolResultTextsFor(capturedPrompts, 'call-1');
    expect(outputs.length).toBeGreaterThan(0);

    // At least one turn after completion must carry the real answer. Before the
    // fix every turn carried the placeholder instead.
    expect(outputs.some(o => o.includes(ANSWER))).toBe(true);
    // And the final turn must not still be showing the placeholder.
    expect(outputs.at(-1)).not.toContain('Background task started');
  });

  // The stale placeholder is only reachable when the mapping *succeeded* at
  // dispatch and then produced nothing at completion — a mapping that fails for
  // every input stores no placeholder to begin with. The dispatch placeholder is
  // a string and the real result is an object, so these map the string fine and
  // give up on the object. Without clearing `modelOutput`, the dispatch value
  // survives and the model keeps reading the placeholder.
  const onlyMapsThePlaceholder = (onObject: () => unknown) => (output: any) =>
    typeof output === 'string' ? { type: 'text', value: output } : onObject();

  it.each([
    [
      'the mapping throws on the real result',
      onlyMapsThePlaceholder(() => {
        throw new Error('mapping blew up');
      }),
    ],
    ['the mapping returns undefined for the real result', onlyMapsThePlaceholder(() => undefined)],
    ['the mapping returns null for the real result', onlyMapsThePlaceholder(() => null)],
  ])('falls back to the raw result when %s', async (_name, toModelOutput) => {
    const capturedPrompts: any[] = [];
    const agent = new Agent({
      id: 'bg-agent',
      name: 'bg-agent',
      instructions: 'Use the research tool.',
      model: capturingModel(capturedPrompts),
      tools: { research: researchTool({ toModelOutput: toModelOutput as any }) },
      memory: new MockMemory(),
    });
    mastra.addAgent(agent, 'bg-agent');

    const result = await agent.streamUntilIdle('Research otters.', {
      memory: { thread: `thread-bg-${_name.replace(/\s+/g, '-')}`, resource: 'user-1' },
      maxSteps: 5,
    });
    const reader = (result.fullStream as ReadableStream<any>).getReader();
    while (true) {
      const { done } = await reader.read();
      if (done) break;
    }

    const outputs = toolResultTextsFor(capturedPrompts, 'call-1');
    expect(outputs.length).toBeGreaterThan(0);
    expect(outputs.some(o => o.includes(ANSWER))).toBe(true);
    expect(outputs.at(-1)).not.toContain('Background task started');
  });
});
