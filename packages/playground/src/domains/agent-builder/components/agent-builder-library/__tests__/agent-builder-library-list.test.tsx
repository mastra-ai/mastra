// @vitest-environment jsdom
import type { StoredAgentResponse } from '@mastra/client-js';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { AgentBuilderLibraryList, AgentBuilderLibraryListSkeleton } from '../agent-builder-library-list';
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
      <AgentBuilderLibraryList agents={agents} search={search} />
    </LinkComponentProvider>,
  );
}

const fixtureAgents = [
  {
    id: 'lib-1',
    name: 'Customer Support Agent',
    description: 'Triages and answers customer questions.',
  },
  {
    id: 'lib-2',
    name: 'Research Assistant',
    description: 'Summarizes long documents.',
  },
  {
    id: 'lib-3',
    name: 'Code Reviewer',
    description: 'Reviews pull requests.',
  },
  {
    id: 'lib-4',
    name: 'Translator',
    description: 'Translates short content.',
  },
] as unknown as StoredAgentResponse[];

describe('AgentBuilderLibraryList', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders each agent name', () => {
    renderList(fixtureAgents);

    for (const agent of fixtureAgents) {
      expect(screen.getByText(agent.name)).toBeTruthy();
    }
  });

  it('links each row to the agent view page', () => {
    renderList(fixtureAgents);

    const rows = screen.getAllByTestId('library-agent-row');
    expect(rows).toHaveLength(fixtureAgents.length);
    for (const [i, row] of rows.entries()) {
      expect(row.getAttribute('href')).toBe(`/agent-builder/agents/${fixtureAgents[i].id}/view`);
    }
  });

  it('filters by name (case-insensitive)', () => {
    renderList(fixtureAgents, 'research');

    expect(screen.getByText('Research Assistant')).toBeTruthy();
    expect(screen.queryByText('Customer Support Agent')).toBeNull();
    expect(screen.queryByText('Code Reviewer')).toBeNull();
    expect(screen.queryByText('Translator')).toBeNull();
  });

  it('filters by description (case-insensitive)', () => {
    renderList(fixtureAgents, 'pull requests');

    expect(screen.getByText('Code Reviewer')).toBeTruthy();
    expect(screen.queryByText('Research Assistant')).toBeNull();
    expect(screen.queryByText('Customer Support Agent')).toBeNull();
    expect(screen.queryByText('Translator')).toBeNull();
  });

  it('shows empty state when no rows match', () => {
    renderList(fixtureAgents, 'zzz');

    expect(screen.getByText('No agents match your search')).toBeTruthy();
    expect(screen.queryByTestId('library-agent-row')).toBeNull();
  });
});

describe('AgentBuilderLibraryListSkeleton', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders the requested number of rows', () => {
    render(<AgentBuilderLibraryListSkeleton rows={6} />);

    expect(screen.getAllByTestId('library-skeleton-row')).toHaveLength(6);
  });

  it('defaults to 4 rows', () => {
    render(<AgentBuilderLibraryListSkeleton />);

    expect(screen.getAllByTestId('library-skeleton-row')).toHaveLength(4);
  });
});
