import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { PropsWithChildren } from 'react';
import { MemoryRouter, useLocation } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useAgentBuilderAllowedModels } from '../use-agent-builder-allowed-models';
import { useAutoScroll } from '../use-auto-scroll';
import { useBuilderAgentFeatures } from '../use-builder-agent-features';
import { useCanCreateAgent } from '../use-can-create-agent';
import { useChatDraft } from '../use-chat-draft';
import { useStarterUserMessage } from '../use-starter-user-message';
import { authDisabledCapabilities } from './fixtures/auth';
import { availableModelsResponse } from './fixtures/builder-models';
import { buildBuilderSettings } from './fixtures/builder-settings';
import {
  useBuilderModelPolicy,
  useBuilderPickerVisibility,
  useBuilderSettings,
  useIsBuilderEnabled,
} from '@/domains/agent-builder/hooks/use-builder-settings';
import type { DesktopRuntimeState } from '@/lib/desktop-runtime';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';
const SETTINGS_URL = `${BASE_URL}/api/editor/builder/settings`;
const MODELS_URL = `${BASE_URL}/api/editor/builder/models/available`;
const CAPABILITIES_URL = `${BASE_URL}/api/auth/capabilities`;

const createWrapper = (queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })) => {
  return ({ children }: PropsWithChildren) => (
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </MastraReactProvider>
  );
};

/** Answer the builder-settings endpoint with the given response. */
const respondSettings = (settings: ReturnType<typeof buildBuilderSettings>) => {
  server.use(http.get(SETTINGS_URL, () => HttpResponse.json(settings)));
};

afterEach(() => {
  delete window.MASTRA_DESKTOP_ENDPOINT;
  cleanup();
});

