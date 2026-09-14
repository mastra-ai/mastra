import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import { createScorer } from '../../evals/base';
import { createMockModel } from '../../test-utils/llm-mock';
import { createTool } from '../../tools';
import type { MastraDBMessage, MastraMessageContentV2 } from '../message-list';
import { DEFAULT_GOAL_JUDGE_PROMPT, GOAL_SCORE_WAITING } from './objective';
import { createGoalScorer } from './scorer';

const judgeModel = 'openai/gpt-4o-mini';

/** Run the default goal scorer with a judge model scripted to return `decision`. */
async function runWithDecision(decision: 'done' | 'continue' | 'waiting', reason = 'because') {
  const scorer = createGoalScorer({
    judgeModel: createMockModel({ objectGenerationMode: 'json', mockText: { decision, reason } }) as any,
  });
  return scorer.run({
    input: { originalTask: 'do the thing', currentText: 'I did the thing' },
    output: 'I did the thing',
  } as any);
}

const viewTool = createTool({
  id: 'view',
  description: 'read a file',
  inputSchema: z.object({ path: z.string() }),
  execute: async () => ({ content: '' }),
});

function createUserMessage(content: MastraMessageContentV2): MastraDBMessage {
  return {
    id: 'msg-user',
    role: 'user',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    content,
  };
}

function createSignalMessage(content: MastraMessageContentV2, id = 'msg-signal'): MastraDBMessage {
  return {
    id,
    role: 'signal',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    type: 'user',
    content,
  };
}

async function captureJudgePromptForMessages(messages: MastraDBMessage[]) {
  let prompt = '';
  const scorer = createGoalScorer({
    judgeModel: createMockModel({
      objectGenerationMode: 'json',
      mockText: { decision: 'continue', reason: 'keep going' },
      spyGenerate: props => {
        prompt = JSON.stringify(props.prompt);
      },
      spyStream: props => {
        prompt = JSON.stringify(props.prompt);
      },
    }) as any,
  });

  await scorer.run({
    input: { originalTask: 'do the thing', currentText: 'still working', messages },
    output: 'still working',
  } as any);

  return prompt;
}

describe('createGoalScorer latest user message text extraction', () => {
  it('includes text from DB-shaped latest user content instead of stringifying the object', async () => {
    const prompt = await captureJudgePromptForMessages([
      createUserMessage({ format: 2, parts: [{ type: 'text', text: 'actual user text' }] }),
    ]);

    expect(prompt).toContain('Latest user message');
    expect(prompt).toContain('actual user text');
    expect(prompt).not.toContain('[object Object]');
  });

  it('joins all DB-shaped text parts from the latest user content with newlines', async () => {
    const prompt = await captureJudgePromptForMessages([
      createUserMessage({
        format: 2,
        parts: [
          { type: 'text', text: 'first text part' },
          { type: 'text', text: 'second text part' },
        ],
      }),
    ]);

    expect(prompt).toContain('first text part\\nsecond text part');
    expect(prompt).not.toContain('[object Object]');
  });

  it('uses user signal rows as latest user content for signal-delivered messages', async () => {
    const prompt = await captureJudgePromptForMessages([
      createUserMessage({ format: 2, parts: [{ type: 'text', text: 'previous user text' }] }),
      createSignalMessage({
        format: 2,
        parts: [{ type: 'text', text: 'received your message user' }],
        metadata: { signal: { type: 'user', tagName: 'user' } },
      }),
    ]);

    expect(prompt).toContain('received your message user');
    expect(prompt).not.toContain('previous user text');
    expect(prompt).not.toContain('[object Object]');
  });

  it('skips synthetic system reminders when selecting the latest user content', async () => {
    const prompt = await captureJudgePromptForMessages([
      createUserMessage({ format: 2, parts: [{ type: 'text', text: 'actual human message' }] }),
      createUserMessage({
        format: 2,
        parts: [{ type: 'text', text: '<system-reminder>Please continue naturally</system-reminder>' }],
      }),
    ]);

    expect(prompt).toContain('actual human message');
    expect(prompt).not.toContain('<system-reminder>Please continue naturally</system-reminder>');
  });

  it('skips empty user rows when selecting the latest user content', async () => {
    const prompt = await captureJudgePromptForMessages([
      createUserMessage({ format: 2, parts: [{ type: 'text', text: 'actual human message' }] }),
      createUserMessage({ format: 2, parts: [{ type: 'text', text: '' }] }),
    ]);

    expect(prompt).toContain('actual human message');
  });
});

