import { Mastra } from '@mastra/core';
import { MastraModelGateway, type ProviderConfig } from '@mastra/core/llm';
import { InMemoryStore } from '@mastra/core/storage';
import type { LanguageModelV2 } from '@internal/ai-sdk-v5';
import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { MastraEditor } from '../index';

type MastraScenarioConfig = NonNullable<ConstructorParameters<typeof Mastra>[0]>;
type EditorScenarioConfig = Omit<MastraScenarioConfig, 'storage' | 'editor'> & {
  gateways?: MastraScenarioConfig extends { gateways?: infer TGateways } ? TGateways : never;
};

export class PromptEchoGateway extends MastraModelGateway {
  readonly id = 'models.dev';
  readonly name = 'Editor Scenario Gateway';

  async fetchProviders(): Promise<Record<string, ProviderConfig>> {
    return {
      mock: {
        name: 'Mock Provider',
        models: ['editor-scenario'],
        apiKeyEnvVar: 'MOCK_API_KEY',
        gateway: 'models.dev',
      },
    };
  }

  buildUrl(): string {
    return 'https://example.invalid/v1';
  }

  async getApiKey(): Promise<string> {
    return 'test-key';
  }

  async resolveLanguageModel(): Promise<LanguageModelV2> {
    return createPromptEchoModel();
  }
}

export function createPromptEchoModel(): LanguageModelV2 {
  return new MockLanguageModelV2({
    provider: 'mock',
    modelId: 'editor-scenario',
    supportedUrls: {},
    doGenerate: async ({ prompt }: { prompt?: Array<{ role: string; content: unknown }> }) => {
      const systemPrompt = prompt
        ?.filter(message => message.role === 'system')
        .map(message => JSON.stringify(message.content))
        .join('\n');

      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        finishReason: 'stop',
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
        content: [{ type: 'text', text: `system:${systemPrompt ?? ''}` }],
        warnings: [],
      };
    },
  });
}

export function createEditorScenarioMastra(config: EditorScenarioConfig = {}) {
  const storage = new InMemoryStore();
  const editor = new MastraEditor();
  const mastra = new Mastra({
    ...config,
    storage,
    editor,
    gateways: config.gateways ?? {
      'models.dev': new PromptEchoGateway(),
    },
  });

  return { storage, editor, mastra };
}
