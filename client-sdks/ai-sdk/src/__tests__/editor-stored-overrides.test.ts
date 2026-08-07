/**
 * Regression test for issue #18574.
 *
 * When `@mastra/editor` is configured, an agent's runtime config (instructions,
 * tools, model, ...) can live in stored config instead of the code definition.
 * Studio resolves these stored overrides before every run, but `chatRoute` /
 * `handleChatStream` from `@mastra/ai-sdk` resolved the agent with a plain
 * `mastra.getAgentById(agentId)` and never applied the stored overrides. The
 * agent therefore executed with the (empty) code-defined instructions and the
 * endpoint behaved differently from Studio.
 *
 * The fix routes `handleChatStream` through the editor's `applyStoredOverrides`
 * (defaulting to the published version, matching the built-in agent handlers)
 * so the endpoint serves the same instructions Studio does.
 */
import type { UIMessage } from '@internal/ai-sdk-v5';
import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import { RequestContext } from '@mastra/core/request-context';
import { describe, expect, it, vi } from 'vitest';

import { handleChatStream } from '../chat-route';

const STORED_INSTRUCTIONS = 'The secret phrase is "banana". You are a helpful weather assistant.';
const CODE_INSTRUCTIONS = 'You are a code-defined assistant.';

const messages: UIMessage[] = [
  { id: 'user-1', role: 'user', parts: [{ type: 'text', text: 'What is the secret phrase?' }] },
];

/**
 * Mock model that records the system instructions it actually receives, so a
 * test can assert which instructions reached the LLM.
 */
function createCapturingModel(capture: { systemPrompt: string | undefined }) {
  return new MockLanguageModelV2({
    doStream: async ({ prompt }) => {
      const systemMessage = (prompt as Array<{ role: string; content: unknown }>).find(m => m.role === 'system');
      capture.systemPrompt = typeof systemMessage?.content === 'string' ? systemMessage.content : undefined;

      return {
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: 'msg-1', modelId: 'mock-model', timestamp: new Date() },
          { type: 'text-start', id: 'text-1' },
          { type: 'text-delta', id: 'text-1', delta: 'ok' },
          { type: 'text-end', id: 'text-1' },
          { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
        ] as any),
        rawCall: { rawPrompt: [], rawSettings: {} },
        warnings: [],
      };
    },
  });
}

function createCodeAgent(capture: { systemPrompt: string | undefined }, instructions: string) {
  return new Agent({
    id: 'weather-agent',
    name: 'Weather Agent',
    instructions,
    model: createCapturingModel(capture),
  });
}

/**
 * Minimal editor stub mirroring the `@mastra/editor` contract that
 * `handleChatStream` relies on. `applyStoredOverrides` forks the code agent and
 * swaps in the stored instructions — exactly what the real editor does when a
 * stored config exists for the requested version. The spy lets tests assert the
 * version/requestContext that `handleChatStream` resolved with.
 */
function createEditorStub(storedInstructions: string | null) {
  const applyStoredOverrides = vi.fn(
    async (agent: Agent, _options?: unknown, _requestContext?: RequestContext): Promise<Agent> => {
      if (storedInstructions === null) return agent;
      const fork = (agent as any).__fork() as Agent;
      (fork as any).__updateInstructions(storedInstructions);
      return fork;
    },
  );
  return { registerWithMastra() {}, agent: { applyStoredOverrides } };
}

function createMastra(agent: Agent, editor?: ReturnType<typeof createEditorStub>) {
  return new Mastra({
    agents: { weatherAgent: agent },
    ...(editor ? { editor: editor as any } : {}),
  });
}

async function drainStream(stream: ReadableStream) {
  const reader = stream.getReader();
  while (true) {
    const { done } = await reader.read();
    if (done) break;
  }
}

describe('handleChatStream editor stored overrides (issue #18574)', () => {
  it('runs with stored instructions from the editor instead of the empty code definition', async () => {
    const capture: { systemPrompt: string | undefined } = { systemPrompt: undefined };
    const editor = createEditorStub(STORED_INSTRUCTIONS);
    const mastra = createMastra(createCodeAgent(capture, ''), editor);

    const stream = await handleChatStream({ mastra, agentId: 'weatherAgent', params: { messages } });
    await drainStream(stream);

    expect(capture.systemPrompt).toContain(STORED_INSTRUCTIONS);
    // Overrides resolved exactly once, defaulting to the published version.
    expect(editor.agent.applyStoredOverrides).toHaveBeenCalledTimes(1);
    expect(editor.agent.applyStoredOverrides.mock.calls[0]![1]).toEqual({ status: 'published' });
  });

  it('forwards an explicit agentVersion to the editor instead of the published default', async () => {
    const capture: { systemPrompt: string | undefined } = { systemPrompt: undefined };
    const editor = createEditorStub(STORED_INSTRUCTIONS);
    const mastra = createMastra(createCodeAgent(capture, ''), editor);

    const stream = await handleChatStream({
      mastra,
      agentId: 'weatherAgent',
      agentVersion: { versionId: 'v-123' },
      params: { messages },
    });
    await drainStream(stream);

    expect(capture.systemPrompt).toContain(STORED_INSTRUCTIONS);
    expect(editor.agent.applyStoredOverrides).toHaveBeenCalledTimes(1);
    expect(editor.agent.applyStoredOverrides.mock.calls[0]![1]).toEqual({ versionId: 'v-123' });
  });

  it('threads requestContext through to the editor override resolution', async () => {
    const capture: { systemPrompt: string | undefined } = { systemPrompt: undefined };
    const editor = createEditorStub(STORED_INSTRUCTIONS);
    const mastra = createMastra(createCodeAgent(capture, ''), editor);

    const requestContext = new RequestContext([['tenant', 'acme']]);
    const stream = await handleChatStream({ mastra, agentId: 'weatherAgent', params: { messages, requestContext } });
    await drainStream(stream);

    expect(editor.agent.applyStoredOverrides).toHaveBeenCalledTimes(1);
    expect(editor.agent.applyStoredOverrides.mock.calls[0]![2]).toBe(requestContext);
  });

  it('keeps the code instructions when the editor has no stored config', async () => {
    const capture: { systemPrompt: string | undefined } = { systemPrompt: undefined };
    // storedInstructions: null → editor returns the code agent unchanged.
    const editor = createEditorStub(null);
    const mastra = createMastra(createCodeAgent(capture, CODE_INSTRUCTIONS), editor);

    const stream = await handleChatStream({ mastra, agentId: 'weatherAgent', params: { messages } });
    await drainStream(stream);

    expect(capture.systemPrompt).toContain(CODE_INSTRUCTIONS);
    expect(editor.agent.applyStoredOverrides).toHaveBeenCalledTimes(1);
  });

  it('leaves the code instructions untouched when no editor is configured', async () => {
    const capture: { systemPrompt: string | undefined } = { systemPrompt: undefined };
    const mastra = createMastra(createCodeAgent(capture, CODE_INSTRUCTIONS));

    const stream = await handleChatStream({ mastra, agentId: 'weatherAgent', params: { messages } });
    await drainStream(stream);

    expect(capture.systemPrompt).toContain(CODE_INSTRUCTIONS);
  });
});
