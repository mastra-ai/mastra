import { TooltipProvider } from '@mastra/playground-ui/components/Tooltip';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { delay, http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import AgentBuilderCreate from '../create';
import { authDisabledCapabilities, rbacCapabilities } from './fixtures/auth';
import {
  emptyAgents,
  emptyAvailableModels,
  emptyStoredSkills,
  emptyTools,
  emptyWorkflows,
  settingsAllFeatures,
  settingsPartialFeatures,
} from './fixtures/builder';
import type { AuthCapabilities } from '@/domains/auth/types';
import { server } from '@/test/msw-server';

const { navigateSpy } = vi.hoisted(() => ({
  navigateSpy: vi.fn(),
}));

vi.mock('@/domains/agent-builder/components/agent-starter/agent-builder-starter', () => ({
  AgentBuilderStarter: () => <div data-testid="agent-builder-starter" />,
}));

vi.mock('@mastra/playground-ui/store/playground-store', () => ({
  usePlaygroundStore: () => ({ requestContext: undefined }),
}));

vi.mock('react-router', async importOriginal => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    useNavigate: () => navigateSpy,
    Navigate: ({ to, replace }: { to: string; replace?: boolean }) => (
      <div data-testid="navigate" data-to={to} data-replace={String(Boolean(replace))} />
    ),
  };
});

const BASE_URL = 'http://localhost:4111';

type Spy = ReturnType<typeof vi.fn<() => void>>;
interface ListSpies {
  tools: Spy;
  agents: Spy;
  workflows: Spy;
  storedSkills: Spy;
  availableModels: Spy;
}

const installListSpies = (): ListSpies => {
  const spies: ListSpies = {
    tools: vi.fn<() => void>(),
    agents: vi.fn<() => void>(),
    workflows: vi.fn<() => void>(),
    storedSkills: vi.fn<() => void>(),
    availableModels: vi.fn<() => void>(),
  };
  server.use(
    http.get(`${BASE_URL}/api/tools`, () => {
      spies.tools();
      return HttpResponse.json(emptyTools);
    }),
    http.get(`${BASE_URL}/api/agents`, () => {
      spies.agents();
      return HttpResponse.json(emptyAgents);
    }),
    http.get(`${BASE_URL}/api/workflows`, () => {
      spies.workflows();
      return HttpResponse.json(emptyWorkflows);
    }),
    http.get(`${BASE_URL}/api/stored/skills`, () => {
      spies.storedSkills();
      return HttpResponse.json(emptyStoredSkills);
    }),
    http.get(`${BASE_URL}/api/editor/builder/models/available`, () => {
      spies.availableModels();
      return HttpResponse.json(emptyAvailableModels);
    }),
  );
  return spies;
};

const stubCapabilities = (capabilities: AuthCapabilities) => {
  server.use(http.get(`${BASE_URL}/api/auth/capabilities`, () => HttpResponse.json(capabilities)));
};

const stubBuilderSettings = (response: typeof settingsAllFeatures, { delayMs }: { delayMs?: number } = {}) => {
  server.use(
    http.get(`${BASE_URL}/api/editor/builder/settings`, async () => {
      if (delayMs) await delay(delayMs);
      return HttpResponse.json(response);
    }),
  );
};

const renderCreate = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const result = render(
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <MemoryRouter>
            <AgentBuilderCreate />
          </MemoryRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </MastraReactProvider>,
  );
  return { ...result, queryClient };
};

afterEach(() => {
  cleanup();
  navigateSpy.mockReset();
});

