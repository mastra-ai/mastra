// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { forwardRef } from 'react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';

import { makeHeartbeatTrigger } from '../../__tests__/fixtures/heartbeats';
import { HeartbeatTriggersList } from '../heartbeat-triggers-list';
import { LinkComponentProvider } from '@/lib/framework';

const Link = forwardRef<HTMLAnchorElement, React.AnchorHTMLAttributes<HTMLAnchorElement>>((props, ref) => (
  <a ref={ref} {...props} />
));

const paths = {
  agentLink: (id: string) => `/agents/${id}`,
  agentsLink: () => '/agents',
  agentToolLink: () => '',
  agentSkillLink: () => '',
  agentThreadLink: (agentId: string, threadId: string, messageId?: string) =>
    messageId ? `/agents/${agentId}/chat/${threadId}?messageId=${messageId}` : `/agents/${agentId}/chat/${threadId}`,
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

const renderList = (ui: React.ReactNode) =>
  render(
    <MemoryRouter>
      <LinkComponentProvider Link={Link} navigate={() => {}} paths={paths}>
        {ui}
      </LinkComponentProvider>
    </MemoryRouter>,
  );

afterEach(() => cleanup());

describe('HeartbeatTriggersList', () => {
  it('renders an empty state when there are no triggers', () => {
    renderList(<HeartbeatTriggersList triggers={[]} isLoading={false} />);
    expect(screen.getByText('No trigger history yet.')).not.toBeNull();
  });

  it('renders Run, Status, Started headers (no Duration/Error columns)', () => {
    const trigger = makeHeartbeatTrigger();
    const { container } = renderList(<HeartbeatTriggersList triggers={[trigger]} isLoading={false} />);

    const text = container.textContent ?? '';
    expect(text).toContain('Run');
    expect(text).toContain('Status');
    expect(text).toContain('Started');
    expect(text).not.toContain('Duration');
    expect(text).not.toContain('Error');
  });

  it('renders the runId in the Run column', () => {
    const trigger = makeHeartbeatTrigger({
      id: 'trg_1',
      runId: 'agent_run_abcdef',
      actualFireAt: new Date('2026-05-28T12:00:00Z').getTime(),
    });

    renderList(<HeartbeatTriggersList triggers={[trigger]} isLoading={false} />);

    expect(screen.getByTestId('heartbeat-trigger-run-id').textContent).toBe('agent_run_abcdef');
  });

  it('shows a manual badge on rows fired out-of-band', () => {
    const scheduledTrigger = makeHeartbeatTrigger({ id: 'trg_scheduled', triggerKind: 'schedule-fire' });
    const manualTrigger = makeHeartbeatTrigger({
      id: 'trg_manual',
      triggerKind: 'manual',
      actualFireAt: scheduledTrigger.actualFireAt + 1000,
    });

    renderList(<HeartbeatTriggersList triggers={[scheduledTrigger, manualTrigger]} isLoading={false} />);

    const badges = screen.queryAllByTestId('heartbeat-trigger-manual-badge');
    expect(badges).toHaveLength(1);
    expect(badges[0]?.textContent).toBe('manual');
  });

  it('links rows to the agent thread chat when agentId + threadId + runId are present', () => {
    const trigger = makeHeartbeatTrigger({ id: 'trg_linked', runId: 'agent_run_xyz' });
    renderList(<HeartbeatTriggersList triggers={[trigger]} isLoading={false} agentId="chef" threadId="thread-1" />);

    const link = screen.getByRole('link');
    expect(link.getAttribute('href')).toBe('/agents/chef/chat/thread-1?messageId=agent_run_xyz');
  });

  it('does not link rows when threadId is missing (threadless heartbeats)', () => {
    const trigger = makeHeartbeatTrigger({ id: 'trg_threadless', runId: 'agent_run_threadless' });
    renderList(<HeartbeatTriggersList triggers={[trigger]} isLoading={false} agentId="chef" />);

    expect(screen.queryByRole('link')).toBeNull();
  });

  it('does not link rows for failed publish even with thread context', () => {
    const trigger = makeHeartbeatTrigger({
      id: 'trg_failed',
      outcome: 'failed',
      error: 'pubsub timeout',
      runId: 'agent_run_failed',
    });
    renderList(<HeartbeatTriggersList triggers={[trigger]} isLoading={false} agentId="chef" threadId="thread-1" />);

    expect(screen.queryByRole('link')).toBeNull();
  });
});
