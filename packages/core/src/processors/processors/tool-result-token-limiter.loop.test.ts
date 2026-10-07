import type { LanguageModelV2Prompt } from '@ai-sdk/provider-v5';
import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { estimateTokenCount } from 'tokenx';
import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { Agent } from '../../agent';
import type { MastraDBMessage } from '../../memory';
import { MockMemory } from '../../memory/mock';
import { InMemoryStore } from '../../storage';
import { createTool } from '../../tools';
import { TokenLimiterProcessor } from './token-limiter';
import { ToolResultTokenLimiter } from './tool-result-token-limiter';

// Reporter's shape from #24110: TokenLimiterProcessor budget of 500 and a tool
// returning ~200 rules. The sentinel sits at the start so it survives truncation.
const BUDGET = 500;
const CAP = 300;
const SENTINEL = 'SENTINEL-7Q';
const RULES = [
  `${SENTINEL}: guests must register`,
  ...Array.from({ length: 200 }, (_, i) => `Rule ${i + 1}: guests must keep noise down after 10pm in common areas.`),
].join('\n');

// Mirrors TokenLimiterProcessor's prompt accounting (token-limiter.ts: TOKENS_PER_MESSAGE = 3.8,
// TOKENS_PER_CONVERSATION = 24, countPromptMessageTokens) so the fit assertion uses its numbers.
const TOKENS_PER_MESSAGE = 3.8;
const TOKENS_PER_CONVERSATION = 24;
function countPromptMessage(message: LanguageModelV2Prompt[number]): number {
  if (message.role === 'system') return estimateTokenCount(message.role + message.content) + TOKENS_PER_MESSAGE;
  let text: string = message.role;
  let overhead = TOKENS_PER_MESSAGE;
  for (const part of message.content as any[]) {
    if (part.type === 'text' || part.type === 'reasoning') text += part.text;
    else if (part.type === 'tool-call') {
      text += part.toolName;
      if (typeof part.input === 'string') text += part.input;
      else if (part.input !== undefined) {
        text += JSON.stringify(part.input);
        overhead -= 12;
      }
    } else if (part.type === 'tool-result') {
      if (part.output.type === 'text' || part.output.type === 'error-text') text += part.output.value;
      else {
        text += JSON.stringify(part.output.value);
        overhead -= 12;
      }
    }
  }
  return estimateTokenCount(text) + overhead;
}

const toolResultText = (prompt: LanguageModelV2Prompt) =>
  prompt
    .filter(m => m.role === 'tool')
    .flatMap(m => m.content as any[])
    .filter(p => p.type === 'tool-result')
    .map(p => (typeof p.output.value === 'string' ? p.output.value : JSON.stringify(p.output.value)));

function makeModel(prompts: LanguageModelV2Prompt[]) {
  return new MockLanguageModelV2({
    doStream: async ({ prompt }) => {
      prompts.push(prompt);
      // Answer only once the tool result with the sentinel reached the prompt, and
      // read the answer from that result rather than from a fixture.
      const seen = toolResultText(prompt).find(text => text.includes(SENTINEL));
      const callId = `call-${prompts.length}`;
      const parts = seen
        ? [
            { type: 'text-start', id: 't' },
            { type: 'text-delta', id: 't', delta: `Answer: ${seen.match(/SENTINEL-\w+/)![0]}` },
            { type: 'text-end', id: 't' },
            { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
          ]
        : [
            { type: 'tool-call', toolCallId: callId, toolName: 'listRules', input: '{}' },
            { type: 'finish', finishReason: 'tool-calls', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
          ];
      return {
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: `r-${prompts.length}`, modelId: 'mock', timestamp: new Date(0) },
          ...parts,
        ] as any),
      };
    },
  });
}

async function runHarness(history: MastraDBMessage[] = []) {
  const prompts: LanguageModelV2Prompt[] = [];
  let executions = 0;
  const storage = new InMemoryStore();
  const memory = new MockMemory({ storage });
  const threadId = 'thread-24110';
  const resourceId = 'user-24110';
  await memory.saveThread({ thread: { id: threadId, resourceId, createdAt: new Date(), updatedAt: new Date() } });
  if (history.length) await memory.saveMessages({ messages: history });

  const agent = new Agent({
    id: 'rules-agent',
    name: 'rules-agent',
    instructions: 'Answer.',
    model: makeModel(prompts),
    memory,
    tools: {
      listRules: createTool({
        id: 'listRules',
        description: 'List the house rules',
        inputSchema: z.object({}),
        execute: async () => {
          executions++;
          return RULES;
        },
      }),
    },
    inputProcessors: [new TokenLimiterProcessor(BUDGET)],
    outputProcessors: [new ToolResultTokenLimiter({ limit: CAP })],
  });

  const stream = await agent.stream('How many house rules are there?', {
    maxSteps: 8,
    memory: { thread: threadId, resource: resourceId },
  });
  const text = await stream.text;
  const { messages: persisted } = await memory.recall({ threadId, resourceId });
  return { prompts, executions, text, persisted };
}

