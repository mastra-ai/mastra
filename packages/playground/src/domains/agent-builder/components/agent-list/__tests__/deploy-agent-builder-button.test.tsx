// @vitest-environment jsdom
import { TooltipProvider } from '@mastra/playground-ui';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const useAuthCapabilitiesMock = vi.fn();
const useChannelPlatformsMock = vi.fn();
const useChannelInstallationsMock = vi.fn();
const useConnectChannelActionMock = vi.fn();
const useStreamRunningMock = vi.fn();
const connectMock = vi.fn();

vi.mock('@/domains/auth/hooks/use-auth-capabilities', () => ({
  useAuthCapabilities: () => useAuthCapabilitiesMock(),
}));

vi.mock('@/domains/agents/hooks/use-channels', () => ({
  useChannelPlatforms: () => useChannelPlatformsMock(),
  useChannelInstallations: (...args: unknown[]) => useChannelInstallationsMock(...args),
  useConnectChannelAction: (...args: unknown[]) => useConnectChannelActionMock(...args),
}));

vi.mock('@/domains/agent-builder/contexts/stream-chat-context', () => ({
  useStreamRunning: () => useStreamRunningMock(),
}));

vi.mock('@/domains/agent-builder/components/agent-edit/publish-channel-dialogs', () => ({
  ChannelDialog: ({ open, platform, agentId }: { open: boolean; platform: { id: string }; agentId: string }) =>
    open ? (
      <div data-testid={`mock-channel-dialog-${platform.id}`} data-agent-id={agentId}>
        ChannelDialog
      </div>
    ) : null,
}));

vi.mock('@/domains/agents/components/agent-channels/platform-icons', () => ({
  PlatformIcon: ({ platform }: { platform: string }) => <span data-testid={`platform-icon-${platform}`} />,
}));

import { DeployAgentBuilderButton } from '../deploy-agent-builder-button';

const installRadixDomShims = () => {
  if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};
  if (!Element.prototype.hasPointerCapture) Element.prototype.hasPointerCapture = () => false;
  if (!Element.prototype.releasePointerCapture) Element.prototype.releasePointerCapture = () => {};
  if (typeof globalThis.ResizeObserver === 'undefined') {
    class StubResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    (globalThis as unknown as { ResizeObserver: typeof StubResizeObserver }).ResizeObserver = StubResizeObserver;
  }
};

const Wrapper = ({ children }: { children: ReactNode }) => <TooltipProvider>{children}</TooltipProvider>;

const adminCapabilities = (roles: string[] = ['admin']) => ({
  enabled: true,
  login: null,
  user: { id: 'u1', name: 'Admin' },
  capabilities: { user: true, session: true, sso: false, rbac: true, acl: false },
  access: { roles, permissions: [] },
});

const slackPlatform = {
  id: 'slack',
  name: 'Slack',
  isConfigured: true,
};

const slackPlatformUnconfigured = { ...slackPlatform, isConfigured: false };

const activeInstallation = { id: 'inst-1', platform: 'slack', status: 'active' };

