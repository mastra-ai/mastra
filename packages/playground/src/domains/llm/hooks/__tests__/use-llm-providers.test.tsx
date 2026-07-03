import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { PropsWithChildren } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { useLLMProviders } from '../use-llm-providers';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';

const createWrapper = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: PropsWithChildren) => (
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </MastraReactProvider>
  );
};

afterEach(() => {
  delete window.MASTRA_DESKTOP_ENDPOINT;
  cleanup();
});

describe('useLLMProviders', () => {
  describe('when Mastra Studio Desktop has a reachable Ollama runtime', () => {
    it('exposes the local provider without waiting for the full server registry', async () => {
      let resolveServerProviders: () => void = () => {};
      const serverProvidersGate = new Promise<void>(resolve => {
        resolveServerProviders = resolve;
      });
      window.MASTRA_DESKTOP_ENDPOINT = '/__desktop';

      server.use(
        http.get(`${BASE_URL}/api/agents/providers`, async () => {
          await serverProvidersGate;
          return HttpResponse.json({ providers: [] });
        }),
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

      const { result } = renderHook(() => useLLMProviders(), { wrapper: createWrapper() });

      try {
        await waitFor(() => expect(result.current.data?.providers.map(provider => provider.id)).toEqual(['ollama']));
        expect(result.current.isLoading).toBe(false);
      } finally {
        resolveServerProviders();
      }
    });

    it('adds the local Ollama provider when the server provider list is empty', async () => {
      const probeRequests: unknown[] = [];
      window.MASTRA_DESKTOP_ENDPOINT = '/__desktop';

      server.use(
        http.get(`${BASE_URL}/api/agents/providers`, () => HttpResponse.json({ providers: [] })),
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
        http.post('*/__desktop/probe-models', async ({ request }) => {
          probeRequests.push(await request.json());
          return HttpResponse.json({
            ok: true,
            modelUrl: 'http://localhost:11434/v1',
            models: ['glm-ocr:latest', 'lfm2.5-thinking:latest'],
          });
        }),
      );

      const { result } = renderHook(() => useLLMProviders(), { wrapper: createWrapper() });

      await waitFor(() =>
        expect(result.current.data?.providers.find(provider => provider.id === 'ollama')).toBeDefined(),
      );
      expect(result.current.data?.providers).toEqual([
        expect.objectContaining({
          connected: true,
          id: 'ollama',
          models: ['glm-ocr:latest', 'lfm2.5-thinking:latest'],
          name: 'Ollama Local',
        }),
      ]);
      expect(probeRequests).toEqual([
        {
          apiKey: 'ollama',
          modelUrl: 'http://localhost:11434/v1',
          providerId: 'ollama',
          providerName: 'Ollama Local',
        },
      ]);
    });

    it('keeps server providers after the local Ollama provider', async () => {
      window.MASTRA_DESKTOP_ENDPOINT = '/__desktop';

      server.use(
        http.get(`${BASE_URL}/api/agents/providers`, () =>
          HttpResponse.json({
            providers: [
              {
                connected: false,
                envVar: 'OPENAI_API_KEY',
                id: 'openai',
                models: ['gpt-4o-mini'],
                name: 'OpenAI',
              },
              {
                connected: false,
                envVar: 'ANTHROPIC_API_KEY',
                id: 'anthropic',
                models: ['claude-opus-4-7'],
                name: 'Anthropic',
              },
            ],
          }),
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

      const { result } = renderHook(() => useLLMProviders(), { wrapper: createWrapper() });

      await waitFor(() =>
        expect(result.current.data?.providers.map(provider => provider.id)).toEqual(['ollama', 'openai', 'anthropic']),
      );
    });

    it('replaces prefixed desktop gateway providers with the unprefixed local provider', async () => {
      window.MASTRA_DESKTOP_ENDPOINT = '/__desktop';

      server.use(
        http.get(`${BASE_URL}/api/agents/providers`, () =>
          HttpResponse.json({
            providers: [
              {
                connected: true,
                envVar: 'MASTRA_DESKTOP_MODEL_API_KEY',
                id: 'desktop-local/ollama',
                models: ['stale-model'],
                name: 'Ollama Local',
              },
            ],
          }),
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

      const { result } = renderHook(() => useLLMProviders(), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.data?.providers.map(provider => provider.id)).toEqual(['ollama']));
      expect(result.current.data?.providers[0].models).toEqual(['glm-ocr:latest']);
    });
  });
});
