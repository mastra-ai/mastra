import type { BuilderSettingsResponse, StoredAgentResponse } from '@mastra/client-js';
import type * as PlaygroundUi from '@mastra/playground-ui';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AgentBuilderList, AgentBuilderListSkeleton } from '../agent-builder-list';
import type { AgentBuilderListProps } from '../agent-builder-list';
import type { AuthCapabilities } from '@/domains/auth/types';
import { LinkComponentProvider } from '@/lib/framework';
import { server } from '@/test/msw-server';

// Tooltip primitives render their content lazily on hover; flatten them for
// these structural tests so we can assert on the inline tooltip copy directly.
// This is a UI-rendering seam only — it does NOT hide data/auth flow.
vi.mock('@mastra/playground-ui', async () => {
  const actual = await vi.importActual<typeof PlaygroundUi>('@mastra/playground-ui');
  return {
    ...actual,
    Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    TooltipTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    TooltipContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  };
});

const BASE_URL = 'http://localhost:4111';

const unauthenticatedCapabilities = {
  enabled: true,
  login: { type: 'credentials' as const },
} satisfies AuthCapabilities;

const settingsFavoritesOn: BuilderSettingsResponse = {
  enabled: true,
  features: {
    agent: { favorites: true },
  },
};

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

function renderList({ agents, search, ...props }: AgentBuilderListProps) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  // Seed default handlers so the FavoriteButton instances rendered inside each
  // row resolve their auth + builder-settings queries via MSW. Individual tests
  // can still override these via server.use(...) before rendering.
  server.use(
    http.get(`${BASE_URL}/api/auth/capabilities`, () => HttpResponse.json(unauthenticatedCapabilities)),
    http.get(`${BASE_URL}/api/editor/builder/settings`, () => HttpResponse.json(settingsFavoritesOn)),
  );

  return render(
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <LinkComponentProvider Link={StubLink as never} navigate={() => {}} paths={noopPaths}>
          <AgentBuilderList agents={agents} search={search} {...props} />
        </LinkComponentProvider>
      </QueryClientProvider>
    </MastraReactProvider>,
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
    visibility: 'public',
    authorId: 'user-2',
  },
];

