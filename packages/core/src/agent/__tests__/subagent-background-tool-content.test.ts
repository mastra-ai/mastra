import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Mastra } from '../../mastra';
import { MockStore } from '../../storage';
import { Agent } from '../agent';

/**
 * Regression test for the background sub-agent tool-content bug.
 *
 * When a sub-agent delegation (`agent-<name>` tool) is dispatched as a background task, the agentic
 * loop hands `toModelOutput` the placeholder string ("Background task started...") instead of the
 * sub-agent's `agentOutputSchema` object. The sub-agent tool's `toModelOutput` read `output.text`,
 * which is undefined for that string, so the supervisor's continuation request carried a
 * `role: "tool"` message with null content — rejected by providers (e.g. Anthropic) with a 500.
 *
 * The fix makes `toModelOutput` use the placeholder string directly when `output` is a string, so
 * the tool message always carries non-empty content.
 *
 * The background manager workers are intentionally NOT started, so the dispatched task stays pending
 * and the supervisor's continuation turn carries the placeholder (the buggy path), deterministically.
 */
describe('sub-agent background dispatch tool content', () => {
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

  // Captures the prompt the supervisor model receives on every turn so we can inspect the
  // tool-result message produced for the delegation. Turn 1 delegates; turn 2 is the continuation
  // that previously failed.
  function capturingSupervisorModel(capturedPrompts: any[]) {
    let call = 0;
    return new MockLanguageModelV2({
      doStream: async (options: any) => {
        capturedPrompts.push(options.prompt);
        call++;
        if (call === 1) {
          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
            stream: convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              { type: 'response-metadata', id: 's1', modelId: 'mock', timestamp: new Date(0) },
              {
                type: 'tool-call',
                toolCallId: 'call-1',
                toolName: 'agent-helper',
                input: JSON.stringify({ prompt: 'hi' }),
              },
              {
                type: 'finish',
                finishReason: 'tool-calls',
                usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
              },
            ]),
          };
        }
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 's2', modelId: 'mock', timestamp: new Date(0) },
            { type: 'text-start', id: 't' },
            { type: 'text-delta', id: 't', delta: 'done' },
            { type: 'text-end', id: 't' },
            { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
          ]),
        };
      },
    });
  }

  function makeSubAgent() {
    return new Agent({
      id: 'helper',
      name: 'helper',
      description: 'A helper sub-agent.',
      instructions: 'Say hello.',
      model: new MockLanguageModelV2({
        doStream: async () => ({
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'a1', modelId: 'mock', timestamp: new Date(0) },
            { type: 'text-start', id: 'x' },
            { type: 'text-delta', id: 'x', delta: 'Hello from the sub-agent.' },
            { type: 'text-end', id: 'x' },
            { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
          ]),
        }),
      }),
    });
  }

  function toolResultValuesFor(capturedPrompts: any[], toolCallId: string): string[] {
    return capturedPrompts
      .flat()
      .filter((m: any) => m?.role === 'tool')
      .flatMap((m: any) => (Array.isArray(m.content) ? m.content : []))
      .filter((p: any) => p?.type === 'tool-result' && p.toolCallId === toolCallId)
      .map((p: any) => p.output?.value ?? p.output?.text);
  }

  it('sends non-empty tool content (the placeholder) for a backgrounded sub-agent delegation', async () => {
    const capturedPrompts: any[] = [];
    const supervisor = new Agent({
      id: 'supervisor',
      name: 'supervisor',
      instructions: 'Delegate to the helper sub-agent.',
      model: capturingSupervisorModel(capturedPrompts),
      agents: { helper: makeSubAgent() },
      // Opt the delegation into background dispatch — this is what produces the placeholder result.
      backgroundTasks: { tools: { helper: { enabled: true } } },
    });
    mastra.addAgent(supervisor, 'supervisor');

    const stream = await supervisor.stream('Please delegate.', { maxSteps: 3 });
    for await (const _ of stream.fullStream) {
      // drain
    }

    const values = toolResultValuesFor(capturedPrompts, 'call-1');
    expect(values.length).toBeGreaterThan(0);
    for (const value of values) {
      // Before the fix this was undefined (toModelOutput read the absent `.text`), serializing to
      // a null tool-message content the provider rejects with a 500.
      expect(typeof value).toBe('string');
      expect(value).toContain('Background task started');
    }
  });

  it('runs the sub-agent inline (real content) when not opted into background', async () => {
    const capturedPrompts: any[] = [];
    const supervisor = new Agent({
      id: 'supervisor-sync',
      name: 'supervisor-sync',
      instructions: 'Delegate to the helper sub-agent.',
      model: capturingSupervisorModel(capturedPrompts),
      agents: { helper: makeSubAgent() },
      // No background opt-in: the delegation runs inline and returns the real answer.
    });
    mastra.addAgent(supervisor, 'supervisor-sync');

    const stream = await supervisor.stream('Please delegate.', { maxSteps: 3 });
    for await (const _ of stream.fullStream) {
      // drain
    }

    const values = toolResultValuesFor(capturedPrompts, 'call-1');
    expect(values.length).toBeGreaterThan(0);
    for (const value of values) {
      expect(value).toContain('Hello from the sub-agent.');
    }
  });
});
