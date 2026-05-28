// @vitest-environment jsdom

import type { ScheduleResponse } from '@mastra/client-js';
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

function makeSchedule(
  overrides: Partial<ScheduleResponse> & { inputData?: Record<string, unknown> },
): ScheduleResponse {
  const { inputData, ...rest } = overrides;
  return {
    id: 'hb_chef_thread-1',
    cron: '*/30 * * * * *',
    timezone: 'UTC',
    status: 'active',
    ownerType: 'agent',
    ownerId: 'chef',
    nextFireAt: new Date(Date.now() + 30_000).toISOString(),
    lastFireAt: null,
    lastRun: null,
    target: {
      type: 'workflow',
      workflowId: '__mastra_heartbeat__',
      inputData: inputData ?? { agentId: 'chef', threadId: 'thread-1', prompt: 'tick' },
    },
    ...rest,
  } as unknown as ScheduleResponse;
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
    const schedule = makeSchedule({
      id: 'hb_chef_thread-1',
      inputData: { agentId: 'chef', threadId: 'thread-1', prompt: 'tick' },
    });

    renderList(<HeartbeatsList schedules={[schedule]} isLoading={false} />);

    expect(screen.getByText('chef')).toBeTruthy();
    expect(screen.getByText('thread-1')).toBeTruthy();
    expect(screen.getByText('*/30 * * * * *')).toBeTruthy();
    const link = screen.getByRole('link', { hidden: true }) as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('/heartbeats/hb_chef_thread-1');
  });

  it('renders an em-dash placeholder for threadless heartbeats', () => {
    const schedule = makeSchedule({
      id: 'hb_chef',
      inputData: { agentId: 'chef', prompt: 'tick' },
    });

    renderList(<HeartbeatsList schedules={[schedule]} isLoading={false} />);

    const dashes = screen.getAllByText('—');
    expect(dashes.length).toBeGreaterThan(0);
  });

  it('filters out threadless rows when mode is "threaded"', () => {
    const threaded = makeSchedule({
      id: 'hb_chef_t1',
      inputData: { agentId: 'chef', threadId: 't1', prompt: 'tick' },
    });
    const threadless = makeSchedule({
      id: 'hb_chef',
      inputData: { agentId: 'chef', prompt: 'tick' },
    });

    renderList(<HeartbeatsList schedules={[threaded, threadless]} isLoading={false} mode="threaded" />);

    expect(screen.getByText('t1')).toBeTruthy();
    expect(screen.queryByText('hb_chef')).toBeNull();
  });

  it('filters by free-text search across agent and thread ids', () => {
    const chef = makeSchedule({
      id: 'hb_chef_t1',
      inputData: { agentId: 'chef', threadId: 't1', prompt: 'tick' },
    });
    const sommelier = makeSchedule({
      id: 'hb_sommelier_t2',
      ownerId: 'sommelier',
      inputData: { agentId: 'sommelier', threadId: 't2', prompt: 'tick' },
    });

    renderList(<HeartbeatsList schedules={[chef, sommelier]} isLoading={false} search="somm" />);

    expect(screen.getByText('sommelier')).toBeTruthy();
    expect(screen.queryByText('chef')).toBeNull();
  });
});
