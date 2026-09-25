import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { Mastra } from '../../mastra';
import { MockMemory } from '../../memory/mock';
import { TokenLimiterProcessor } from '../../processors';
import type { Processor } from '../../processors';
import { TaskSignalProvider } from '../../signals';
import { InMemoryStore } from '../../storage';
import { createTool } from '../../tools';
import { Agent } from '../agent';
import { convertArrayToReadableStream, MockLanguageModelV2 } from './mock-model';

const PROCESSOR_SYSTEM = 'System message added by processInput';

function systemTexts(prompt: any[]): string[] {
  return prompt
    .filter(m => m.role === 'system')
    .map(m => (typeof m.content === 'string' ? m.content : JSON.stringify(m.content)));
}

function setup(inputProcessors: Processor[], extra: Record<string, unknown> = {}) {
  const prompts: any[][] = [];
  let callCount = 0;
  const model = new MockLanguageModelV2({
    doStream: async ({ prompt }) => {
      prompts.push(prompt as any[]);
      callCount++;
      const chunks: any[] =
        callCount === 1
          ? [
              { type: 'tool-call', toolCallId: 'call-1', toolName: 'lookup', input: '{"q":"x"}' },
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
          { type: 'response-metadata', id: `id-${callCount}`, modelId: 'mock', timestamp: new Date(0) },
          ...chunks,
        ]),
      };
    },
  });

  const lookup = createTool({
    id: 'lookup',
    description: 'lookup',
    inputSchema: z.object({ q: z.string() }),
    requireApproval: true,
    execute: async () => ({ ok: true }),
  });

  const agent = new Agent({
    id: 'agent',
    name: 'agent',
    instructions: 'Base instructions',
    model,
    tools: { lookup },
    inputProcessors,
    ...extra,
  });
  const mastra = new Mastra({ agents: { agent }, logger: false, storage: new InMemoryStore() });
  return { agent: mastra.getAgent('agent'), prompts };
}

async function runWithApproval(agent: Agent, options: Record<string, unknown> = {}) {
  const stream = await agent.stream('hello', { requireToolApproval: true, ...options });
  let toolCallId = '';
  for await (const chunk of stream.fullStream) {
    if (chunk.type === 'tool-call-approval') toolCallId = chunk.payload.toolCallId;
  }
  expect(toolCallId).toBeTruthy();
  const resumed = await agent.approveToolCall({ runId: stream.runId, toolCallId });
  for await (const _chunk of resumed.fullStream) {
    // consume
  }
  return resumed;
}

describe('resumed runs keep input processor system messages', () => {
  it('replays processInput system messages after approveToolCall', async () => {
    const processor: Processor = {
      id: 'adds-system',
      processInput: ({ messages, systemMessages }) => ({
        messages,
        systemMessages: [...systemMessages, { role: 'system', content: PROCESSOR_SYSTEM }],
      }),
    };
    const { agent, prompts } = setup([processor]);
    await runWithApproval(agent);

    expect(prompts).toHaveLength(2);
    expect(systemTexts(prompts[0]!)).toContain(PROCESSOR_SYSTEM);
    expect(systemTexts(prompts[1]!)).toEqual(systemTexts(prompts[0]!));
  });

  it('keeps system message replacements and tags on resume', async () => {
    const processor: Processor = {
      id: 'replaces-and-tags',
      processInput: ({ messages, messageList }) => {
        messageList.addSystem({ role: 'system', content: 'Tagged guidance' }, 'guidance');
        return { messages, systemMessages: [{ role: 'system', content: 'Replaced instructions' }] };
      },
    };
    const { agent, prompts } = setup([processor]);
    await runWithApproval(agent);

    expect(prompts).toHaveLength(2);
    expect(systemTexts(prompts[0]!)).toEqual(['Replaced instructions', 'Tagged guidance']);
    expect(systemTexts(prompts[1]!)).toEqual(systemTexts(prompts[0]!));
  });

  it('does not trip TokenLimiterProcessor on resume', async () => {
    const { agent, prompts } = setup([new TokenLimiterProcessor({ limit: 1000 })]);
    const resumed = await runWithApproval(agent);
    expect(prompts).toHaveLength(2);
    expect(await resumed.text).toBe('done');
  });

  it('keeps the TaskStateProcessor instruction on resume', async () => {
    const { agent, prompts } = setup([], { signals: [new TaskSignalProvider()], memory: new MockMemory() });
    await runWithApproval(agent, { memory: { thread: 'thread-1', resource: 'user-1' } });

    expect(prompts).toHaveLength(2);
    const hasInstruction = (prompt: any[]) => systemTexts(prompt).some(t => t.includes('<current-task-list'));
    expect(hasInstruction(prompts[0]!)).toBe(true);
    expect(hasInstruction(prompts[1]!)).toBe(true);
    expect(systemTexts(prompts[1]!)).toEqual(systemTexts(prompts[0]!));
  });
});
