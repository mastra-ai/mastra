// @vitest-environment jsdom
import type { StoredAgentResponse } from '@mastra/client-js';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { AgentBuilderList } from '../agent-builder-list';
import { LinkComponentProvider } from '@/lib/framework';

const StubLink = ({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
  <a {...props}>{children}</a>
);

const noopPaths = {
  agentLink: () => '',
  agentMessageLink: () => '',
  workflowLink: () => '',
  toolLink: () => '',
  scoreLink: () => '',
  scorerLink: () => '',
  toolByAgentLink: () => '',
  toolByWorkflowLink: () => '',
  promptLink: () => '',
  legacyWorkflowLink: () => '',
  policyLink: () => '',
  vNextNetworkLink: () => '',
  agentBuilderLink: () => '',
  mcpServerLink: () => '',
  mcpServerToolLink: () => '',
  workflowRunLink: () => '',
  datasetLink: () => '',
  datasetItemLink: () => '',
  datasetExperimentLink: () => '',
  experimentLink: () => '',
} as never;

function renderList(agents: StoredAgentResponse[], search?: string) {
  return render(
    <LinkComponentProvider Link={StubLink as never} navigate={() => {}} paths={noopPaths}>
      <AgentBuilderList agents={agents} search={search} />
    </LinkComponentProvider>,
  );
}

const now = new Date().toISOString();

const fixtureAgents: StoredAgentResponse[] = [
  {
    id: 'a1',
    status: 'active',
    createdAt: now,
    updatedAt: now,
    name: 'Alpha Agent',
    description: 'First agent description',
    instructions: '',
    model: { provider: 'openai', name: 'gpt-4' },
    visibility: 'private',
    authorId: 'user-1',
  },
  {
    id: 'a2',
    status: 'active',
    createdAt: now,
    updatedAt: now,
    name: 'Beta Agent',
    description: 'Second agent description',
    instructions: '',
    model: { provider: 'anthropic', name: 'claude' },
    visibility: 'private',
    authorId: 'user-2',
  },
];

describe('AgentBuilderList', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders a Private badge on each row', () => {
    renderList(fixtureAgents);

    const badges = screen.getAllByText('Private');
    // Each agent renders the badge twice (mobile + desktop variants)
    expect(badges.length).toBeGreaterThanOrEqual(fixtureAgents.length);
  });

  it('renders agent name and description', () => {
    renderList(fixtureAgents);

    expect(screen.getByText('Alpha Agent')).toBeTruthy();
    expect(screen.getByText('First agent description')).toBeTruthy();
    expect(screen.getByText('Beta Agent')).toBeTruthy();
  });

  it('filters by search prop', () => {
    renderList(fixtureAgents, 'alpha');

    expect(screen.getByText('Alpha Agent')).toBeTruthy();
    expect(screen.queryByText('Beta Agent')).toBeNull();
  });
});
