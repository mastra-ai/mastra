import { cleanup, screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';

import { LLMProviders } from '../llm-providers';
import { desktopLocalOnlyBuilderSettings, serverProviderRegistry } from './fixtures/provider-dropdown';
import { server } from '@/test/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '@/test/render';

const renderProviders = () => renderWithProviders(<LLMProviders open value="ollama" onValueChange={() => undefined} />);

afterEach(() => {
  delete window.MASTRA_DESKTOP_ENDPOINT;
  cleanup();
});

describe('LLMProviders', () => {
  describe('when Mastra Studio Desktop adds a local provider', () => {
    it('keeps server providers visible in the generic model picker', async () => {
      window.MASTRA_DESKTOP_ENDPOINT = '/__desktop';

      server.use(
        http.get(`${TEST_BASE_URL}/api/agents/providers`, () => HttpResponse.json(serverProviderRegistry)),
        http.get(`${TEST_BASE_URL}/api/editor/builder/settings`, () =>
          HttpResponse.json(desktopLocalOnlyBuilderSettings),
        ),
        http.get('*/__desktop/state', () =>
          HttpResponse.json({
            runtime: { state: 'running', url: 'http://127.0.0.1:4111' },
            settings: {
              environmentVariables: {},
              modelApiKey: 'ollama',
              modelId: 'glm-ocr:latest',
              modelUrl: 'http://localhost:11434/v1',
            },
          }),
        ),
        http.post('*/__desktop/probe-models', () =>
          HttpResponse.json({
            ok: true,
            modelUrl: 'http://localhost:11434/v1',
            models: ['glm-ocr:latest'],
          }),
        ),
      );

      renderProviders();

      const popup = await screen.findByRole('dialog');
      expect(within(popup).getByText('Ollama Local')).not.toBeNull();
      expect(within(popup).getByText('OpenAI')).not.toBeNull();
      expect(within(popup).getByText('Anthropic')).not.toBeNull();
    });
  });
});
