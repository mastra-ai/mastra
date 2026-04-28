// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { LibraryAgent } from '../../../fixtures/library-agents';
import { AgentBuilderLibraryList } from '../agent-builder-library-list';
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

function renderList(agents: LibraryAgent[], search?: string) {
  return render(
    <LinkComponentProvider Link={StubLink as never} navigate={() => {}} paths={noopPaths}>
      <AgentBuilderLibraryList agents={agents} search={search} />
    </LinkComponentProvider>,
  );
}

const fixtureAgents: LibraryAgent[] = [
  {
    id: 'lib-1',
    name: 'Customer Support Agent',
    description: 'Triages and answers customer questions.',
    owner: { id: 'u1', name: 'Alex Doe' },
  },
  {
    id: 'lib-2',
    name: 'Research Assistant',
    description: 'Summarizes long documents.',
    owner: { id: 'u2', name: 'Jamie Lee' },
  },
  {
    id: 'lib-3',
    name: 'Code Reviewer',
    description: 'Reviews pull requests.',
    owner: { id: 'u3', name: 'Sam Patel' },
  },
  {
    id: 'lib-4',
    name: 'Translator',
    description: 'Translates short content.',
    owner: { id: 'u1', name: 'Alex Doe' },
  },
];

describe('AgentBuilderLibraryList', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders each agent name and owner', () => {
    renderList(fixtureAgents);

    for (const agent of fixtureAgents) {
      expect(screen.getByText(agent.name)).toBeTruthy();
    }
    expect(screen.getAllByTestId('library-agent-owner')).toHaveLength(fixtureAgents.length);
    expect(screen.getAllByText('Alex Doe')).toHaveLength(2);
    expect(screen.getByText('Jamie Lee')).toBeTruthy();
    expect(screen.getByText('Sam Patel')).toBeTruthy();
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

  it('filters by owner name', () => {
    renderList(fixtureAgents, 'alex');

    expect(screen.getByText('Customer Support Agent')).toBeTruthy();
    expect(screen.getByText('Translator')).toBeTruthy();
    expect(screen.queryByText('Research Assistant')).toBeNull();
    expect(screen.queryByText('Code Reviewer')).toBeNull();
  });

  it('shows empty state when no rows match', () => {
    renderList(fixtureAgents, 'zzz');

    expect(screen.getByText('No agents match your search')).toBeTruthy();
    expect(screen.queryByTestId('library-agent-row')).toBeNull();
  });
});