describe('useAgentBuilderAllowedModels', () => {
  describe('when the available-models endpoint returns providers', () => {
    it('exposes the providers and a flat provider/model list', async () => {
      server.use(
        http.get(MODELS_URL, () =>
          HttpResponse.json(
            availableModelsResponse([
              { id: 'openai', name: 'OpenAI', envVar: 'OPENAI_API_KEY', connected: true, models: ['gpt-4o'] },
            ]),
          ),
        ),
      );

      const { result } = renderHook(() => useAgentBuilderAllowedModels(), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.providers).toHaveLength(1));
      expect(result.current.providers).toEqual([
        expect.objectContaining({ id: 'openai', name: 'OpenAI', models: ['gpt-4o'] }),
      ]);
      expect(result.current.models).toEqual([{ provider: 'openai', providerName: 'OpenAI', model: 'gpt-4o' }]);
    });

    it('flattens every model the endpoint already filtered to', async () => {
      server.use(
        http.get(MODELS_URL, () =>
          HttpResponse.json(
            availableModelsResponse([
              {
                id: 'openai',
                name: 'OpenAI',
                envVar: 'OPENAI_API_KEY',
                connected: true,
                models: ['gpt-4o', 'gpt-4o-mini'],
              },
            ]),
          ),
        ),
      );

      const { result } = renderHook(() => useAgentBuilderAllowedModels(), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.models).toHaveLength(2));
      expect(result.current.models).toEqual([
        { provider: 'openai', providerName: 'OpenAI', model: 'gpt-4o' },
        { provider: 'openai', providerName: 'OpenAI', model: 'gpt-4o-mini' },
      ]);
    });
  });

  describe('when Mastra Studio Desktop has a reachable Ollama runtime', () => {
    it('adds the local Ollama provider alongside Ollama Cloud', async () => {
      const probeRequests: unknown[] = [];
      window.MASTRA_DESKTOP_ENDPOINT = '/__desktop';
      server.use(
        http.get(MODELS_URL, () =>
          HttpResponse.json(
            availableModelsResponse([
              {
                id: 'ollama-cloud',
                name: 'Ollama Cloud',
                envVar: 'OLLAMA_API_KEY',
                connected: true,
                models: ['gpt-oss:120b'],
              },
            ]),
          ),
        ),
        http.get('*/__desktop/state', () =>
          HttpResponse.json({
            runtime: { state: 'running', url: 'http://127.0.0.1:4112' },
            settings: {
              environmentVariables: {},
              modelApiKey: 'ollama',
              modelId: 'llama3.2',
              modelUrl: 'http://localhost:11434/v1',
            },
          }),
        ),
        http.post('*/__desktop/probe-models', async ({ request }) => {
          probeRequests.push(await request.json());
          return HttpResponse.json({
            ok: true,
            modelUrl: 'http://localhost:11434/v1',
            models: ['llama3.2', 'qwen2.5'],
          });
        }),
      );

      const { result } = renderHook(() => useAgentBuilderAllowedModels(), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.providers.find(provider => provider.id === 'ollama')).toBeDefined());
      expect(result.current.providers).toEqual([
        expect.objectContaining({ id: 'ollama', name: 'Ollama Local', models: ['llama3.2', 'qwen2.5'] }),
        expect.objectContaining({ id: 'ollama-cloud', name: 'Ollama Cloud', models: ['gpt-oss:120b'] }),
      ]);
      expect(result.current.models).toEqual([
        { provider: 'ollama', providerName: 'Ollama Local', model: 'llama3.2' },
        { provider: 'ollama', providerName: 'Ollama Local', model: 'qwen2.5' },
        { provider: 'ollama-cloud', providerName: 'Ollama Cloud', model: 'gpt-oss:120b' },
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

    it('refreshes a cached LM Studio state before probing models', async () => {
      const stateRequests = vi.fn<() => void>();
      const probeRequests: unknown[] = [];
      window.MASTRA_DESKTOP_ENDPOINT = '/__desktop';

      const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      const staleLmStudioState: DesktopRuntimeState = {
        runtime: { state: 'running', url: 'http://127.0.0.1:4112' },
        settings: {
          environmentVariables: {},
          modelApiKey: 'not-needed',
          modelId: 'lmstudio/openai/gpt-oss-20b',
          modelUrl: 'http://localhost:1234/v1',
        },
      };
      queryClient.setQueryData(['desktop-runtime-state', '/__desktop'], staleLmStudioState);

      server.use(
        http.get(MODELS_URL, () =>
          HttpResponse.json(
            availableModelsResponse([
              {
                id: 'ollama-cloud',
                name: 'Ollama Cloud',
                envVar: 'OLLAMA_API_KEY',
                connected: true,
                models: ['gpt-oss:120b'],
              },
            ]),
          ),
        ),
        http.get('*/__desktop/state', () => {
          stateRequests();
          return HttpResponse.json({
            runtime: { state: 'running', url: 'http://127.0.0.1:4112' },
            settings: {
              environmentVariables: {},
              modelApiKey: 'ollama',
              modelId: 'glm-ocr:latest',
              modelUrl: 'http://localhost:11434/v1',
            },
          });
        }),
        http.post('*/__desktop/probe-models', async ({ request }) => {
          probeRequests.push(await request.json());
          return HttpResponse.json({
            ok: true,
            modelUrl: 'http://localhost:11434/v1',
            models: ['glm-ocr:latest'],
          });
        }),
      );

      const { result } = renderHook(() => useAgentBuilderAllowedModels(), { wrapper: createWrapper(queryClient) });

      await waitFor(() => expect(result.current.providers.find(provider => provider.id === 'ollama')).toBeDefined());
      expect(stateRequests).toHaveBeenCalledTimes(1);
      expect(result.current.desktopModelStatus?.unavailable).toBe(false);
      expect(result.current.providers[0]).toEqual(
        expect.objectContaining({ id: 'ollama', name: 'Ollama Local', models: ['glm-ocr:latest'] }),
      );
      expect(probeRequests).toEqual([
        {
          apiKey: 'ollama',
          modelUrl: 'http://localhost:11434/v1',
          providerId: 'ollama',
          providerName: 'Ollama Local',
        },
      ]);
    });
  });

  describe('when the endpoint has not resolved yet', () => {
    it('returns empty providers and models while loading', () => {
      server.use(http.get(MODELS_URL, () => new Promise<never>(() => {})));

      const { result } = renderHook(() => useAgentBuilderAllowedModels(), { wrapper: createWrapper() });

      expect(result.current.providers).toEqual([]);
      expect(result.current.models).toEqual([]);
      expect(result.current.isLoading).toBe(true);
    });
  });
});

describe('isModelNotAllowedError', () => {
  describe('when inspecting an error for the MODEL_NOT_ALLOWED code', () => {
    it('returns the error message for a matching code and null otherwise', async () => {
      const { isModelNotAllowedError } = await import('@/domains/agent-builder/utils/is-model-not-allowed');

      expect(
        isModelNotAllowedError(Object.assign(new Error('Choose another model'), { code: 'MODEL_NOT_ALLOWED' })),
      ).toEqual({ message: 'Choose another model' });
      expect(isModelNotAllowedError({ code: 'MODEL_NOT_ALLOWED' })).toEqual({ message: 'Model is not allowed' });
      expect(isModelNotAllowedError({ code: 'OTHER' })).toBeNull();
      expect(isModelNotAllowedError(null)).toBeNull();
    });
  });
});

describe('useBuilderSettings', () => {
  describe('when the settings endpoint succeeds', () => {
    it('returns the builder settings payload', async () => {
      const settings = buildBuilderSettings();
      respondSettings(settings);

      const { result } = renderHook(() => useBuilderSettings(), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(settings);
    });
  });

  describe('when the hook is disabled', () => {
    it('never issues the settings request', () => {
      const { result } = renderHook(() => useBuilderSettings({ enabled: false }), { wrapper: createWrapper() });

      expect(result.current.fetchStatus).toBe('idle');
    });
  });

  describe('when the settings endpoint fails', () => {
    it('surfaces the query error', async () => {
      server.use(http.get(SETTINGS_URL, () => HttpResponse.json({ message: 'nope' }, { status: 500 })));

      const { result } = renderHook(() => useBuilderSettings(), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error).toBeInstanceOf(Error);
    });
  });
});

describe('useIsBuilderEnabled', () => {
  describe('when the server reports the builder enabled', () => {
    it('reports enabled with no error', async () => {
      respondSettings(buildBuilderSettings());

      const { result } = renderHook(() => useIsBuilderEnabled(), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current).toMatchObject({ isEnabled: true, error: null });
    });
  });

  describe('when the server reports the builder disabled', () => {
    it('reports disabled', async () => {
      respondSettings(buildBuilderSettings({ enabled: false }));

      const { result } = renderHook(() => useIsBuilderEnabled(), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.isEnabled).toBe(false);
    });
  });

  describe('when the settings request errors', () => {
    it('exposes the error while treating the builder as disabled', async () => {
      server.use(http.get(SETTINGS_URL, () => new HttpResponse(null, { status: 500 })));

      const { result } = renderHook(() => useIsBuilderEnabled(), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.error).toBeInstanceOf(Error));
      expect(result.current.isEnabled).toBe(false);
    });
  });
});

describe('useBuilderModelPolicy', () => {
  describe('when the server provides a model policy', () => {
    it('returns the server-provided policy', async () => {
      const settings = buildBuilderSettings();
      respondSettings(settings);

      const { result } = renderHook(() => useBuilderModelPolicy(), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.active).toBe(true));
      expect(result.current).toEqual(settings.modelPolicy);
    });
  });

  describe('when the server omits the model policy', () => {
    it('falls back to an inactive policy', async () => {
      respondSettings(buildBuilderSettings({ modelPolicy: undefined }));

      const { result } = renderHook(() => useBuilderModelPolicy(), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current).toEqual({ active: false }));
    });
  });
});

