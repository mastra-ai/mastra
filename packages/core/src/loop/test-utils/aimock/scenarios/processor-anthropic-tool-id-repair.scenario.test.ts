import { createAnthropic } from '@ai-sdk/anthropic-v5';
import { describe, expect, it } from 'vitest';
import { Agent } from '../../../../agent';
import { MockMemory } from '../../../../memory/mock';
import { useLoopScenarioAimock } from '../aimock-scenario';
import { SCENARIO_MODEL_ID } from '../types';

/**
 * Story: a conversation carries a tool call id Anthropic rejects (`call.abc:1`), for example after
 * switching from another provider. The default ProviderHistoryCompat processor must send Anthropic
 * a sanitized id while leaving the caller's messages and the saved thread untouched. If this
 * breaks, Anthropic rejects the request or stored history is rewritten.
 *
 * Runs on the plain agent only: the history is passed as a message array, which the shared
 * harness (string prompts) cannot express.
 */

const historyWithInvalidToolId = () => [
  { role: 'user' as const, content: 'search for this' },
  {
    role: 'assistant' as const,
    content: [
      { type: 'text' as const, text: 'Searching.' },
      { type: 'tool-call' as const, toolCallId: 'call.abc:1', toolName: 'search', input: { query: 'Mastra' } },
    ],
  },
  {
    role: 'tool' as const,
    content: [
      {
        type: 'tool-result' as const,
        toolCallId: 'call.abc:1',
        toolName: 'search',
        output: { type: 'text' as const, value: 'result' },
      },
    ],
  },
  { role: 'user' as const, content: 'thanks' },
];

/** Every tool id the value carries, wherever the shape stores it. */
const toolIds = (value: unknown): string[] => JSON.stringify(value).match(/call[._][A-Za-z0-9_:.]+/g) ?? [];

describe('Anthropic tool id repair is prompt-scoped', () => {
  const getMock = useLoopScenarioAimock();

  const anthropicAgent = (config: Record<string, unknown> = {}) => {
    const llm = getMock();
    llm.on({ endpoint: 'chat' }, { content: 'ok' });
    // aimock normalizes Anthropic requests to chat format, so capture the raw wire body.
    const sentBodies: unknown[] = [];
    const model = createAnthropic({
      apiKey: 'test',
      baseURL: `${llm.url.replace(/\/+$/, '')}/v1`,
      fetch: async (url, init) => {
        sentBodies.push(JSON.parse(init!.body as string));
        return fetch(url, init);
      },
    })(SCENARIO_MODEL_ID);
    const agent = new Agent({
      id: 'tool-id-repair-agent',
      name: 'Tool Id Repair Agent',
      instructions: 'test',
      model,
      ...config,
    });
    return { agent, sentBodies };
  };

  it('sends sanitized ids on a bare agent without rewriting the caller history', async () => {
    const { agent, sentBodies } = anthropicAgent();
    const history = historyWithInvalidToolId();
    const before = structuredClone(history);

    const result = await agent.generate(history as never);

    expect(result.text).toBe('ok');
    expect(sentBodies).toHaveLength(1);
    expect(history).toEqual(before);
    expect(toolIds(sentBodies[0])).toEqual(['call_abc_1', 'call_abc_1']);
  });

  it('keeps the original ids in the saved thread', async () => {
    const memory = new MockMemory();
    const threadId = 'tool-id-repair-thread';
    const resourceId = 'tool-id-repair-resource';
    await memory.createThread({ threadId, resourceId });
    const { agent, sentBodies } = anthropicAgent({ memory });

    await agent.generate(historyWithInvalidToolId() as never, { memory: { thread: threadId, resource: resourceId } });

    expect(toolIds(sentBodies[0])).toEqual(['call_abc_1', 'call_abc_1']);
    const { messages } = await memory.recall({ threadId, resourceId, perPage: false });
    expect(toolIds(messages)).toEqual(['call.abc:1', 'call.abc:1']);
  });

  it('sends the ids unchanged when the call replaces the error processors with an empty list', async () => {
    const { agent, sentBodies } = anthropicAgent();

    await agent.generate(historyWithInvalidToolId() as never, { errorProcessors: [] });

    // `errorProcessors: []` at call time replaces the resolved list, defaults included.
    expect(toolIds(sentBodies[0])).toEqual(['call.abc:1', 'call.abc:1']);
  });
});
