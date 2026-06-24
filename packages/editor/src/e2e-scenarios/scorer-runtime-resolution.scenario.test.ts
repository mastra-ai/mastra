import { describe, expect, it } from 'vitest';
import { MastraModelGateway, type ProviderConfig } from '@mastra/core/llm';
import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import type { LanguageModelV2 } from '@internal/ai-sdk-v5';
import { createEditorScenarioMastra } from './editor-scenario-utils';

class ScorerScenarioGateway extends MastraModelGateway {
  readonly id = 'models.dev';
  readonly name = 'Scorer Scenario Gateway';

  async fetchProviders(): Promise<Record<string, ProviderConfig>> {
    return {
      mock: { name: 'Mock Provider', models: ['scorer-scenario'], apiKeyEnvVar: 'MOCK_API_KEY', gateway: 'models.dev' },
    };
  }

  buildUrl(): string {
    return 'https://example.invalid/v1';
  }

  async getApiKey(): Promise<string> {
    return 'test-key';
  }

  async resolveLanguageModel(): Promise<LanguageModelV2> {
    let call = 0;
    return new MockLanguageModelV2({
      provider: 'mock',
      modelId: 'scorer-scenario',
      supportedUrls: {},
      doGenerate: async () => {
        call += 1;
        const text = call === 1 ? JSON.stringify({ score: 0.92 }) : 'The response directly answers the user.';
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          finishReason: 'stop',
          usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
          content: [{ type: 'text', text }],
          warnings: [],
        };
      },
      doStream: async () => {
        call += 1;
        const text = call === 1 ? JSON.stringify({ score: 0.92 }) : 'The response directly answers the user.';
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: `scenario-${call}`, modelId: 'scorer-scenario', timestamp: new Date(0) },
            { type: 'text-start', id: `text-${call}` },
            { type: 'text-delta', id: `text-${call}`, delta: text },
            { type: 'text-end', id: `text-${call}` },
            { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
          ]),
        };
      },
    });
  }
}

describe('editor e2e scenario: scorer runtime resolution', () => {
  it('persists an LLM-judge scorer, resolves it to runtime, and executes scoring', async () => {
    // USER STORY: A Studio user configures a scorer and expects evaluations to use the stored model and rubric.
    // ARRANGE
    const { editor } = createEditorScenarioMastra({
      gateways: { 'models.dev': new ScorerScenarioGateway() },
    });

    // ACT
    const stored = await editor.scorer.create({
      id: 'answer-quality',
      name: 'Answer Quality',
      type: 'llm-judge',
      model: { provider: 'mock', name: 'scorer-scenario' },
      instructions: 'Score whether the assistant directly answers the user.',
      scoreRange: { min: 0, max: 1 },
    });
    const scorer = editor.scorer.resolve(stored);
    const result = await scorer!.run({
      runId: 'scenario-run',
      input: [{ id: 'input-1', role: 'user', content: 'What is TypeScript?', createdAt: new Date() }],
      output: [
        { id: 'output-1', role: 'assistant', content: 'TypeScript is typed JavaScript.', createdAt: new Date() },
      ],
    } as never);

    // ASSERT
    expect(scorer!.id).toBe('answer-quality');
    expect(result.score).toBe(0.92);
    expect(result.reason).toBe('The response directly answers the user.');
  });
});