describe('DeployAgentBuilderButton', () => {
  beforeAll(() => {
    installRadixDomShims();
  });

  beforeEach(() => {
    useAuthCapabilitiesMock.mockReset();
    useChannelPlatformsMock.mockReset();
    useChannelInstallationsMock.mockReset();
    useConnectChannelActionMock.mockReset();
    useStreamRunningMock.mockReset();
    connectMock.mockReset();

    useChannelPlatformsMock.mockReturnValue({ data: [slackPlatform] });
    useChannelInstallationsMock.mockReturnValue({ data: [] });
    useConnectChannelActionMock.mockReturnValue({ connect: connectMock, isConnecting: false });
    useStreamRunningMock.mockReturnValue(false);
  });

  afterEach(() => {
    cleanup();
  });

  it('renders nothing when capabilities are unauthenticated', () => {
    useAuthCapabilitiesMock.mockReturnValue({ data: { enabled: true, login: null } });

    const { container } = render(
      <Wrapper>
        <DeployAgentBuilderButton agentId="a1" />
      </Wrapper>,
    );
    expect(container.innerHTML).toBe('');
  });

  it.each([['member'], ['editor'], ['']])('renders nothing when user role is %s (not admin)', role => {
    useAuthCapabilitiesMock.mockReturnValue({ data: adminCapabilities(role ? [role] : []) });

    const { container } = render(
      <Wrapper>
        <DeployAgentBuilderButton agentId="a1" />
      </Wrapper>,
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders nothing when admin but slack platform is absent', () => {
    useAuthCapabilitiesMock.mockReturnValue({ data: adminCapabilities() });
    useChannelPlatformsMock.mockReturnValue({ data: [] });

    const { container } = render(
      <Wrapper>
        <DeployAgentBuilderButton agentId="a1" />
      </Wrapper>,
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders nothing when admin and slack present but not configured', () => {
    useAuthCapabilitiesMock.mockReturnValue({ data: adminCapabilities() });
    useChannelPlatformsMock.mockReturnValue({ data: [slackPlatformUnconfigured] });

    const { container } = render(
      <Wrapper>
        <DeployAgentBuilderButton agentId="a1" />
      </Wrapper>,
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders the button when admin + slack configured', () => {
    useAuthCapabilitiesMock.mockReturnValue({ data: adminCapabilities() });

    render(
      <Wrapper>
        <DeployAgentBuilderButton agentId="a1" />
      </Wrapper>,
    );

    const btn = screen.getByTestId('agent-builder-deploy-button') as HTMLButtonElement;
    expect(btn).toBeTruthy();
    expect(btn.textContent).toContain('Deploy to Slack');
  });

  it('opens the confirmation dialog when the button is clicked', () => {
    useAuthCapabilitiesMock.mockReturnValue({ data: adminCapabilities() });

    render(
      <Wrapper>
        <DeployAgentBuilderButton agentId="a1" />
      </Wrapper>,
    );

    fireEvent.click(screen.getByTestId('agent-builder-deploy-button'));
    expect(screen.getByTestId('agent-builder-deploy-confirm-dialog')).toBeTruthy();
    // The library-publish gating dialog (from usePublishAndConnectChannel) must NOT appear.
    expect(screen.queryByTestId('agent-builder-publish-before-connect-dialog')).toBeNull();
  });

  it('confirm with no active installation calls slackConnect.connect with the agentId', () => {
    useAuthCapabilitiesMock.mockReturnValue({ data: adminCapabilities() });
    useChannelInstallationsMock.mockReturnValue({ data: [] });

    render(
      <Wrapper>
        <DeployAgentBuilderButton agentId="a1" />
      </Wrapper>,
    );

    fireEvent.click(screen.getByTestId('agent-builder-deploy-button'));
    fireEvent.click(screen.getByTestId('agent-builder-deploy-confirm-confirm'));

    expect(connectMock).toHaveBeenCalledTimes(1);
    expect(connectMock).toHaveBeenCalledWith('a1');
    expect(screen.queryByTestId('mock-channel-dialog-slack')).toBeNull();
  });

  it('confirm with an active installation opens ChannelDialog and does not OAuth', () => {
    useAuthCapabilitiesMock.mockReturnValue({ data: adminCapabilities() });
    useChannelInstallationsMock.mockReturnValue({ data: [activeInstallation] });

    render(
      <Wrapper>
        <DeployAgentBuilderButton agentId="a1" />
      </Wrapper>,
    );

    fireEvent.click(screen.getByTestId('agent-builder-deploy-button'));
    fireEvent.click(screen.getByTestId('agent-builder-deploy-confirm-confirm'));

    expect(connectMock).not.toHaveBeenCalled();
    const dialog = screen.getByTestId('mock-channel-dialog-slack');
    expect(dialog).toBeTruthy();
    expect(dialog.getAttribute('data-agent-id')).toBe('a1');
  });

  it('cancel closes the confirmation dialog without invoking any connect path', () => {
    useAuthCapabilitiesMock.mockReturnValue({ data: adminCapabilities() });

    render(
      <Wrapper>
        <DeployAgentBuilderButton agentId="a1" />
      </Wrapper>,
    );

    fireEvent.click(screen.getByTestId('agent-builder-deploy-button'));
    expect(screen.getByTestId('agent-builder-deploy-confirm-dialog')).toBeTruthy();

    fireEvent.click(screen.getByTestId('agent-builder-deploy-confirm-cancel'));
    expect(screen.queryByTestId('agent-builder-deploy-confirm-dialog')).toBeNull();
    expect(connectMock).not.toHaveBeenCalled();
    expect(screen.queryByTestId('mock-channel-dialog-slack')).toBeNull();
  });

  it('disables the button while a stream is running', () => {
    useAuthCapabilitiesMock.mockReturnValue({ data: adminCapabilities() });
    useStreamRunningMock.mockReturnValue(true);

    render(
      <Wrapper>
        <DeployAgentBuilderButton agentId="a1" />
      </Wrapper>,
    );

    const btn = screen.getByTestId('agent-builder-deploy-button') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    fireEvent.click(btn);
    expect(screen.queryByTestId('agent-builder-deploy-confirm-dialog')).toBeNull();
  });
});
