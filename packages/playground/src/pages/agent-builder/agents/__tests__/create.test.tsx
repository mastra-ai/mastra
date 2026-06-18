// @vitest-environment jsdom
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import AgentBuilderCreate from '../create';
import {
  emptyAgents,
  emptyAvailableModels,
  emptyStoredSkills,
  emptyTools,
  emptyWorkflows,
  settingsAllFeatures,
  settingsPartialFeatures,
} from './fixtures/builder';
import { server } from '@/test/msw-server';

const { navigateSpy, usePermissionsMock } = vi.hoisted(() => ({
  navigateSpy: vi.fn(),
  usePermissionsMock: vi.fn(),
}));

vi.mock('@/domains/agent-builder/components/agent-starter/agent-builder-starter', () => ({
  AgentBuilderStarter: () => <div data-testid="agent-builder-starter" />,
}));

vi.mock('@mastra/playground-ui', async importOriginal => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    Button: ({ children, onClick, tooltip, ...rest }: any) => (
      <button onClick={onClick} aria-label={tooltip} {...rest}>
        {children}
      </button>
    ),
    usePlaygroundStore: () => ({ requestContext: undefined }),
  };
});

vi.mock('@/domains/auth/hooks/use-permissions', () => ({
  usePermissions: usePermissionsMock,
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

const permissive = {
  roles: [],
  permissions: [],
  isLoading: false,
  isAuthenticated: true,
  rbacEnabled: false,
  hasPermission: () => true,
  hasAllPermissions: () => true,
  hasAnyPermission: () => true,
  hasRole: () => true,
  canEdit: () => true,
  canDelete: () => true,
  canExecute: () => true,
};

const restrictive = {
  ...permissive,
  rbacEnabled: true,
  hasPermission: () => false,
  hasAllPermissions: () => false,
  hasAnyPermission: () => false,
};

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

const stubBuilderSettings = (response: typeof settingsAllFeatures) => {
  server.use(http.get(`${BASE_URL}/api/editor/builder/settings`, () => HttpResponse.json(response)));
};

const renderCreate = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <AgentBuilderCreate />
        </MemoryRouter>
      </QueryClientProvider>
    </MastraReactProvider>,
  );
};

beforeEach(() => {
  usePermissionsMock.mockReturnValue(permissive);
});

afterEach(() => {
  cleanup();
  navigateSpy.mockReset();
  usePermissionsMock.mockReset();
});

describe('AgentBuilderCreate', () => {
  it('redirects to the agents list when the user lacks write access', async () => {
    usePermissionsMock.mockReturnValue(restrictive);
    stubBuilderSettings(settingsAllFeatures);
    const spies = installListSpies();

    renderCreate();

    const navigate = await screen.findByTestId('navigate');
    expect(navigate.getAttribute('data-to')).toBe('/agent-builder/agents');
    expect(navigate.getAttribute('data-replace')).toBe('true');
    expect(screen.queryByTestId('agent-builder-starter')).toBeNull();

    // Cache-warming queries must NOT fire when the user has no write access.
    // Give React-Query a chance to schedule and verify nothing went out.
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(spies.tools).not.toHaveBeenCalled();
    expect(spies.agents).not.toHaveBeenCalled();
    expect(spies.workflows).not.toHaveBeenCalled();
    expect(spies.storedSkills).not.toHaveBeenCalled();
    expect(spies.availableModels).not.toHaveBeenCalled();
  });

  it('renders the starter and back button and warms every cache when canWrite + all features are on', async () => {
    stubBuilderSettings(settingsAllFeatures);
    const spies = installListSpies();

    renderCreate();

    expect(await screen.findByTestId('agent-builder-starter')).not.toBeNull();
    expect(screen.queryByTestId('navigate')).toBeNull();
    expect(screen.getByRole('button', { name: 'Agents list' })).not.toBeNull();

    await waitFor(() => {
      expect(spies.tools).toHaveBeenCalledTimes(1);
      expect(spies.agents).toHaveBeenCalledTimes(1);
      expect(spies.workflows).toHaveBeenCalledTimes(1);
      expect(spies.storedSkills).toHaveBeenCalledTimes(1);
      // The model picker cache is seeded on mount so the picker loads instantly.
      expect(spies.availableModels).toHaveBeenCalledTimes(1);
    });
  });

  it('only warms caches whose feature flag is enabled', async () => {
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

  it('navigates back to the agents list with viewTransition when the back button is clicked', async () => {
    stubBuilderSettings(settingsAllFeatures);
    installListSpies();

    renderCreate();

    const back = await screen.findByRole('button', { name: 'Agents list' });
    fireEvent.click(back);

    expect(navigateSpy).toHaveBeenCalledTimes(1);
    expect(navigateSpy).toHaveBeenCalledWith('/agent-builder/agents', { viewTransition: true });
  });
});
