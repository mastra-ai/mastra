// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import type { PropsWithChildren } from 'react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const getBuilderSettings = vi.fn(async () => {
  const response = await fetch('http://localhost/api/builder/settings');
  if (!response.ok) throw new Error('Failed to load builder settings');
  return response.json();
});

vi.mock('@mastra/react', () => ({
  useMastraClient: () => ({ getBuilderSettings }),
}));

import { useBuilderAgentFeatures } from '../use-builder-agent-features';
import {
  useBuilderModelPolicy,
  useBuilderPickerVisibility,
  useBuilderSettings,
  useIsBuilderEnabled,
} from '../use-builder-settings';

const builderSettings = {
  enabled: true,
  features: {
    agent: {
      tools: true,
      memory: true,
      workflows: true,
      agents: true,
      avatarUpload: true,
      skills: true,
      model: true,
      favorites: true,
      browser: true,
    },
  },
  modelPolicy: {
    active: true,
    allowed: [{ provider: 'openai', model: 'gpt-4o' }],
    default: { provider: 'openai', model: 'gpt-4o' },
  },
  picker: {
    visibleTools: ['tool-a', 'tool-b'],
    visibleAgents: ['agent-a'],
    visibleWorkflows: ['workflow-a', 'workflow-b'],
  },
};

const server = setupServer(http.get('http://localhost/api/builder/settings', () => HttpResponse.json(builderSettings)));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));

afterEach(() => {
  server.resetHandlers();
  getBuilderSettings.mockClear();
});

afterAll(() => server.close());

beforeEach(() => {
  getBuilderSettings.mockClear();
});

describe('useBuilderSettings', () => {
  it('fetches builder settings through the Mastra client', async () => {
    const { result } = renderHook(() => useBuilderSettings(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(getBuilderSettings).toHaveBeenCalledTimes(1);
    expect(result.current.data).toEqual(builderSettings);
  });

  it('does not fetch when disabled', () => {
    const { result } = renderHook(() => useBuilderSettings({ enabled: false }), { wrapper: createWrapper() });

    expect(result.current.fetchStatus).toBe('idle');
    expect(getBuilderSettings).not.toHaveBeenCalled();
  });

  it('returns query errors from failed settings requests', async () => {
    server.use(
      http.get('http://localhost/api/builder/settings', () => HttpResponse.json({ message: 'nope' }, { status: 500 })),
    );

    const { result } = renderHook(() => useBuilderSettings(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeInstanceOf(Error);
  });
});

describe('useIsBuilderEnabled', () => {
  it('reports enabled when the server returns enabled true', async () => {
    const { result } = renderHook(() => useIsBuilderEnabled(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current).toMatchObject({ isEnabled: true, error: null });
  });

  it('reports disabled for missing or false enabled values', async () => {
    server.use(http.get('http://localhost/api/builder/settings', () => HttpResponse.json({ enabled: false })));

    const { result, rerender } = renderHook(() => useIsBuilderEnabled(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isEnabled).toBe(false);

    server.use(http.get('http://localhost/api/builder/settings', () => HttpResponse.json({})));
    rerender();

    expect(result.current.isEnabled).toBe(false);
  });

  it('exposes errors while treating the builder as disabled', async () => {
    server.use(http.get('http://localhost/api/builder/settings', () => new HttpResponse(null, { status: 500 })));

    const { result } = renderHook(() => useIsBuilderEnabled(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.error).toBeInstanceOf(Error));
    expect(result.current.isEnabled).toBe(false);
  });
});

describe('useBuilderModelPolicy', () => {
  it('returns the server-provided model policy', async () => {
    const { result } = renderHook(() => useBuilderModelPolicy(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.active).toBe(true));

    expect(result.current).toEqual(builderSettings.modelPolicy);
  });

  it('returns the inactive policy when the server omits modelPolicy', async () => {
    server.use(http.get('http://localhost/api/builder/settings', () => HttpResponse.json({ enabled: true })));

    const { result } = renderHook(() => useBuilderModelPolicy(), { wrapper: createWrapper() });

    await waitFor(() => expect(getBuilderSettings).toHaveBeenCalledTimes(1));

    expect(result.current).toEqual({ active: false });
  });
});

describe('useBuilderPickerVisibility', () => {
  it('returns unrestricted picker visibility before data loads and when picker is omitted', async () => {
    server.use(http.get('http://localhost/api/builder/settings', () => HttpResponse.json({ enabled: true })));

    const { result } = renderHook(() => useBuilderPickerVisibility(), { wrapper: createWrapper() });

    expect(result.current).toEqual({ visibleTools: null, visibleAgents: null, visibleWorkflows: null });
    await waitFor(() => expect(getBuilderSettings).toHaveBeenCalledTimes(1));
    expect(result.current).toEqual({ visibleTools: null, visibleAgents: null, visibleWorkflows: null });
  });

  it('converts picker allowlists to sets and preserves null unrestricted values', async () => {
    server.use(
      http.get('http://localhost/api/builder/settings', () =>
        HttpResponse.json({
          enabled: true,
          picker: {
            visibleTools: null,
            visibleAgents: ['agent-a', 'agent-b'],
            visibleWorkflows: [],
          },
        }),
      ),
    );

    const { result } = renderHook(() => useBuilderPickerVisibility(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.visibleAgents).toBeInstanceOf(Set));

    expect(result.current.visibleTools).toBeNull();
    expect([...result.current.visibleAgents!]).toEqual(['agent-a', 'agent-b']);
    expect([...result.current.visibleWorkflows!]).toEqual([]);
  });

  it('supports restricted tools with unrestricted agents and workflows', async () => {
    server.use(
      http.get('http://localhost/api/builder/settings', () =>
        HttpResponse.json({
          enabled: true,
          picker: {
            visibleTools: ['tool-a'],
            visibleAgents: null,
            visibleWorkflows: null,
          },
        }),
      ),
    );

    const { result } = renderHook(() => useBuilderPickerVisibility(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.visibleTools).toBeInstanceOf(Set));

    expect([...result.current.visibleTools!]).toEqual(['tool-a']);
    expect(result.current.visibleAgents).toBeNull();
    expect(result.current.visibleWorkflows).toBeNull();
  });
});

describe('useBuilderAgentFeatures', () => {
  it('maps enabled agent feature flags to booleans', async () => {
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

  it('defaults every feature to false when settings or agent features are missing', async () => {
    server.use(
      http.get('http://localhost/api/builder/settings', () => HttpResponse.json({ enabled: true, features: {} })),
    );

    const { result } = renderHook(() => useBuilderAgentFeatures(), { wrapper: createWrapper() });

    expect(result.current).toEqual({
      tools: false,
      memory: false,
      workflows: false,
      agents: false,
      avatarUpload: false,
      skills: false,
      model: false,
      favorites: false,
      browser: false,
    });

    await waitFor(() => expect(getBuilderSettings).toHaveBeenCalledTimes(1));
    expect(result.current).toEqual({
      tools: false,
      memory: false,
      workflows: false,
      agents: false,
      avatarUpload: false,
      skills: false,
      model: false,
      favorites: false,
      browser: false,
    });
  });

  it('treats non-true feature values as disabled', async () => {
    server.use(
      http.get('http://localhost/api/builder/settings', () =>
        HttpResponse.json({
          enabled: true,
          features: {
            agent: {
              tools: false,
              memory: 'yes',
              workflows: 1,
              agents: null,
              avatarUpload: undefined,
              skills: true,
              model: false,
              favorites: true,
              browser: false,
            },
          },
        }),
      ),
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