describe('useBuilderPickerVisibility', () => {
  describe('when the picker section is omitted', () => {
    it('treats every kind as unrestricted', async () => {
      respondSettings(buildBuilderSettings({ picker: undefined }));

      const { result } = renderHook(() => useBuilderPickerVisibility(), { wrapper: createWrapper() });

      expect(result.current).toEqual({ visibleTools: null, visibleAgents: null, visibleWorkflows: null });
      await waitFor(() =>
        expect(result.current).toEqual({ visibleTools: null, visibleAgents: null, visibleWorkflows: null }),
      );
    });
  });

  describe('when allowlists mix null and explicit arrays', () => {
    it('converts allowlists to sets and preserves null unrestricted values', async () => {
      respondSettings(
        buildBuilderSettings({
          picker: { visibleTools: null, visibleAgents: ['agent-a', 'agent-b'], visibleWorkflows: [] },
        }),
      );

      const { result } = renderHook(() => useBuilderPickerVisibility(), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.visibleAgents).toBeInstanceOf(Set));
      expect(result.current.visibleTools).toBeNull();
      expect([...result.current.visibleAgents!]).toEqual(['agent-a', 'agent-b']);
      expect([...result.current.visibleWorkflows!]).toEqual([]);
    });
  });

  describe('when only tools are restricted', () => {
    it('returns a tools set with unrestricted agents and workflows', async () => {
      respondSettings(
        buildBuilderSettings({ picker: { visibleTools: ['tool-a'], visibleAgents: null, visibleWorkflows: null } }),
      );

      const { result } = renderHook(() => useBuilderPickerVisibility(), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.visibleTools).toBeInstanceOf(Set));
      expect([...result.current.visibleTools!]).toEqual(['tool-a']);
      expect(result.current.visibleAgents).toBeNull();
      expect(result.current.visibleWorkflows).toBeNull();
    });
  });
});

