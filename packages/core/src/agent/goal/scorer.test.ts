import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { createMockModel } from '../../test-utils/llm-mock';
import { createTool } from '../../tools';
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

  it('defaults the judge config to inline JSON prompt injection', () => {
    const scorer = createGoalScorer({ judgeModel });
    expect(scorer.config.judge?.jsonPromptInjection).toBe('inline');
  });

  it('forwards explicit jsonPromptInjection to the judge config', () => {
    const scorer = createGoalScorer({ judgeModel, jsonPromptInjection: 'system' });
    expect(scorer.config.judge?.jsonPromptInjection).toBe('system');
  });
});

describe('createGoalScorer JSON prompt injection', () => {
  async function runWithInjectedJson(decision: 'done' | 'continue' | 'waiting', reason: string) {
    const streamCalls: any[] = [];
    const model = createMockModel({
      mockText: { decision, reason },
      version: 'v2',
      spyStream: props => streamCalls.push(props),
    });
    const scorer = createGoalScorer({ judgeModel: model as any, jsonPromptInjection: true });

    const result = await scorer.run({
      input: { originalTask: 'do the thing', currentText: 'I did the thing' },
      output: 'I did the thing',
    } as any);

    expect(JSON.stringify(streamCalls[0]?.prompt)).toContain('JSON schema');
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

  it('falls back to generate when prompt-injection streaming produces no object', async () => {
    const generateCalls: any[] = [];
    const streamCalls: any[] = [];
    const model = new MockLanguageModelV2({
      doStream: async props => {
        streamCalls.push(props);
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
            { type: 'finish', finishReason: 'stop', usage: { inputTokens: 10, outputTokens: 0, totalTokens: 10 } },
          ]),
        };
      },
      doGenerate: async props => {
        generateCalls.push(props);
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          finishReason: 'stop',
          usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          content: [{ type: 'text', text: '{"decision":"done","reason":"generated fallback"}' }],
          warnings: [],
        };
      },
    });
    const scorer = createGoalScorer({ judgeModel: model as any, jsonPromptInjection: true });

    const result = await scorer.run({
      input: { originalTask: 'do the thing', currentText: 'I did the thing' },
      output: 'I did the thing',
    } as any);

    expect(streamCalls.length).toBeGreaterThan(0);
    expect(generateCalls.length).toBeGreaterThan(0);
    expect(result.score).toBe(1);
    expect(result.reason).toBe('generated fallback');
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