describe('createGoalScorer tool support', () => {
  it('omits tools from the judge config by default (portable, text-only)', () => {
    const scorer = createGoalScorer({ judgeModel });
    expect(scorer.config.judge?.tools).toBeUndefined();
  });

  it('does not append the verify-with-tools clause when no tools are provided', () => {
    const scorer = createGoalScorer({ judgeModel });
    expect(scorer.config.judge?.instructions).toBe(DEFAULT_GOAL_JUDGE_PROMPT);
  });

  it('forwards provided tools to the judge config', () => {
    const scorer = createGoalScorer({ judgeModel, tools: { view: viewTool } });
    expect(scorer.config.judge?.tools).toBeDefined();
    expect(Object.keys(scorer.config.judge!.tools!)).toContain('view');
  });

  it('does not modify the judge instructions when tools are present (tools are forwarded, instructions stay as-is)', () => {
    const scorer = createGoalScorer({ judgeModel, tools: { view: viewTool } });
    const instructions = scorer.config.judge?.instructions ?? '';
    expect(instructions).toBe(DEFAULT_GOAL_JUDGE_PROMPT);
  });

  it('treats an empty tools object as no tools (no clause, no judge tools)', () => {
    const scorer = createGoalScorer({ judgeModel, tools: {} });
    expect(scorer.config.judge?.tools).toBeUndefined();
    expect(scorer.config.judge?.instructions).toBe(DEFAULT_GOAL_JUDGE_PROMPT);
  });

  it('respects a custom prompt without modifying it when tools are present', () => {
    const customPrompt = 'Custom judge prompt.';
    const scorer = createGoalScorer({ judgeModel, prompt: customPrompt, tools: { view: viewTool } });
    const instructions = scorer.config.judge?.instructions ?? '';
    expect(instructions).toBe(customPrompt);
  });
});

describe('createGoalScorer native structured output', () => {
  it.each([undefined, 'Custom judge prompt.'])(
    'keeps native output on the first attempt without handwritten JSON instructions (prompt: %s)',
    async prompt => {
      const model = new MockLanguageModelV2({
        provider: 'crof',
        modelId: 'glm-5.3-flash',
        doStream: async () => ({
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'text-start', id: 'verdict' },
            {
              type: 'text-delta',
              id: 'verdict',
              delta: JSON.stringify({ decision: 'continue', reason: 'Tests have not run.' }),
            },
            { type: 'text-end', id: 'verdict' },
            { type: 'finish', finishReason: 'stop', usage: { inputTokens: 10, outputTokens: 10, totalTokens: 20 } },
          ]),
        }),
      });
      const stream = vi.spyOn(model, 'doStream');
      const scorer = createGoalScorer({ judgeModel: model, prompt });
      const result = await scorer.run({
        input: { originalTask: 'Update documentation and run tests.', currentText: 'Documentation is updated.' },
        output: 'Documentation is updated.',
      });

      expect(result.score).toBe(0);
      expect(result.reason).toBe('Tests have not run.');
      expect(stream).toHaveBeenCalledTimes(1);
      const request = stream.mock.calls[0]![0];
      expect(request.responseFormat).toMatchObject({ type: 'json', schema: { required: ['decision', 'reason'] } });
      const userMessage = request.prompt.findLast(message => message.role === 'user');
      expect(JSON.stringify(userMessage?.content)).not.toContain('Return your final verdict as a JSON object');
      expect(JSON.stringify(request.prompt)).not.toContain('Return your response as JSON matching this schema');
      expect(scorer.config.judge?.instructions).toBe(prompt ?? DEFAULT_GOAL_JUDGE_PROMPT);
    },
  );
});

