// @vitest-environment jsdom

import type { Heartbeat } from '@mastra/client-js';
import { cleanup, render, screen } from '@testing-library/react';
import { forwardRef } from 'react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';
import { HeartbeatsList } from '../heartbeats-list';
import { LinkComponentProvider } from '@/lib/framework';

const Link = forwardRef<HTMLAnchorElement, React.AnchorHTMLAttributes<HTMLAnchorElement>>((props, ref) => (
  <a ref={ref} {...props} />
));

const paths = {
  agentLink: (id: string) => `/agents/${id}`,
  agentsLink: () => '/agents',
  agentToolLink: () => '',
  agentSkillLink: () => '',
  agentThreadLink: () => '',
  agentNewThreadLink: () => '',
  workflowsLink: () => '',
  workflowLink: () => '',
  schedulesLink: () => '',
  scheduleLink: () => '',
  heartbeatsLink: () => '/heartbeats',
  heartbeatLink: (id: string) => `/heartbeats/${encodeURIComponent(id)}`,
  networkLink: () => '',
  networkNewThreadLink: () => '',
  networkThreadLink: () => '',
  scorerLink: () => '',
  cmsScorersCreateLink: () => '',
  cmsScorerEditLink: () => '',
  cmsAgentCreateLink: () => '',
  cmsAgentEditLink: () => '',
  promptBlockLink: () => '',
  promptBlocksLink: () => '',
  cmsPromptBlockCreateLink: () => '',
  cmsPromptBlockEditLink: () => '',
  toolLink: () => '',
  skillLink: () => '',
  workspacesLink: () => '',
  workspaceLink: () => '',
  workspaceSkillLink: () => '',
  processorsLink: () => '',
  processorLink: () => '',
  mcpServerLink: () => '',
  mcpServerToolLink: () => '',
  workflowRunLink: () => '',
  datasetLink: () => '',
  datasetItemLink: () => '',
  datasetExperimentLink: () => '',
  experimentLink: () => '',
};

function makeHeartbeat(overrides: Partial<Heartbeat> = {}): Heartbeat {
  const now = Date.now();
  return {
    id: 'hb_chef_thread-1',
    agentId: 'chef',
    threadId: 'thread-1',
    prompt: 'tick',
    cron: '*/30 * * * * *',
    timezone: 'UTC',
    status: 'active',
    nextFireAt: now + 30_000,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

const renderList = (ui: React.ReactNode) =>
  render(
    <MemoryRouter>
      <LinkComponentProvider Link={Link} navigate={() => {}} paths={paths}>
        {ui}
      </LinkComponentProvider>
    </MemoryRouter>,
  );

afterEach(() => cleanup());

describe('HeartbeatsList', () => {
  it('renders agent id, thread id, and cron for a threaded heartbeat', () => {
    const heartbeat = makeHeartbeat({ id: 'hb_chef_thread-1', agentId: 'chef', threadId: 'thread-1' });

    renderList(<HeartbeatsList heartbeats={[heartbeat]} isLoading={false} />);

    expect(screen.getByText('chef')).toBeTruthy();
    expect(screen.getByText('thread-1')).toBeTruthy();
    expect(screen.getByText('*/30 * * * * *')).toBeTruthy();
    const link = screen.getByRole('link', { hidden: true }) as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('/heartbeats/hb_chef_thread-1');
  });

  it('renders an em-dash placeholder for threadless heartbeats', () => {
    const heartbeat = makeHeartbeat({ id: 'hb_chef', agentId: 'chef', threadId: undefined });

    renderList(<HeartbeatsList heartbeats={[heartbeat]} isLoading={false} />);

    const dashes = screen.getAllByText('—');
    expect(dashes.length).toBeGreaterThan(0);
  });

  it('filters out threadless rows when mode is "threaded"', () => {
    const threaded = makeHeartbeat({ id: 'hb_chef_t1', agentId: 'chef', threadId: 't1' });
    const threadless = makeHeartbeat({ id: 'hb_chef', agentId: 'chef', threadId: undefined });

    renderList(<HeartbeatsList heartbeats={[threaded, threadless]} isLoading={false} mode="threaded" />);

    expect(screen.getByText('t1')).toBeTruthy();
    expect(screen.queryByText('hb_chef')).toBeNull();
  });

  it('filters by free-text search across agent and thread ids', () => {
    const chef = makeHeartbeat({ id: 'hb_chef_t1', agentId: 'chef', threadId: 't1' });
    const sommelier = makeHeartbeat({ id: 'hb_sommelier_t2', agentId: 'sommelier', threadId: 't2' });

    renderList(<HeartbeatsList heartbeats={[chef, sommelier]} isLoading={false} search="somm" />);

    expect(screen.getByText('sommelier')).toBeTruthy();
    expect(screen.queryByText('chef')).toBeNull();
  });
});