describe('useBuilderAgentFeatures', () => {
  describe('when every agent feature flag is enabled', () => {
    it('maps each flag to true', async () => {
      respondSettings(buildBuilderSettings());

      const { result } = renderHook(() => useBuilderAgentFeatures(), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.browser).toBe(true));
      expect(result.current).toEqual({
        tools: true,
        memory: true,
        workflows: true,
        agents: true,
        avatarUpload: true,
        skills: true,
        model: true,
        favorites: true,
        browser: true,
      });
    });
  });

  describe('when the agent features object is missing', () => {
    it('defaults every feature to false', async () => {
      respondSettings(buildBuilderSettings({ features: {} }));

      const { result } = renderHook(() => useBuilderAgentFeatures(), { wrapper: createWrapper() });

      const allFalse = {
        tools: false,
        memory: false,
        workflows: false,
        agents: false,
        avatarUpload: false,
        skills: false,
        model: false,
        favorites: false,
        browser: false,
      };
      expect(result.current).toEqual(allFalse);
      await waitFor(() => expect(result.current).toEqual(allFalse));
    });
  });

  describe('when feature values are not strictly true', () => {
    it('treats non-true values as disabled', async () => {
      respondSettings(
        buildBuilderSettings({
          features: {
            agent: {
              tools: false,
              memory: 'yes' as unknown as boolean,
              workflows: 1 as unknown as boolean,
              agents: null as unknown as boolean,
              avatarUpload: undefined,
              skills: true,
              model: false,
              favorites: true,
              browser: false,
            },
          },
        }),
      );

      const { result } = renderHook(() => useBuilderAgentFeatures(), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.skills).toBe(true));
      expect(result.current).toEqual({
        tools: false,
        memory: false,
        workflows: false,
        agents: false,
        avatarUpload: false,
        skills: true,
        model: false,
        favorites: true,
        browser: false,
      });
    });
  });
});

describe('useCanCreateAgent', () => {
  describe('when the builder is configured and access is granted', () => {
    it('routes create requests to the agent-builder create page', async () => {
      server.use(http.get(CAPABILITIES_URL, () => HttpResponse.json(authDisabledCapabilities)));
      respondSettings(buildBuilderSettings());

      const { result } = renderHook(() => useCanCreateAgent(), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current).toEqual({
        canCreateAgent: true,
        createRoute: '/agent-builder/agents/create',
        isLoading: false,
      });
    });
  });

  describe('when the builder is disabled but the experimental UI flag is set', () => {
    it('keeps the legacy CMS create route', async () => {
      server.use(http.get(CAPABILITIES_URL, () => HttpResponse.json(authDisabledCapabilities)));
      respondSettings(buildBuilderSettings({ enabled: false }));

      const flagWindow = window as unknown as Record<string, unknown>;
      const prev = flagWindow.MASTRA_EXPERIMENTAL_UI;
      flagWindow.MASTRA_EXPERIMENTAL_UI = 'true';
      try {
        const { result } = renderHook(() => useCanCreateAgent(), { wrapper: createWrapper() });

        await waitFor(() => expect(result.current.isLoading).toBe(false));
        expect(result.current).toEqual({ canCreateAgent: true, createRoute: '/cms/agents/create', isLoading: false });
      } finally {
        if (prev === undefined) {
          delete flagWindow.MASTRA_EXPERIMENTAL_UI;
        } else {
          flagWindow.MASTRA_EXPERIMENTAL_UI = prev;
        }
      }
    });
  });
});