describe('goal-only JSON fallback placement', () => {
  const instruction = 'Return your response as JSON matching this schema';

  it.each([
    { goal: true, withTools: false },
    { goal: true, withTools: true },
    { goal: false, withTools: false },
    { goal: false, withTools: true },
  ])('keeps native first and scopes inline fallback (goal: $goal, tools: $withTools)', async ({ goal, withTools }) => {
    let calls = 0;
    const attemptLength = withTools ? 2 : 1;
    const model = new MockLanguageModelV2({
      provider: 'crof',
      modelId: 'glm-5.3-flash',
      doStream: async () => {
        calls++;
        const toolCall = withTools && calls % 2 === 1;
        return {
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            ...(toolCall
              ? [
                  {
                    type: 'tool-call' as const,
                    toolCallId: `view-${calls}`,
                    toolName: 'view',
                    input: '{"path":"README.md"}',
                  },
                ]
              : [
                  { type: 'text-start' as const, id: 'verdict' },
                  {
                    type: 'text-delta' as const,
                    id: 'verdict',
                    delta:
                      calls <= attemptLength
                        ? '**Decision: continue**\nTests have not run.'
                        : JSON.stringify({ decision: 'continue', reason: 'Tests have not run.' }),
                  },
                  { type: 'text-end' as const, id: 'verdict' },
                ]),
            {
              type: 'finish',
              finishReason: toolCall ? 'tool-calls' : 'stop',
              usage: { inputTokens: 10, outputTokens: 10, totalTokens: 20 },
            },
          ]),
        };
      },
    });
    const stream = vi.spyOn(model, 'doStream');
    const tools = withTools ? { view: viewTool } : undefined;
    const scorer = goal
      ? createGoalScorer({ judgeModel: model, prompt: 'Custom judge prompt.', tools })
      : createScorer({
          id: 'ordinary-scorer',
          description: 'Review documentation',
          judge: { model, instructions: 'Custom judge prompt.', tools },
        })
          .analyze({
            description: 'Review the work',
            outputSchema: z.object({ decision: z.enum(['done', 'continue', 'waiting']), reason: z.string() }),
            createPrompt: () => 'Review the documentation and tests.',
          })
          .generateScore(() => 0);

    const result = await scorer.run({
      input: { originalTask: 'Update documentation and run tests.', currentText: 'Documentation is updated.' },
      output: 'Documentation is updated.',
    });
    expect(result.score).toBe(0);
    expect(stream).toHaveBeenCalledTimes(attemptLength * 2);
    for (const [request] of stream.mock.calls.slice(0, attemptLength)) {
      expect(request.responseFormat).toMatchObject({ type: 'json' });
      expect(JSON.stringify(request.prompt)).not.toContain(instruction);
      expect(JSON.stringify(request.prompt)).not.toContain('Return your final verdict as a JSON object');
    }
    for (const [request] of stream.mock.calls.slice(attemptLength)) {
      expect(request.responseFormat).toBeUndefined();
      const user = request.prompt.findLast(message => message.role === 'user');
      const system = request.prompt.filter(message => message.role === 'system');
      expect(JSON.stringify(user)).toContain(goal ? instruction : 'Review the documentation');
      if (goal) {
        expect(JSON.stringify(system)).not.toContain('JSON schema:');
        expect(JSON.stringify(system)).not.toContain(instruction);
      } else {
        expect(JSON.stringify(user)).not.toContain(instruction);
        expect(JSON.stringify(system)).toContain(
          'You MUST answer with a JSON object that matches the JSON schema above.',
        );
      }
    }
    if (withTools) {
      expect(stream.mock.calls.at(-1)![0].prompt.some(message => message.role === 'tool')).toBe(true);
    }
  });

  it.each(['**Decision: done**', '{"decision":"invalid","reason":"because"}'])(
    'rejects invalid fallback output without inventing a verdict: %s',
    async text => {
      const model = new MockLanguageModelV2({
        provider: 'crof',
        modelId: 'glm-5.3-flash',
        doStream: async () => ({
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'text-start', id: 'verdict' },
            { type: 'text-delta', id: 'verdict', delta: text },
            { type: 'text-end', id: 'verdict' },
            { type: 'finish', finishReason: 'stop', usage: { inputTokens: 10, outputTokens: 10, totalTokens: 20 } },
          ]),
        }),
      });
      const stream = vi.spyOn(model, 'doStream');
      const scorer = createGoalScorer({ judgeModel: model });
      await expect(scorer.run({ input: 'Update docs', output: 'Done' })).rejects.toThrow(
        'Structured output validation failed',
      );
      expect(stream).toHaveBeenCalledTimes(2);
    },
  );
});

describe('createGoalScorer JSON prompt injection', () => {
  async function runWithInjectedJson(decision: 'done' | 'continue' | 'waiting', reason: string) {
    const streamCalls: any[] = [];
    const model = createMockModel({
      mockText: { decision, reason },
      version: 'v2',
      spyStream: props => streamCalls.push(props),
    });
    const scorer = createGoalScorer({ judgeModel: model as any });

    const result = await scorer.run({
      input: { originalTask: 'do the thing', currentText: 'I did the thing' },
      output: 'I did the thing',
    } as any);

    expect(JSON.stringify(streamCalls[0]?.prompt)).toContain('Return your response as JSON matching this schema');
    expect(streamCalls.every(call => call.responseFormat === undefined)).toBe(true);
    return result;
  }

  it('parses JSON prompt injection text through the structured output pipeline', async () => {
    const result = await runWithInjectedJson('done', 'all requirements met');
    expect(result.score).toBe(1);
    expect(result.reason).toBe('all requirements met');
  });

  it('preserves the waiting score when JSON prompt injection text returns waiting', async () => {
    const result = await runWithInjectedJson('waiting', 'waiting for approval');
    expect(result.score).toBe(GOAL_SCORE_WAITING);
    expect(result.reason).toBe('waiting for approval');
  });
});

describe('createGoalScorer tri-state decision → score mapping', () => {
  it('maps "done" to score 1 (goal complete)', async () => {
    const result = await runWithDecision('done', 'all requirements met');
    expect(result.score).toBe(1);
    expect(result.reason).toBe('all requirements met');
  });

  it('maps "continue" to score 0 (keep working)', async () => {
    const result = await runWithDecision('continue', 'still need to add tests');
    expect(result.score).toBe(0);
    expect(result.reason).toBe('still need to add tests');
  });

  it('maps "waiting" to the GOAL_SCORE_WAITING signal (parked for user)', async () => {
    const result = await runWithDecision('waiting', 'waiting for your review');
    expect(result.score).toBe(GOAL_SCORE_WAITING);
    // The waiting score must be distinct from both complete (1) and continue (0)
    // so the goal step can detect it without colliding with those paths.
    expect(result.score).not.toBe(1);
    expect(result.score).not.toBe(0);
    expect(result.reason).toBe('waiting for your review');
  });
});
