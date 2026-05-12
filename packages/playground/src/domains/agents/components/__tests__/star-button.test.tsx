// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StarButton } from '../star-button';

vi.mock('@/domains/agent-builder', () => ({
  useBuilderAgentFeatures: () => ({ stars: true }),
}));

vi.mock('../../hooks/use-stored-agent-star', () => ({
  useToggleStoredAgentStar: () => ({ isPending: false, mutate: vi.fn() }),
}));

const authCapabilitiesMock = vi.fn();

vi.mock('@/domains/auth/hooks/use-auth-capabilities', () => ({
  useAuthCapabilities: () => authCapabilitiesMock(),
}));

describe('StarButton', () => {
  beforeEach(() => {
    authCapabilitiesMock.mockReturnValue({
      data: { enabled: true, login: { sso: false, credentials: false }, user: { id: 'u1' }, capabilities: {}, access: null },
    });
  });

  it('renders singular Star text with the count', () => {
    render(<StarButton agentId="agent-1" starCount={1} />);

    expect(screen.getByRole('button', { name: 'Star agent' })).toBeTruthy();
    expect(screen.getByText('Star')).toBeTruthy();
    expect(screen.getByText('1')).toBeTruthy();
  });

  it('renders plural Stars text with the count', () => {
    render(<StarButton agentId="agent-1" starCount={2} />);

    expect(screen.getByText('Stars')).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy();
  });

  it('renders as disabled with a sign-in tooltip when the user is not authenticated', () => {
    authCapabilitiesMock.mockReturnValue({
      data: { enabled: true, login: { sso: false, credentials: false } },
    });
    render(<StarButton agentId="agent-1" starCount={1} />);

    const button = screen.getByRole('button', { name: 'Sign in to star this agent' });
    expect(button).toBeTruthy();
    expect((button as HTMLButtonElement).disabled).toBe(true);
  });
});