describe('useAutoScroll', () => {
  describe('when the tracked dependency changes', () => {
    it('scrolls the ref target to the bottom', () => {
      const scrollTo = vi.fn();
      const { result, rerender } = renderHook(({ dep }) => useAutoScroll(dep), { initialProps: { dep: 1 } });
      Object.defineProperties(result.current, { current: { value: { scrollHeight: 123, scrollTo }, writable: true } });

      rerender({ dep: 2 });

      expect(scrollTo).toHaveBeenCalledWith({ top: 123, behavior: 'smooth' });
    });
  });
});

describe('useChatDraft', () => {
  describe('when the draft is blank', () => {
    it('does not submit', () => {
      const onSubmit = vi.fn();
      const { result } = renderHook(() => useChatDraft({ onSubmit }));

      act(() => result.current.handleFormSubmit({ preventDefault: vi.fn() } as any));

      expect(onSubmit).not.toHaveBeenCalled();
    });
  });

  describe('when the draft has surrounding whitespace', () => {
    it('submits the trimmed value and clears the draft', () => {
      const onSubmit = vi.fn();
      const { result } = renderHook(() => useChatDraft({ onSubmit }));

      act(() => result.current.setDraft('  hello  '));
      act(() => result.current.handleFormSubmit({ preventDefault: vi.fn() } as any));

      expect(onSubmit).toHaveBeenCalledWith('hello');
      expect(result.current.draft).toBe('');
    });
  });

  describe('when Enter is pressed without Shift', () => {
    it('requests form submission', () => {
      const { result } = renderHook(() => useChatDraft({ onSubmit: vi.fn() }));
      const requestSubmit = vi.fn();

      act(() => result.current.setDraft('next'));
      result.current.handleKeyDown({
        key: 'Enter',
        shiftKey: false,
        nativeEvent: { isComposing: false },
        preventDefault: vi.fn(),
        currentTarget: { form: { requestSubmit } },
      } as any);

      expect(requestSubmit).toHaveBeenCalled();
    });
  });

  describe('when Enter is pressed with Shift held', () => {
    it('does not request form submission', () => {
      const { result } = renderHook(() => useChatDraft({ onSubmit: vi.fn() }));
      const requestSubmit = vi.fn();

      act(() => result.current.setDraft('next'));
      result.current.handleKeyDown({
        key: 'Enter',
        shiftKey: true,
        nativeEvent: { isComposing: false },
        preventDefault: vi.fn(),
        currentTarget: { form: { requestSubmit } },
      } as any);

      expect(requestSubmit).not.toHaveBeenCalled();
    });
  });
});

describe('useStarterUserMessage', () => {
  const renderWithState = (state: unknown) => {
    const wrapper = ({ children }: PropsWithChildren) => (
      <MemoryRouter initialEntries={[{ pathname: '/agent-builder/agents/a', state }]}>{children}</MemoryRouter>
    );
    return renderHook(() => ({ message: useStarterUserMessage(), locationState: useLocation().state }), { wrapper });
  };

  describe('when the router carries a starter user message', () => {
    it('captures the message and clears the location state', async () => {
      const { result } = renderWithState({ userMessage: 'start' });

      expect(result.current.message).toBe('start');
      await waitFor(() => expect(result.current.locationState).toBeNull());
    });
  });

  describe('when there is no starter user message', () => {
    it('returns undefined and leaves the location state untouched', () => {
      const { result } = renderWithState(null);

      expect(result.current.message).toBeUndefined();
      expect(result.current.locationState).toBeNull();
    });
  });
});