const storedToolResults = (messages: MastraDBMessage[]) =>
  messages.flatMap(m =>
    m.content.parts.flatMap(p =>
      p.type === 'tool-invocation' && p.toolInvocation.state === 'result' ? [p.toolInvocation] : [],
    ),
  );

describe('ToolResultTokenLimiter with TokenLimiterProcessor (#24110)', () => {
  it('keeps the current tool result in the prompt so the model answers instead of re-calling', async () => {
    const { prompts, executions, text, persisted } = await runHarness();

    expect(prompts).toHaveLength(2);
    expect(executions).toBe(1);

    const second = prompts[1]!;
    const call = second
      .flatMap(m => (m.role === 'assistant' ? (m.content as any[]) : []))
      .find(p => p.type === 'tool-call');
    const toolMessage = second.find(m => m.role === 'tool')!;
    const resultPart = (toolMessage.content as any[]).find(p => p.type === 'tool-result');
    expect(call.toolCallId).toBe(resultPart.toolCallId);
    expect(toolResultText(second)[0]).toMatch(/\[truncated: showing [\d,]+ of [\d,]+ tokens\]$/);

    const systemTokens = second.filter(m => m.role === 'system').reduce((n, m) => n + countPromptMessage(m), 0);
    expect(systemTokens).toBeLessThan(100);
    const remainingBudget = BUDGET - systemTokens - TOKENS_PER_CONVERSATION;
    const assistantMessage = second.find(
      m => m.role === 'assistant' && (m.content as any[]).some(p => p.type === 'tool-call'),
    )!;
    expect(countPromptMessage(assistantMessage) + countPromptMessage(toolMessage)).toBeLessThanOrEqual(remainingBudget);

    expect(text).toContain(SENTINEL);

    expect(persisted).toHaveLength(2);
    expect(persisted.map(m => m.role)).toEqual(['user', 'assistant']);
    const stored = storedToolResults(persisted);
    expect(stored).toHaveLength(1);
    // The stored result stays whole; only the model-facing copy is capped.
    expect(stored[0]!.result).toBe(RULES);
    const storedPart = persisted
      .flatMap(m => m.content.parts)
      .find(p => p.type === 'tool-invocation' && p.toolInvocation.state === 'result') as any;
    expect(storedPart.providerMetadata.mastra.modelOutput.value).toMatch(
      /\[truncated: showing [\d,]+ of [\d,]+ tokens\]$/,
    );
  });

  it('still trims older oversized tool results from history', async () => {
    const OLD = 'OLD-PAYLOAD';
    const history: MastraDBMessage[] = [
      {
        id: 'old-user',
        role: 'user',
        threadId: 'thread-24110',
        resourceId: 'user-24110',
        createdAt: new Date('2024-01-01T00:00:00Z'),
        content: { format: 2, parts: [{ type: 'text', text: 'Earlier question' }] },
      },
      {
        id: 'old-assistant',
        role: 'assistant',
        threadId: 'thread-24110',
        resourceId: 'user-24110',
        createdAt: new Date('2024-01-01T00:01:00Z'),
        content: {
          format: 2,
          parts: [
            {
              type: 'tool-invocation',
              toolInvocation: {
                state: 'result',
                toolCallId: 'old-call',
                toolName: 'listRules',
                args: {},
                result: `${OLD} ` + 'filler '.repeat(2000),
              },
            },
          ],
        },
      },
    ];

    const { prompts, text } = await runHarness(history);
    const last = JSON.stringify(prompts.at(-1));
    expect(last).not.toContain('old-call');
    expect(last).not.toContain(OLD);
    expect(toolResultText(prompts.at(-1)!).some(t => t.includes(SENTINEL))).toBe(true);
    expect(text).toContain(SENTINEL);
  });
});
