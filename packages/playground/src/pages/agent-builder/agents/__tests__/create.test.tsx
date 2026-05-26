// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import AgentBuilderCreate from '../create';

const {
  useBuilderAgentAccessMock,
  useBuilderAgentFeaturesMock,
  useToolsMock,
  useAgentsMock,
  useWorkflowsMock,
  useStoredSkillsMock,
  navigateSpy,
} = vi.hoisted(() => ({
  useBuilderAgentAccessMock: vi.fn(),
  useBuilderAgentFeaturesMock: vi.fn(),
  useToolsMock: vi.fn(),
  useAgentsMock: vi.fn(),
  useWorkflowsMock: vi.fn(),
  useStoredSkillsMock: vi.fn(),
  navigateSpy: vi.fn(),
}));

vi.mock('@/domains/agent-builder', () => ({
  useBuilderAgentAccess: useBuilderAgentAccessMock,
  useBuilderAgentFeatures: useBuilderAgentFeaturesMock,
}));

vi.mock('@/domains/agents/hooks/use-agents', () => ({
  useAgents: useAgentsMock,
}));

vi.mock('@/domains/agents/hooks/use-stored-skills', () => ({
  useStoredSkills: useStoredSkillsMock,
}));

vi.mock('@/domains/tools/hooks/use-all-tools', () => ({
  useTools: useToolsMock,
}));

vi.mock('@/domains/workflows/hooks/use-workflows', () => ({
  useWorkflows: useWorkflowsMock,
}));

vi.mock('@/domains/agent-builder/components/agent-starter/agent-builder-starter', () => ({
  AgentBuilderStarter: () => <div data-testid="agent-builder-starter" />,
}));

vi.mock('@mastra/playground-ui', () => ({
  Button: ({ children, onClick, tooltip, ...rest }: any) => (
    <button onClick={onClick} aria-label={tooltip} {...rest}>
      {children}
    </button>
  ),
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

const allFeatures = {
  tools: true,
  memory: true,
  workflows: true,
  agents: true,
  avatarUpload: true,
  skills: true,
  model: true,
  favorites: true,
  browser: true,
};

const renderCreate = () =>
  render(
    <MemoryRouter>
      <AgentBuilderCreate />
    </MemoryRouter>,
  );

const setAccess = (canWrite: boolean) => {
  useBuilderAgentAccessMock.mockReturnValue({ canWrite });
};

const setFeatures = (overrides: Partial<typeof allFeatures> = {}) => {
  useBuilderAgentFeaturesMock.mockReturnValue({ ...allFeatures, ...overrides });
};

afterEach(() => {
  cleanup();
  useBuilderAgentAccessMock.mockReset();
  useBuilderAgentFeaturesMock.mockReset();
  useToolsMock.mockReset();
  useAgentsMock.mockReset();
  useWorkflowsMock.mockReset();
  useStoredSkillsMock.mockReset();
  navigateSpy.mockReset();
});

describe('AgentBuilderCreate', () => {
  it('redirects to the agents list when the user lacks write access', () => {
    setAccess(false);
    setFeatures();

    renderCreate();

    const navigate = screen.getByTestId('navigate');
    expect(navigate.getAttribute('data-to')).toBe('/agent-builder/agents');
    expect(navigate.getAttribute('data-replace')).toBe('true');
    expect(screen.queryByTestId('agent-builder-starter')).toBeNull();
  });

  it('still warms the query caches before redirecting unauthorized users', () => {
    setAccess(false);
    setFeatures();

    renderCreate();

    expect(useToolsMock).toHaveBeenCalledWith({ enabled: false });
    expect(useAgentsMock).toHaveBeenCalledWith({ enabled: false });
    expect(useWorkflowsMock).toHaveBeenCalledWith({ enabled: false });
    expect(useStoredSkillsMock).toHaveBeenCalledWith({ enabled: false });
  });

  it('renders the starter and back button when the user can write', () => {
    setAccess(true);
    setFeatures();

    renderCreate();

    expect(screen.getByTestId('agent-builder-starter')).not.toBeNull();
    expect(screen.queryByTestId('navigate')).toBeNull();
    expect(screen.getByRole('button', { name: 'Agents list' })).not.toBeNull();
  });

  it('warms each cache only when its feature flag and canWrite are both true', () => {
    setAccess(true);
    setFeatures({ tools: true, agents: false, workflows: true, skills: false });

    renderCreate();

    expect(useToolsMock).toHaveBeenCalledWith({ enabled: true });
    expect(useAgentsMock).toHaveBeenCalledWith({ enabled: false });
    expect(useWorkflowsMock).toHaveBeenCalledWith({ enabled: true });
    expect(useStoredSkillsMock).toHaveBeenCalledWith({ enabled: false });
  });

  it('navigates back to the agents list with viewTransition when the back button is clicked', () => {
    setAccess(true);
    setFeatures();

    renderCreate();

    fireEvent.click(screen.getByRole('button', { name: 'Agents list' }));

    expect(navigateSpy).toHaveBeenCalledTimes(1);
    expect(navigateSpy).toHaveBeenCalledWith('/agent-builder/agents', { viewTransition: true });
  });
});