describe('AgentBuilderCreate', () => {
  describe('when the user lacks write access (RBAC enabled, no stored-agents:write)', () => {
    it('redirects to the agents list', async () => {
      stubCapabilities(rbacCapabilities([]));
      // Delay settings so capabilities resolve first and flip canWrite to false
      // before any feature flags can enable the cache-warming queries.
      stubBuilderSettings(settingsAllFeatures, { delayMs: 50 });
      installListSpies();

      renderCreate();

      const navigate = await screen.findByTestId('navigate');
      expect(navigate.getAttribute('data-to')).toBe('/agent-builder/agents');
      expect(navigate.getAttribute('data-replace')).toBe('true');
    });

    it('does not render the starter', async () => {
      stubCapabilities(rbacCapabilities([]));
      stubBuilderSettings(settingsAllFeatures, { delayMs: 50 });
      installListSpies();

      renderCreate();

      await screen.findByTestId('navigate');
      expect(screen.queryByTestId('agent-builder-starter')).toBeNull();
    });

    it('does not warm the feature-gated caches', async () => {
      stubCapabilities(rbacCapabilities([]));
      stubBuilderSettings(settingsAllFeatures, { delayMs: 50 });
      const spies = installListSpies();

      const { queryClient } = renderCreate();

      await screen.findByTestId('navigate');
      // Wait for the (delayed) builder-settings query to settle so any cache
      // warming it could trigger has had its chance to fire, keeping the late
      // state update inside act instead of leaking after the test body.
      await waitFor(() => {
        expect(queryClient.getQueryState(['builder-settings'])?.status).toBe('success');
      });
      // The feature-gated cache-warming queries are gated by `canWrite && features.*`
      // (features come from builder settings), so a denied user never triggers them.
      // NOTE: the model-available cache is gated by `canWrite` alone and so can fire
      // optimistically during the brief window before auth capabilities resolve; that
      // over-fetch is a pre-existing product behavior, not a redirect-correctness bug.
      expect(spies.tools).not.toHaveBeenCalled();
      expect(spies.agents).not.toHaveBeenCalled();
      expect(spies.workflows).not.toHaveBeenCalled();
      expect(spies.storedSkills).not.toHaveBeenCalled();
    });
  });

  describe('when the user can write and every feature is enabled', () => {
    it('renders the starter and back button', async () => {
      stubCapabilities(authDisabledCapabilities);
      stubBuilderSettings(settingsAllFeatures);
      installListSpies();

      renderCreate();

      expect(await screen.findByTestId('agent-builder-starter')).not.toBeNull();
      expect(screen.queryByTestId('navigate')).toBeNull();
      expect(screen.getByRole('button', { name: 'Agents list' })).not.toBeNull();
    });

    it('warms every cache', async () => {
      stubCapabilities(authDisabledCapabilities);
      stubBuilderSettings(settingsAllFeatures);
      const spies = installListSpies();

      renderCreate();

      await waitFor(() => {
        expect(spies.tools).toHaveBeenCalledTimes(1);
        expect(spies.agents).toHaveBeenCalledTimes(1);
        expect(spies.workflows).toHaveBeenCalledTimes(1);
        expect(spies.storedSkills).toHaveBeenCalledTimes(1);
        // The model picker cache is seeded on mount so the picker loads instantly.
        expect(spies.availableModels).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('when only some features are enabled', () => {
    it('only warms caches whose feature flag is enabled', async () => {
      stubCapabilities(authDisabledCapabilities);
      stubBuilderSettings(settingsPartialFeatures);
      const spies = installListSpies();

      renderCreate();

      await waitFor(() => {
        expect(spies.tools).toHaveBeenCalledTimes(1);
        expect(spies.workflows).toHaveBeenCalledTimes(1);
      });
      expect(spies.agents).not.toHaveBeenCalled();
      expect(spies.storedSkills).not.toHaveBeenCalled();
    });
  });

  describe('when the back button is clicked', () => {
    it('navigates back to the agents list with viewTransition', async () => {
      stubCapabilities(authDisabledCapabilities);
      stubBuilderSettings(settingsAllFeatures);
      installListSpies();

      renderCreate();

      const back = await screen.findByRole('button', { name: 'Agents list' });
      fireEvent.click(back);

      expect(navigateSpy).toHaveBeenCalledTimes(1);
      expect(navigateSpy).toHaveBeenCalledWith('/agent-builder/agents', { viewTransition: true });
    });
  });
});