describe('AgentBuilderList', () => {
  afterEach(() => {
    cleanup();
  });

  it('shows a private lock icon with tooltip copy inline with private agent titles', () => {
    renderList({ agents: fixtureAgents });

    expect(screen.getAllByTestId('agent-builder-private-visibility-icon')).toHaveLength(1);
    expect(screen.queryByText('Private')).toBeNull();
    expect(screen.queryByText('Public')).toBeNull();
    expect(screen.getByText('Only visible to you')).toBeTruthy();
  });

  it('renders agent name and description without technical metadata', () => {
    renderList({ agents: fixtureAgents });

    expect(screen.getByText('Alpha Agent')).toBeTruthy();
    expect(screen.getByText('First agent description')).toBeTruthy();
    expect(screen.getByText('Beta Agent')).toBeTruthy();
    expect(screen.queryByText('openai/gpt-4')).toBeNull();
    expect(screen.queryByText('anthropic/claude')).toBeNull();
    expect(screen.queryByText(/Updated/)).toBeNull();
  });

  it('filters by search prop', () => {
    renderList({ agents: fixtureAgents, search: 'alpha' });

    expect(screen.getByText('Alpha Agent')).toBeTruthy();
    expect(screen.queryByText('Beta Agent')).toBeNull();
  });

  it('links rows to the agent view page', () => {
    renderList({ agents: fixtureAgents, rowTestId: 'agent-row' });

    const rows = screen.getAllByTestId('agent-row');
    expect(rows).toHaveLength(fixtureAgents.length);
    for (const [i, row] of rows.entries()) {
      expect(row.getAttribute('href')).toBe(`/agent-builder/agents/${fixtureAgents[i].id}/view`);
    }
  });

  it('filters by description', () => {
    renderList({ agents: fixtureAgents, search: 'second agent' });

    expect(screen.getByText('Beta Agent')).toBeTruthy();
    expect(screen.queryByText('Alpha Agent')).toBeNull();
  });

  it('shows empty state when no rows match', () => {
    renderList({ agents: fixtureAgents, search: 'zzz', rowTestId: 'agent-row' });

    expect(screen.getByText('No agents match your search')).toBeTruthy();
    expect(screen.queryByTestId('agent-row')).toBeNull();
  });

  it('supports the library list presentation', () => {
    renderList({
      agents: fixtureAgents,
      rowTestId: 'library-agent-row',
    });

    expect(screen.getAllByTestId('library-agent-row')).toHaveLength(fixtureAgents.length);
    expect(screen.queryByText('Private')).toBeNull();
  });

  it('renders the resolved author name when the server returned `author`', () => {
    const agents: StoredAgentResponse[] = [
      {
        id: 'a1',
        status: 'active',
        createdAt: now,
        updatedAt: now,
        name: 'Alpha Agent',
        description: 'desc',
        instructions: '',
        model: { provider: 'openai', name: 'gpt-4' },
        visibility: 'public',
        authorId: 'user-1',
        author: { id: 'user-1', name: 'Alice', avatarUrl: 'https://x/y.png' },
      },
    ];
    renderList({ agents });

    const authors = screen.getAllByTestId('agent-builder-row-author');
    expect(authors.length).toBeGreaterThan(0);
    expect(authors.some(node => node.textContent?.includes('Alice'))).toBe(true);
  });

  it('falls back to email when the resolved author has no name', () => {
    const agents: StoredAgentResponse[] = [
      {
        id: 'a1',
        status: 'active',
        createdAt: now,
        updatedAt: now,
        name: 'Alpha Agent',
        description: 'desc',
        instructions: '',
        model: { provider: 'openai', name: 'gpt-4' },
        visibility: 'public',
        authorId: 'user-1',
        author: { id: 'user-1', email: 'alice@example.com' },
      },
    ];
    renderList({ agents });

    const authors = screen.getAllByTestId('agent-builder-row-author');
    expect(authors.length).toBeGreaterThan(0);
    expect(authors.some(node => node.textContent?.includes('alice@example.com'))).toBe(true);
  });

  it('falls back to authorId when no resolved author is present', () => {
    const agents: StoredAgentResponse[] = [
      {
        id: 'a1',
        status: 'active',
        createdAt: now,
        updatedAt: now,
        name: 'Alpha Agent',
        description: 'desc',
        instructions: '',
        model: { provider: 'openai', name: 'gpt-4' },
        visibility: 'public',
        authorId: 'user-99',
      },
    ];
    renderList({ agents });

    const authors = screen.getAllByTestId('agent-builder-row-author');
    expect(authors.length).toBeGreaterThan(0);
    expect(authors.some(node => node.textContent?.includes('user-99'))).toBe(true);
  });

  it('omits the author block when neither `author` nor `authorId` is present', () => {
    const agents: StoredAgentResponse[] = [
      {
        id: 'a1',
        status: 'active',
        createdAt: now,
        updatedAt: now,
        name: 'Alpha Agent',
        description: 'desc',
        instructions: '',
        model: { provider: 'openai', name: 'gpt-4' },
        visibility: 'public',
      },
    ];
    renderList({ agents });

    expect(screen.queryByTestId('agent-builder-row-author')).toBeNull();
    // Row still renders all other fields.
    expect(screen.getByText('Alpha Agent')).toBeTruthy();
    expect(screen.getByText('desc')).toBeTruthy();
  });
});

describe('AgentBuilderListSkeleton', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders the requested number of rows for the library presentation', () => {
    render(<AgentBuilderListSkeleton rows={6} rowTestId="library-skeleton-row" />);

    expect(screen.getAllByTestId('library-skeleton-row')).toHaveLength(6);
  });

  it('defaults to 4 rows', () => {
    render(<AgentBuilderListSkeleton rowTestId="library-skeleton-row" />);

    expect(screen.getAllByTestId('library-skeleton-row')).toHaveLength(4);
  });
});
