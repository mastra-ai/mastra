import { Toaster } from '@mastra/playground-ui/components/Toaster';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { server } from '../../../../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../../../../e2e/ui/render';
import type { GitLabProject, GitLabStatus } from '../../../factory/services/gitlab';
import type { IntakeConfig, IntakeSourceBinding } from '../../../factory/services/intake';
import type { JiraProject, JiraStatus } from '../../../factory/services/jira';
import type { LinearProject, LinearStatus } from '../../../factory/services/linear';
import type { GithubStatus } from '../../../workspaces/services/github';
import { IntakeSection } from '../IntakeSection';

// Headless Nango auth is the browser boundary the SPA drives after the
// server mints a connect/reconnect session. The SDK opens the provider's
// consent popup (a real window), so tests stub the SDK and assert the
// session token and integration id it receives — everything up to that
// point (session minting, connection polling) stays on the MSW network.
const nangoAuthCalls: Array<{ integrationId: string; options: Record<string, unknown> }> = [];
const nangoConstructorOptions: Array<Record<string, unknown>> = [];

vi.mock('@nangohq/frontend', () => {
  class MockNango {
    win = { close: vi.fn() };
    constructor(options: Record<string, unknown>) {
      nangoConstructorOptions.push(options);
    }
    auth(integrationId: string, options: Record<string, unknown>) {
      nangoAuthCalls.push({ integrationId, options });
      return Promise.resolve({ connectionId: 'nango-conn', providerConfigKey: integrationId });
    }
  }
  class AuthError extends Error {
    type = 'unknown';
  }
  return { default: MockNango, AuthError };
});

beforeEach(() => {
  nangoAuthCalls.length = 0;
  nangoConstructorOptions.length = 0;
});

const CONFIG_URL = `${TEST_BASE_URL}/web/intake/config`;
const BINDINGS_URL = `${TEST_BASE_URL}/web/intake/bindings`;
const GITHUB_STATUS_URL = `${TEST_BASE_URL}/web/github/status`;
const LINEAR_STATUS_URL = `${TEST_BASE_URL}/web/linear/status`;
const LINEAR_PROJECTS_URL = `${TEST_BASE_URL}/web/linear/projects`;
const LINEAR_TEAMS_URL = `${TEST_BASE_URL}/web/linear/teams`;
const JIRA_STATUS_URL = `${TEST_BASE_URL}/web/jira/status`;
const JIRA_PROJECTS_URL = `${TEST_BASE_URL}/web/jira/projects`;
const JIRA_CONNECT_SESSION_URL = `${TEST_BASE_URL}/web/integrations/platform/jira/connect-session`;
const JIRA_CONNECTIONS_URL = `${TEST_BASE_URL}/web/integrations/platform/jira/connections`;
const INCIDENTIO_CONNECTIONS_URL = `${TEST_BASE_URL}/web/integrations/platform/incident-io/connections`;
const INTAKE_SOURCES_URL = `${TEST_BASE_URL}/web/intake/sources`;
const GITLAB_STATUS_URL = `${TEST_BASE_URL}/web/gitlab/status`;
const GITLAB_PROJECTS_URL = `${TEST_BASE_URL}/web/gitlab/projects`;

/**
 * Stub the platform connect seam: session minting plus the connection list
 * the mutation polls after the popup resolves. Returns the mint log so specs
 * can assert which session (connect vs reconnect) was requested.
 */
function usePlatformConnectHandlers({
  connections = [{ id: 'a1b_acme', integrationId: 'jira', status: 'active', accountLabel: 'acme.atlassian.net' }],
}: {
  connections?: Array<{ id: string; integrationId: string; status: string; accountLabel: string | null }>;
} = {}) {
  const minted: Array<{ kind: 'connect' | 'reconnect'; connectionId: string }> = [];
  const session = (connectionId: string) => ({
    connectionId,
    integrationId: 'jira',
    connectUrl: 'https://connect.nango.dev/session-token',
    sessionToken: 'session-token',
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
  });
  server.use(
    http.get(JIRA_CONNECTIONS_URL, () => HttpResponse.json({ connections })),
    http.post(JIRA_CONNECT_SESSION_URL, () => {
      const connectionId = connections[0]?.id ?? 'a1b_new';
      minted.push({ kind: 'connect', connectionId });
      return HttpResponse.json(session(connectionId), { status: 201 });
    }),
    http.post(`${JIRA_CONNECTIONS_URL}/:connectionId/reconnect-session`, ({ params }) => {
      const connectionId = String(params.connectionId);
      minted.push({ kind: 'reconnect', connectionId });
      return HttpResponse.json(session(connectionId), { status: 201 });
    }),
  );
  return minted;
}

const FACTORY_A = '11111111-1111-4111-8111-111111111111';
const FACTORY_B = '22222222-2222-4222-8222-222222222222';

function baseConfig(): IntakeConfig {
  return {
    github: { enabled: true, sourceIds: null },
    gitlab: { enabled: false, sourceIds: null },
    linear: { enabled: true, sourceIds: null },
    jira: { enabled: false, sourceIds: null },
    incidentio: { enabled: false, sourceIds: null },
  };
}

const githubReadyStatus: GithubStatus = {
  enabled: true,
  connected: true,
  installations: [{ installationId: 1, accountLogin: 'acme', accountType: 'Organization' }],
  reason: 'ready',
};

const connectedStatus: LinearStatus = {
  enabled: true,
  connected: true,
  workspace: { name: 'Acme', urlKey: 'acme' },
  reason: 'ready',
};

const engTeam = {
  id: 'team-eng',
  key: 'ENG',
  name: 'Engineering',
  sourceId: 'linear-team:opaque-eng',
};
const designTeam = { id: 'team-des', key: 'DES', name: 'Design' };

const linearProjects: LinearProject[] = [
  { id: 'lproj-1', name: 'Q3 Roadmap', state: 'started', teams: [engTeam] },
  { id: 'lproj-2', name: 'Design refresh', state: 'planned', teams: [] },
  { id: 'lproj-3', name: 'Shared initiative', state: 'started', teams: [engTeam, designTeam] },
];

const linearTeams = [engTeam, designTeam];

function seedGithubProject() {
  server.use(
    http.get(`${TEST_BASE_URL}/web/factory/projects`, () =>
      HttpResponse.json({ projects: [{ id: 'fp-1', name: 'mastra' }] }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/fp-1/source-control-connections`, () =>
      HttpResponse.json({
        connections: [
          {
            id: 'conn-fp-1',
            repositories: [
              {
                id: 'ghp-1',
                branch: null,
                sandboxWorkdir: null,
                repository: { slug: 'mastra', defaultBranch: 'main' },
              },
            ],
          },
        ],
      }),
    ),
  );
}

function useIntakeHandlers({
  config = baseConfig(),
  status = connectedStatus,
  githubStatus = githubReadyStatus,
}: {
  config?: IntakeConfig;
  status?: LinearStatus;
  githubStatus?: GithubStatus;
} = {}) {
  const saved: IntakeConfig[] = [];
  server.use(
    http.get(CONFIG_URL, () => HttpResponse.json({ config })),
    http.put(CONFIG_URL, async ({ request }) => {
      const next = (await request.json()) as IntakeConfig;
      saved.push(next);
      return HttpResponse.json({ config: next });
    }),
    http.get(GITHUB_STATUS_URL, () => HttpResponse.json(githubStatus)),
    http.get(LINEAR_STATUS_URL, () => HttpResponse.json(status)),
    http.get(LINEAR_PROJECTS_URL, () => HttpResponse.json({ projects: linearProjects })),
    http.get(LINEAR_TEAMS_URL, () => HttpResponse.json({ teams: linearTeams })),
    http.get(`${TEST_BASE_URL}/web/intake/bindings`, () => HttpResponse.json({ bindings: [] })),
    http.get(`${TEST_BASE_URL}/web/factory/projects/:id/boards`, () => HttpResponse.json({ boards: [] })),
  );
  return saved;
}

const jiraReadyStatus: JiraStatus = {
  enabled: true,
  configured: true,
  mode: 'platform',
  site: 'acme.atlassian.net',
  sites: ['acme.atlassian.net', 'beta.atlassian.net'],
  connections: [
    {
      id: 'a1b_acme',
      integrationId: 'jira',
      status: 'active',
      accountLabel: 'acme.atlassian.net',
    },
    {
      id: 'a1b_beta',
      integrationId: 'jira',
      status: 'active',
      accountLabel: 'beta.atlassian.net',
    },
  ],
  reason: 'ready',
};

const jiraProjects: JiraProject[] = [
  { id: '10001', key: 'ENG', name: 'Engineering', connectionId: 'a1b_acme', site: 'acme.atlassian.net' },
  { id: '10002', key: 'OPS', name: 'Operations', connectionId: 'a1b_beta', site: 'beta.atlassian.net' },
];

/**
 * Layer connected Jira sites on top of the base intake handlers. The ambient
 * MSW handlers answer `/web/jira/*` with 404 when Platform integration access
 * is unavailable, so unavailable-feature specs skip this helper.
 */
function useJiraHandlers({
  config = baseConfig(),
  bindings = [],
}: { config?: IntakeConfig; bindings?: IntakeSourceBinding[] } = {}) {
  const saved = useIntakeHandlers({ config });
  const savedBindings: Array<{
    integrationId: string;
    sourceId: string;
    factoryProjectId: string | null;
    board: string | null;
  }> = [];
  server.use(
    http.get(JIRA_STATUS_URL, () => HttpResponse.json(jiraReadyStatus)),
    http.get(JIRA_PROJECTS_URL, () => HttpResponse.json({ projects: jiraProjects })),
    http.get(BINDINGS_URL, () => HttpResponse.json({ bindings })),
    http.put(BINDINGS_URL, async ({ request }) => {
      const body = (await request.json()) as {
        integrationId: string;
        sourceId: string;
        factoryProjectId: string | null;
        board: string | null;
      };
      savedBindings.push(body);
      const next = body.factoryProjectId === null ? [] : [body as IntakeSourceBinding];
      return HttpResponse.json({ bindings: next });
    }),
  );
  return { saved, savedBindings };
}

function useIncidentioHandlers({
  config = { ...baseConfig(), incidentio: { enabled: true, sourceIds: ['incidentio-source:follow-ups'] } },
  bindings = [],
}: { config?: IntakeConfig; bindings?: IntakeSourceBinding[] } = {}) {
  const saved = useIntakeHandlers({ config });
  const savedBindings: Array<{
    integrationId: string;
    sourceId: string;
    factoryProjectId: string | null;
    board: string | null;
  }> = [];
  server.use(
    http.get(INCIDENTIO_CONNECTIONS_URL, () =>
      HttpResponse.json({
        connections: [
          {
            id: 'incidentio-acme',
            integrationId: 'incident-io',
            status: 'active',
            accountLabel: 'acme',
          },
        ],
      }),
    ),
    http.get(INTAKE_SOURCES_URL, () =>
      HttpResponse.json({
        sources: [
          {
            integrationId: 'incidentio',
            id: 'incidentio-source:incidents',
            name: 'Incidents (acme)',
            type: 'incident',
          },
          {
            integrationId: 'incidentio',
            id: 'incidentio-source:follow-ups',
            name: 'Incident follow-ups (acme)',
            type: 'follow-up',
          },
        ],
        failures: [],
      }),
    ),
    http.get(BINDINGS_URL, () => HttpResponse.json({ bindings })),
    http.put(BINDINGS_URL, async ({ request }) => {
      const body = (await request.json()) as {
        integrationId: string;
        sourceId: string;
        factoryProjectId: string | null;
        board: string | null;
      };
      savedBindings.push(body);
      const next = body.factoryProjectId === null ? [] : [body as IntakeSourceBinding];
      return HttpResponse.json({ bindings: next });
    }),
  );
  return { saved, savedBindings };
}

const gitlabReadyStatus: GitLabStatus = {
  enabled: true,
  configured: true,
  connections: [{ id: 'a1b_acme', integrationId: 'gitlab', status: 'active', accountLabel: 'acme' }],
  accounts: ['acme'],
  reauthRequired: false,
  reason: 'ready',
};

const gitlabProjects: GitLabProject[] = [
  {
    id: 'gitlab-project:encoded',
    name: 'acme/app',
    connectionId: 'a1b_acme',
    accountLabel: 'acme',
    defaultBranch: 'main',
  },
];

function useGitLabHandlers(config: IntakeConfig, status: GitLabStatus = gitlabReadyStatus) {
  const saved = useIntakeHandlers({ config });
  const savedBindings: Array<{
    integrationId: string;
    sourceId: string;
    factoryProjectId: string | null;
    board: string | null;
  }> = [];
  server.use(
    http.get(GITLAB_STATUS_URL, () => HttpResponse.json(status)),
    http.get(GITLAB_PROJECTS_URL, () => HttpResponse.json({ projects: gitlabProjects })),
    http.get(`${TEST_BASE_URL}/web/factory/projects`, () =>
      HttpResponse.json({ projects: [{ id: 'fp-1', name: 'Acme Web' }] }),
    ),
    http.get(BINDINGS_URL, () => HttpResponse.json({ bindings: savedBindings })),
    http.put(BINDINGS_URL, async ({ request }) => {
      const body = (await request.json()) as (typeof savedBindings)[number];
      const index = savedBindings.findIndex(
        binding => binding.integrationId === body.integrationId && binding.sourceId === body.sourceId,
      );
      if (index === -1) savedBindings.push(body);
      else savedBindings[index] = body;
      return HttpResponse.json({ bindings: savedBindings });
    }),
    http.get(`${TEST_BASE_URL}/web/factory/projects/:id/boards`, () =>
      HttpResponse.json({
        boards: [{ id: 'work', title: 'Work', initialPhase: 'intake', phases: [] }],
      }),
    ),
  );
  return { saved, savedBindings };
}

function seedFactories() {
  server.use(
    http.get(`${TEST_BASE_URL}/web/factory/projects`, () =>
      HttpResponse.json({
        projects: [
          { id: FACTORY_A, name: 'Acme Web' },
          { id: FACTORY_B, name: 'Acme API' },
        ],
      }),
    ),
  );
}

function renderIntakeSection() {
  return renderWithProviders(
    <>
      <IntakeSection />
      <Toaster position="bottom-right" />
    </>,
  );
}

describe('IntakeSection', () => {
  describe('given a config with the default sources enabled', () => {
    it('lists every work intake source and expands the configured pickers', async () => {
      seedGithubProject();
      useIntakeHandlers();

      renderIntakeSection();

      expect(await screen.findByRole('switch', { name: 'Sync GitHub issues' })).toBeChecked();
      expect(await screen.findByRole('switch', { name: 'Sync Linear issues' })).toBeChecked();
      expect(await screen.findByRole('switch', { name: 'Sync Jira issues' })).toBeInTheDocument();

      expect(await screen.findByRole('checkbox', { name: 'mastra' })).toBeInTheDocument();
      expect(await screen.findByRole('checkbox', { name: 'Q3 Roadmap' })).toBeInTheDocument();
      expect(screen.getByRole('checkbox', { name: 'Design refresh' })).toBeInTheDocument();
    });

    it('groups Linear projects by team, listing shared projects under each team', async () => {
      seedGithubProject();
      useIntakeHandlers();

      renderIntakeSection();

      const projects = await screen.findByRole('group', { name: 'Linear projects and teams' });

      expect(within(projects).getByText('Engineering')).toBeInTheDocument();
      expect(within(projects).getByText('Design')).toBeInTheDocument();
      expect(within(projects).getByText('No team')).toBeInTheDocument();
      // Shared across Engineering and Design, so it is listed under both.
      expect(within(projects).getAllByRole('checkbox', { name: 'Shared initiative' })).toHaveLength(2);

      // Listed twice, selected once: the count follows ids, not rows.
      const linearSection = screen.getByRole('region', { name: 'Linear issues' });
      await userEvent.click(within(projects).getAllByRole('checkbox', { name: 'Shared initiative' })[0]!);
      await waitFor(() => expect(within(linearSection).getByText('1 selected')).toBeInTheDocument());
    });

    it('shows how many items are selected', async () => {
      seedGithubProject();
      useIntakeHandlers({
        config: {
          github: { enabled: true, sourceIds: ['mastra'] },
          gitlab: { enabled: false, sourceIds: null },
          linear: { enabled: true, sourceIds: ['lproj-1'] },
          jira: { enabled: false, sourceIds: null },
          incidentio: { enabled: false, sourceIds: null },
        },
      });

      renderIntakeSection();

      // One count per source picker: the selected repository and the selected project.
      await waitFor(() => expect(screen.getAllByText('1 selected')).toHaveLength(2));
    });

    it('filters every team from one search bar', async () => {
      useIntakeHandlers();

      renderIntakeSection();

      const search = await screen.findByRole('textbox', { name: 'Search Linear projects and teams' });
      expect(await screen.findByRole('checkbox', { name: 'Design refresh' })).toBeInTheDocument();

      await userEvent.type(search, 'road');

      // ListSearch debounces before filtering.
      await waitFor(() => expect(screen.queryByRole('checkbox', { name: 'Design refresh' })).not.toBeInTheDocument());
      expect(screen.getByRole('checkbox', { name: 'Q3 Roadmap' })).toBeInTheDocument();
      // The match lives in Engineering, so only that team heading survives.
      expect(screen.queryByText('No team')).not.toBeInTheDocument();

      await userEvent.clear(search);
      await userEvent.type(search, 'zzz');
      expect(await screen.findByText('No matches')).toBeInTheDocument();
    });
  });

  describe('when the GitHub source is toggled off', () => {
    it('persists the config with github disabled', async () => {
      seedGithubProject();
      const saved = useIntakeHandlers();

      renderIntakeSection();

      await userEvent.click(await screen.findByRole('switch', { name: 'Sync GitHub issues' }));

      await waitFor(() => expect(saved).toHaveLength(1));
      expect(saved[0]!.github.enabled).toBe(false);
      expect(saved[0]!.linear.enabled).toBe(true);
      expect(await screen.findByText('Intake sources updated')).toBeInTheDocument();
    });
  });

  describe('given GitHub is not configured on the server', () => {
    it('disables GitHub intake and hides repository controls', async () => {
      seedGithubProject();
      useIntakeHandlers({
        githubStatus: {
          enabled: false,
          connected: false,
          installations: [],
          reason: 'missing_config',
        },
      });

      renderIntakeSection();

      expect(await screen.findByText('GitHub is not configured on this server.')).toBeInTheDocument();
      expect(screen.getByRole('switch', { name: 'Sync GitHub issues' })).toBeDisabled();
      expect(screen.queryByRole('checkbox', { name: 'mastra' })).not.toBeInTheDocument();
      expect(screen.queryByRole('region', { name: 'GitHub routing' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();
    });
  });

  describe('given the GitHub status endpoint fails', () => {
    it('reports the status as unavailable with a retry instead of claiming GitHub is not configured', async () => {
      seedGithubProject();
      useIntakeHandlers();
      const statusRequests: number[] = [];
      server.use(
        http.get(GITHUB_STATUS_URL, () => {
          statusRequests.push(statusRequests.length + 1);
          // First call fails; the retry reaches a healthy server.
          if (statusRequests.length === 1) return HttpResponse.json({ error: 'boom' }, { status: 500 });
          return HttpResponse.json(githubReadyStatus);
        }),
      );

      renderIntakeSection();

      expect(await screen.findByText('GitHub status could not be loaded.')).toBeInTheDocument();
      expect(screen.queryByText('GitHub is not configured on this server.')).not.toBeInTheDocument();
      expect(screen.getByRole('switch', { name: 'Sync GitHub issues' })).toBeDisabled();
      expect(screen.queryByRole('checkbox', { name: 'mastra' })).not.toBeInTheDocument();
      expect(statusRequests).toHaveLength(1);

      await userEvent.click(screen.getByRole('button', { name: 'Retry' }));

      await waitFor(() => expect(statusRequests).toHaveLength(2));
      expect(await screen.findByRole('checkbox', { name: 'mastra' })).toBeInTheDocument();
      expect(screen.getByRole('switch', { name: 'Sync GitHub issues' })).toBeEnabled();
      expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();
    });
  });

  describe('when a Linear project is picked', () => {
    it('persists an explicit project selection', async () => {
      const saved = useIntakeHandlers();

      renderIntakeSection();

      await userEvent.click(await screen.findByRole('checkbox', { name: 'Q3 Roadmap' }));

      await waitFor(() => expect(saved).toHaveLength(1));
      expect(saved[0]!.linear.sourceIds).toEqual(['lproj-1']);
    });

    it('disables the checkboxes and shows a spinner while the selection saves', async () => {
      useIntakeHandlers();
      let releaseSave!: () => void;
      const savePending = new Promise<void>(resolve => {
        releaseSave = resolve;
      });
      server.use(
        http.put(CONFIG_URL, async ({ request }) => {
          await savePending;
          return HttpResponse.json({ config: (await request.json()) as IntakeConfig });
        }),
      );

      renderIntakeSection();

      await userEvent.click(await screen.findByRole('checkbox', { name: 'Q3 Roadmap' }));

      expect(
        await screen.findByRole('status', { name: 'Saving Linear projects and teams selection' }),
      ).toBeInTheDocument();
      // Base UI's checkbox root is a span, so disabled state is exposed via aria-disabled.
      expect(screen.getByRole('checkbox', { name: 'Q3 Roadmap' })).toHaveAttribute('aria-disabled', 'true');

      releaseSave();

      await waitFor(() =>
        expect(
          screen.queryByRole('status', { name: 'Saving Linear projects and teams selection' }),
        ).not.toBeInTheDocument(),
      );
      expect(screen.getByRole('checkbox', { name: 'Q3 Roadmap' })).not.toHaveAttribute('aria-disabled');
    });

    it('persists the selection when the row label is clicked instead of the checkbox', async () => {
      const saved = useIntakeHandlers();

      renderIntakeSection();

      await userEvent.click(await screen.findByText('Q3 Roadmap'));
      await waitFor(() => expect(saved).toHaveLength(1));
      expect(saved[0]!.linear.sourceIds).toEqual(['lproj-1']);

      // A second, different pick lands after any duplicate the first click could
      // have fired, so a doubled label toggle shows up as a third request here.
      await userEvent.click(await screen.findByText('Design refresh'));
      await waitFor(() => expect(saved).toHaveLength(2));
    });
  });

  describe('when a Linear team is picked', () => {
    it('persists the team as its own source id', async () => {
      const saved = useIntakeHandlers();

      renderIntakeSection();

      await userEvent.click(await screen.findByRole('checkbox', { name: 'All issues in Engineering' }));

      await waitFor(() => expect(saved).toHaveLength(1));
      expect(saved[0]!.linear.sourceIds).toEqual(['linear-team:opaque-eng']);
    });
    it('waits for a returned team DTO before enabling opaque team selection', async () => {
      const saved = useIntakeHandlers();
      let releaseTeams!: () => void;
      const teamsPending = new Promise<void>(resolve => {
        releaseTeams = resolve;
      });
      server.use(
        http.get(LINEAR_TEAMS_URL, async () => {
          await teamsPending;
          return HttpResponse.json({ teams: linearTeams });
        }),
      );

      renderIntakeSection();

      expect(await screen.findByRole('checkbox', { name: 'Q3 Roadmap' })).toBeInTheDocument();
      expect(screen.queryByRole('checkbox', { name: 'All issues in Engineering' })).not.toBeInTheDocument();

      releaseTeams();

      const team = await screen.findByRole('checkbox', { name: 'All issues in Engineering' });
      await userEvent.click(team);
      await waitFor(() => expect(saved).toHaveLength(1));
      expect(saved[0]!.linear.sourceIds).toEqual(['linear-team:opaque-eng']);
    });

    it('keeps explicit projects editable so the selection can switch to team-only intake', async () => {
      const saved = useIntakeHandlers({
        config: {
          github: { enabled: true, sourceIds: null },
          gitlab: { enabled: false, sourceIds: null },
          linear: { enabled: true, sourceIds: ['linear-team:opaque-eng', 'lproj-1'] },
          jira: { enabled: false, sourceIds: null },
          incidentio: { enabled: false, sourceIds: null },
        },
      });

      renderIntakeSection();

      // The explicit project remains actionable because it wins over the team
      // source until the user removes it.
      const project = await screen.findByRole('checkbox', { name: /Q3 Roadmap/ });
      expect(project).toBeChecked();
      expect(project).not.toHaveAttribute('aria-disabled');
      const linearSection = screen.getByRole('region', { name: 'Linear issues' });
      expect(within(linearSection).getByText('project takes precedence')).toBeInTheDocument();

      await userEvent.click(project);
      await waitFor(() => expect(saved).toHaveLength(1));
      expect(saved[0]!.linear.sourceIds).toEqual(['linear-team:opaque-eng']);

      // Projects that are only included through a selected team remain selectable too.
      expect(within(linearSection).getAllByText('included via team').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByRole('checkbox', { name: /Design refresh/ })).not.toHaveAttribute('aria-disabled');
    });
  });

  describe('when a GitHub repository is picked', () => {
    it('persists an explicit repository selection under sourceIds', async () => {
      seedGithubProject();
      const saved = useIntakeHandlers();

      renderIntakeSection();

      await userEvent.click(await screen.findByRole('checkbox', { name: 'mastra' }));

      await waitFor(() => expect(saved).toHaveLength(1));
      // The board and intake integrations key GitHub sources by repo slug (owner/name).
      expect(saved[0]!.github.sourceIds).toEqual(['mastra']);
      expect(saved[0]).not.toHaveProperty('github.repositoryIds');
    });
  });

  describe('given Linear is connected', () => {
    it('shows the workspace name with a reconnect option', async () => {
      useIntakeHandlers();

      renderIntakeSection();

      expect(await screen.findByText('Connected to Acme')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Reconnect' })).toBeInTheDocument();
    });
  });

  describe('given the Linear authorization has expired', () => {
    it('offers to reconnect instead of an empty project picker', async () => {
      useIntakeHandlers();
      server.use(
        http.get(LINEAR_PROJECTS_URL, () => HttpResponse.json({ error: 'linear_reauth_required' }, { status: 409 })),
      );

      renderIntakeSection();

      expect(
        await screen.findByText('Linear authorization expired. Reconnect to keep syncing issues.'),
      ).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Reconnect Linear' })).toBeInTheDocument();
      expect(screen.queryByRole('checkbox', { name: 'Q3 Roadmap' })).not.toBeInTheDocument();
    });
  });

  describe('given Linear is not connected', () => {
    it('shows the connect prompt instead of the project picker', async () => {
      useIntakeHandlers({
        status: { enabled: true, connected: false, workspace: null, reason: 'not_connected' },
      });

      renderIntakeSection();

      expect(await screen.findByText('Connect a Linear workspace to sync its issues.')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Connect Linear' })).toBeInTheDocument();
      expect(screen.queryByRole('checkbox', { name: 'Q3 Roadmap' })).not.toBeInTheDocument();
      expect(screen.getByRole('switch', { name: 'Sync Linear issues' })).toBeDisabled();
    });
  });

  describe('given Linear is not configured on the server', () => {
    it('explains the source is unavailable without a connect button', async () => {
      useIntakeHandlers({ status: { enabled: false, connected: false, workspace: null, reason: 'missing_config' } });

      renderIntakeSection();

      expect(await screen.findByText('Linear is not configured on this server.')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Connect Linear' })).not.toBeInTheDocument();
    });
  });

  describe('given Jira uses deployment credentials', () => {
    it('keeps the self-hosted setup guidance when the integration is unavailable', async () => {
      useIntakeHandlers();
      server.use(
        http.get(JIRA_STATUS_URL, () =>
          HttpResponse.json({
            enabled: false,
            configured: false,
            mode: 'direct',
            site: null,
            reason: 'missing_config',
          } satisfies JiraStatus),
        ),
      );

      renderIntakeSection();

      expect(
        await screen.findByText(
          'Jira is not configured on this server. Set JIRA_BASE_URL, JIRA_EMAIL, and JIRA_API_TOKEN to enable it.',
        ),
      ).toBeInTheDocument();
      expect(screen.getByRole('switch', { name: 'Sync Jira issues' })).toBeDisabled();
    });
  });

  describe('given the organization has no connected Jira account', () => {
    it('connects Jira headlessly through a minted platform session', async () => {
      useIntakeHandlers();
      const minted = usePlatformConnectHandlers();
      server.use(
        http.get(JIRA_STATUS_URL, () =>
          HttpResponse.json({
            enabled: true,
            configured: false,
            mode: 'platform',
            site: null,
            sites: [],
            connections: [],
            reason: 'not_connected',
          } satisfies JiraStatus),
        ),
      );

      renderIntakeSection();

      expect(
        await screen.findByText('Connect a Jira account to sync issues from this organization.'),
      ).toBeInTheDocument();
      expect(screen.getByRole('switch', { name: 'Sync Jira issues' })).toBeDisabled();
      expect(screen.getByRole('switch', { name: 'Sync Jira issues' })).not.toBeChecked();

      await userEvent.click(screen.getByRole('button', { name: 'Connect Jira' }));

      // The SPA runs the provider's OAuth popup itself, keyed by the
      // server-minted session token — no Platform round trip.
      await waitFor(() => expect(nangoAuthCalls).toHaveLength(1));
      expect(minted).toEqual([{ kind: 'connect', connectionId: 'a1b_acme' }]);
      expect(nangoConstructorOptions[0]).toEqual({ connectSessionToken: 'session-token' });
      expect(nangoAuthCalls[0]).toEqual({
        integrationId: 'jira',
        options: { detectClosedAuthWindow: true },
      });
      expect(await screen.findByText('Jira connected')).toBeInTheDocument();
    });

    it('reconnects the rejected account headlessly when Jira needs reauthorization', async () => {
      useIntakeHandlers();
      const minted = usePlatformConnectHandlers();
      server.use(
        http.get(JIRA_STATUS_URL, () =>
          HttpResponse.json({
            enabled: true,
            configured: false,
            mode: 'platform',
            site: null,
            sites: [],
            connections: [
              {
                id: 'a1b_acme',
                integrationId: 'jira',
                status: 'needs_reauth',
                accountLabel: 'acme.atlassian.net',
              },
            ],
            reason: 'not_connected',
          } satisfies JiraStatus),
        ),
      );

      renderIntakeSection();

      expect(await screen.findByText('A connected Jira account needs to be reconnected.')).toBeInTheDocument();
      expect(screen.getByRole('switch', { name: 'Sync Jira issues' })).toBeDisabled();

      await userEvent.click(screen.getByRole('button', { name: 'Reconnect Jira' }));

      await waitFor(() => expect(nangoAuthCalls).toHaveLength(1));
      expect(minted).toEqual([{ kind: 'reconnect', connectionId: 'a1b_acme' }]);
      expect(nangoConstructorOptions[0]).toEqual({ connectSessionToken: 'session-token' });
    });
  });

  describe('given Jira is configured on the server', () => {
    it('enables the toggle and persists switching Jira on', async () => {
      const { saved } = useJiraHandlers();

      renderIntakeSection();

      const toggle = await screen.findByRole('switch', { name: 'Sync Jira issues' });
      expect(toggle).toBeEnabled();
      expect(toggle).not.toBeChecked();

      await userEvent.click(toggle);

      await waitFor(() => expect(saved).toHaveLength(1));
      expect(saved[0]!.jira.enabled).toBe(true);
      expect(saved[0]!.github.enabled).toBe(true);
    });

    it('shows a Platform-managed connection even when the status does not expose connection metadata', async () => {
      useJiraHandlers({ config: { ...baseConfig(), jira: { enabled: true, sourceIds: null } } });
      server.use(
        http.get(JIRA_STATUS_URL, () =>
          HttpResponse.json({
            enabled: true,
            configured: true,
            mode: 'platform',
            site: null,
            sites: [],
            reason: 'ready',
          } satisfies JiraStatus),
        ),
      );

      renderIntakeSection();

      expect(await screen.findByText('Connected through Mastra Platform')).toBeInTheDocument();
      expect(screen.getByRole('switch', { name: 'Sync Jira issues' })).toBeEnabled();
      expect(await screen.findByRole('group', { name: 'Jira projects' })).toBeInTheDocument();
    });

    it('shows the site and persists an explicit project selection', async () => {
      const { saved } = useJiraHandlers({
        config: { ...baseConfig(), jira: { enabled: true, sourceIds: null } },
      });

      renderIntakeSection();

      expect(await screen.findByText('2 Jira sites connected')).toBeInTheDocument();
      // Each site appears both as a connection row (with its own reconnect
      // affordance) and as a project group label in the picker.
      expect(await screen.findAllByText('acme.atlassian.net')).not.toHaveLength(0);
      expect(await screen.findAllByText('beta.atlassian.net')).not.toHaveLength(0);
      const jiraSection = screen.getByRole('region', { name: 'Jira issues' });
      expect(within(jiraSection).getAllByRole('button', { name: 'Reconnect' })).toHaveLength(2);

      const projects = await screen.findByRole('group', { name: 'Jira projects' });
      await userEvent.click(within(projects).getByRole('checkbox', { name: 'ENG · Engineering' }));

      await waitFor(() => expect(saved).toHaveLength(1));
      expect(saved[0]!.jira.sourceIds).toEqual(['10001']);
    });

    it('routes a selected Jira project to a Factory through the generic bindings', async () => {
      seedFactories();
      const { savedBindings } = useJiraHandlers({
        config: { ...baseConfig(), jira: { enabled: true, sourceIds: ['10001'] } },
      });

      renderIntakeSection();

      // Unrouted projects warn that no board picks them up.
      expect(await screen.findByText(/Not routed — this source's issues won't be picked up\./)).toBeInTheDocument();

      await userEvent.click(await screen.findByLabelText('Factory for ENG · Engineering'));
      await userEvent.click(await screen.findByRole('option', { name: 'Acme Web' }));

      await waitFor(() => expect(savedBindings).toHaveLength(1));
      expect(savedBindings[0]).toEqual({
        integrationId: 'jira',
        sourceId: '10001',
        factoryProjectId: FACTORY_A,
        board: null,
      });
      expect(await screen.findByText('Jira routing updated')).toBeInTheDocument();
    });

    it('clears a Jira routing back to not routed', async () => {
      seedFactories();
      const { savedBindings } = useJiraHandlers({
        config: { ...baseConfig(), jira: { enabled: true, sourceIds: ['10001'] } },
        bindings: [{ integrationId: 'jira', sourceId: '10001', factoryProjectId: FACTORY_A, board: 'work' }],
      });

      renderIntakeSection();

      const trigger = await screen.findByLabelText('Factory for ENG · Engineering');
      await waitFor(() => expect(trigger).toHaveTextContent('Acme Web'));

      await userEvent.click(trigger);
      await userEvent.click(await screen.findByRole('option', { name: 'Not routed' }));

      await waitFor(() => expect(savedBindings).toHaveLength(1));
      expect(savedBindings[0]).toEqual({
        integrationId: 'jira',
        sourceId: '10001',
        factoryProjectId: null,
        board: null,
      });
    });

    it('surfaces rejected connections as reconnect guidance instead of an empty picker', async () => {
      useJiraHandlers({ config: { ...baseConfig(), jira: { enabled: true, sourceIds: null } } });
      server.use(
        http.get(JIRA_PROJECTS_URL, () =>
          HttpResponse.json({ error: 'jira_auth_failed', message: 'Jira rejected the credentials' }, { status: 409 }),
        ),
      );

      renderIntakeSection();

      expect(
        await screen.findByText('Jira rejected a connected account. Reconnect it to resume syncing.'),
      ).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Reconnect Jira' })).toBeInTheDocument();
      expect(screen.queryByRole('group', { name: 'Jira projects' })).not.toBeInTheDocument();
    });
  });

  describe('given the incident.io Platform connect route is mounted', () => {
    it('collects an API key in a dialog and submits it without a popup', async () => {
      useIntakeHandlers();
      const connections: Array<{
        id: string;
        integrationId: string;
        status: string;
        accountLabel: string | null;
      }> = [];
      server.use(
        http.get(`${TEST_BASE_URL}/web/integrations/platform/incident-io/connections`, () =>
          HttpResponse.json({ connections }),
        ),
        http.post(`${TEST_BASE_URL}/web/integrations/platform/incident-io/connect-session`, () => {
          connections.push({ id: 'inc-1', integrationId: 'incident-io', status: 'active', accountLabel: 'Acme' });
          return HttpResponse.json(
            {
              connectionId: 'inc-1',
              integrationId: 'incident-io',
              connectUrl: 'https://connect.nango.dev/session-token',
              sessionToken: 'incident-session-token',
              expiresAt: new Date(Date.now() + 60_000).toISOString(),
            },
            { status: 201 },
          );
        }),
      );

      renderIntakeSection();

      const section = await screen.findByRole('region', { name: 'incident.io follow-ups' });
      await userEvent.click(within(section).getByRole('button', { name: 'Connect incident.io' }));

      const dialog = await screen.findByRole('dialog');
      await userEvent.type(within(dialog).getByLabelText('incident.io API key'), 'inc-api-key');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Connect' }));

      await waitFor(() => expect(nangoAuthCalls).toHaveLength(1));
      expect(nangoConstructorOptions[0]).toEqual({ connectSessionToken: 'incident-session-token' });
      expect(nangoAuthCalls[0]).toEqual({
        integrationId: 'incident-io',
        options: { credentials: { apiKey: 'inc-api-key' } },
      });
      expect(await screen.findByText('incident.io connected')).toBeInTheDocument();
    });
  });

  describe('given incident.io follow-up intake is configured', () => {
    it('routes only follow-up sources and marks incident board configuration as coming soon', async () => {
      seedFactories();
      const { savedBindings } = useIncidentioHandlers();
      server.use(
        http.get(`${TEST_BASE_URL}/web/factory/projects/:id/boards`, () =>
          HttpResponse.json({ boards: [{ id: 'work', title: 'Work' }] }),
        ),
      );

      renderIntakeSection();

      const section = await screen.findByRole('region', { name: 'incident.io follow-ups' });
      expect(within(section).getByRole('checkbox', { name: 'Incident follow-ups (acme)' })).toBeChecked();
      expect(within(section).queryByRole('checkbox', { name: 'Incidents (acme)' })).not.toBeInTheDocument();
      expect(within(section).getByText('Incident board configuration')).toBeInTheDocument();
      expect(within(section).getByText('Coming soon')).toBeInTheDocument();

      await userEvent.click(await screen.findByLabelText('Factory for Incident follow-ups (acme)'));
      await userEvent.click(await screen.findByRole('option', { name: 'Acme Web' }));

      await waitFor(() => expect(savedBindings).toHaveLength(1));
      expect(savedBindings[0]).toEqual({
        integrationId: 'incidentio',
        sourceId: 'incidentio-source:follow-ups',
        factoryProjectId: FACTORY_A,
        board: null,
      });

      await userEvent.click(await screen.findByLabelText('Board for Incident follow-ups (acme)'));
      await userEvent.click(await screen.findByRole('option', { name: 'Work' }));

      await waitFor(() => expect(savedBindings).toHaveLength(2));
      expect(savedBindings[1]).toEqual({
        integrationId: 'incidentio',
        sourceId: 'incidentio-source:follow-ups',
        factoryProjectId: FACTORY_A,
        board: 'work',
      });
    });
  });

  describe('given a deployment API key serves incident.io without Platform connections', () => {
    it('keeps the section usable for source selection and routing', async () => {
      seedFactories();
      useIntakeHandlers({
        config: { ...baseConfig(), incidentio: { enabled: true, sourceIds: ['incidentio-source:follow-ups'] } },
      });
      // The ambient platform-connections 404 stands in for a server without
      // Platform credentials; only the direct status route answers.
      server.use(
        http.get(`${TEST_BASE_URL}/web/incidentio/status`, () =>
          HttpResponse.json({ enabled: true, configured: true, mode: 'api-key', reason: 'ready' }),
        ),
        http.get(INTAKE_SOURCES_URL, () =>
          HttpResponse.json({
            sources: [
              {
                integrationId: 'incidentio',
                id: 'incidentio-source:follow-ups',
                name: 'Incident follow-ups (acme)',
                type: 'follow-up',
              },
            ],
            failures: [],
          }),
        ),
      );

      renderIntakeSection();

      const section = await screen.findByRole('region', { name: 'incident.io follow-ups' });
      expect(within(section).getByText('incident.io API key configured on this server')).toBeInTheDocument();
      expect(within(section).queryByRole('button', { name: 'Connect incident.io' })).not.toBeInTheDocument();
      const toggle = within(section).getByRole('switch', { name: 'Sync incident.io follow-ups' });
      expect(toggle).toBeChecked();
      expect(toggle).toBeEnabled();
      expect(await within(section).findByRole('checkbox', { name: 'Incident follow-ups (acme)' })).toBeChecked();
      // Routing stays reachable so the source can feed a Factory board.
      expect(await screen.findByLabelText('Factory for Incident follow-ups (acme)')).toBeInTheDocument();
    });

    it('stays usable when the Platform connections request fails', async () => {
      seedFactories();
      useIntakeHandlers({
        config: { ...baseConfig(), incidentio: { enabled: true, sourceIds: ['incidentio-source:follow-ups'] } },
      });
      // The direct integration does not need Platform connections, so a
      // transient Platform failure must not collapse the section into the
      // retry-only stub.
      server.use(
        http.get(`${TEST_BASE_URL}/web/integrations/platform/incident-io/connections`, () =>
          HttpResponse.json({ error: 'boom' }, { status: 500 }),
        ),
        http.get(`${TEST_BASE_URL}/web/incidentio/status`, () =>
          HttpResponse.json({ enabled: true, configured: true, mode: 'api-key', reason: 'ready' }),
        ),
        http.get(INTAKE_SOURCES_URL, () =>
          HttpResponse.json({
            sources: [
              {
                integrationId: 'incidentio',
                id: 'incidentio-source:follow-ups',
                name: 'Incident follow-ups (acme)',
                type: 'follow-up',
              },
            ],
            failures: [],
          }),
        ),
      );

      renderIntakeSection();

      const section = await screen.findByRole('region', { name: 'incident.io follow-ups' });
      expect(within(section).getByText('incident.io API key configured on this server')).toBeInTheDocument();
      expect(within(section).queryByText("Couldn't load incident.io connections.")).not.toBeInTheDocument();
      const toggle = within(section).getByRole('switch', { name: 'Sync incident.io follow-ups' });
      expect(toggle).toBeChecked();
      expect(toggle).toBeEnabled();
      expect(await within(section).findByRole('checkbox', { name: 'Incident follow-ups (acme)' })).toBeChecked();
    });

    it('keeps intake gated while the API key still needs an organization', async () => {
      seedFactories();
      useIntakeHandlers({
        config: { ...baseConfig(), incidentio: { enabled: true, sourceIds: ['incidentio-source:follow-ups'] } },
      });
      // An organization-required key cannot list follow-ups yet, so the
      // section must not offer controls or fire the sources request.
      let sourceRequests = 0;
      server.use(
        http.get(`${TEST_BASE_URL}/web/incidentio/status`, () =>
          HttpResponse.json({
            enabled: true,
            configured: true,
            mode: 'api-key',
            organizationRequired: true,
            reason: 'organization_required',
          }),
        ),
        http.get(INTAKE_SOURCES_URL, () => {
          sourceRequests += 1;
          return HttpResponse.json({ sources: [], failures: [] });
        }),
      );

      renderIntakeSection();

      // Let the rest of the page settle so the absence assertion is meaningful.
      await screen.findByRole('switch', { name: 'Sync GitHub issues' });
      expect(screen.queryByRole('region', { name: 'incident.io follow-ups' })).not.toBeInTheDocument();
      expect(sourceRequests).toBe(0);
    });
  });

  describe('given the server omits unregistered integrations', () => {
    // The server returns a dynamic map keyed by integration id and drops keys
    // for integrations that aren't registered, so the config can arrive as `{}`.
    // The fixed-shape reads must not crash on the missing `github`/`linear` keys.
    it('renders both sources with default toggles instead of crashing', async () => {
      seedGithubProject();
      server.use(
        http.get(CONFIG_URL, () => HttpResponse.json({ config: {} })),
        http.get(GITHUB_STATUS_URL, () =>
          HttpResponse.json({ enabled: false, connected: false, installations: [], reason: 'missing_config' }),
        ),
        http.get(LINEAR_STATUS_URL, () => HttpResponse.json(connectedStatus)),
        http.get(LINEAR_PROJECTS_URL, () => HttpResponse.json({ projects: linearProjects })),
        http.get(LINEAR_TEAMS_URL, () => HttpResponse.json({ teams: linearTeams })),
      );

      renderIntakeSection();

      // Missing provider entries stay off, and unavailable providers cannot be toggled on.
      expect(await screen.findByRole('switch', { name: 'Sync GitHub issues' })).not.toBeChecked();
      expect(screen.getByRole('switch', { name: 'Sync GitHub issues' })).toBeDisabled();
      expect(screen.getByRole('switch', { name: 'Sync Linear issues' })).not.toBeChecked();
      expect(screen.getByRole('switch', { name: 'Sync GitLab issues' })).not.toBeChecked();
    });
  });

  describe('given the config endpoint fails', () => {
    it('shows the unavailable notice', async () => {
      server.use(
        http.get(CONFIG_URL, () => HttpResponse.json({ error: 'nope' }, { status: 500 })),
        http.get(GITHUB_STATUS_URL, () => HttpResponse.json(githubReadyStatus)),
        http.get(LINEAR_STATUS_URL, () => HttpResponse.json(connectedStatus)),
        http.get(LINEAR_PROJECTS_URL, () => HttpResponse.json({ projects: linearProjects })),
        http.get(LINEAR_TEAMS_URL, () => HttpResponse.json({ teams: linearTeams })),
      );

      renderIntakeSection();

      expect(await screen.findByText(/Intake configuration is unavailable/)).toBeInTheDocument();
    });
  });

  describe('given GitLab is configured', () => {
    it('does not offer a linked GitLab repository as a GitHub intake source', async () => {
      useGitLabHandlers({
        ...baseConfig(),
        gitlab: { enabled: true, sourceIds: null },
      });
      server.use(
        http.get(`${TEST_BASE_URL}/web/factory/projects/fp-1/source-control-connections`, () =>
          HttpResponse.json({
            connections: [
              {
                id: 'gitlab-connection',
                integrationId: 'gitlab',
                installationId: 'gitlab-installation',
                repositories: [
                  {
                    id: 'gitlab-link',
                    branch: 'main',
                    sandboxWorkdir: '~/app',
                    repository: { slug: 'acme/app', defaultBranch: 'main' },
                  },
                ],
              },
            ],
          }),
        ),
      );

      renderIntakeSection();

      const githubSection = await screen.findByRole('region', { name: 'GitHub issues' });
      expect(await within(githubSection).findByText(/No linked repositories yet/)).toBeInTheDocument();
      expect(within(githubSection).queryByRole('checkbox', { name: 'acme/app' })).not.toBeInTheDocument();
      expect(screen.queryByRole('region', { name: 'GitHub routing' })).not.toBeInTheDocument();
      const gitlabProjects = await screen.findByRole('group', { name: 'GitLab projects' });
      expect(within(gitlabProjects).getByRole('checkbox', { name: 'acme/app' })).toBeInTheDocument();
    });

    it('selects a project and routes it to a Factory board', async () => {
      const { saved, savedBindings } = useGitLabHandlers({
        ...baseConfig(),
        gitlab: { enabled: true, sourceIds: null },
      });

      renderIntakeSection();

      expect(await screen.findByText('Connected to acme')).toBeInTheDocument();
      const projects = await screen.findByRole('group', { name: 'GitLab projects' });
      await userEvent.click(within(projects).getByRole('checkbox', { name: 'acme/app' }));

      await waitFor(() => expect(saved).toHaveLength(1));
      expect(saved[0]!.gitlab.sourceIds).toEqual(['gitlab-project:encoded']);
      expect(await screen.findByText(/Not routed — this source's issues won't be picked up/)).toBeInTheDocument();

      await userEvent.click(await screen.findByLabelText('Factory for acme/app'));
      await userEvent.click(await screen.findByRole('option', { name: 'Acme Web' }));
      await userEvent.click(await screen.findByLabelText('Board for acme/app'));
      await userEvent.click(await screen.findByRole('option', { name: 'Work' }));

      await waitFor(() =>
        expect(savedBindings).toEqual([
          {
            integrationId: 'gitlab',
            sourceId: 'gitlab-project:encoded',
            factoryProjectId: 'fp-1',
            board: 'work',
          },
        ]),
      );
      expect((await screen.findAllByText('GitLab routing updated')).length).toBeGreaterThan(0);
    });

    it('keeps healthy projects available when another Platform connection needs reauthorization', async () => {
      useGitLabHandlers(
        { ...baseConfig(), gitlab: { enabled: true, sourceIds: null } },
        {
          ...gitlabReadyStatus,
          connections: [
            ...gitlabReadyStatus.connections!,
            { id: 'a1b_old', integrationId: 'gitlab', status: 'needs_reauth', accountLabel: 'old' },
          ],
          reauthRequired: true,
        },
      );

      renderIntakeSection();

      expect(
        await screen.findByText('A GitLab account needs to be reconnected in Mastra Platform.'),
      ).toBeInTheDocument();
      expect(await screen.findByRole('checkbox', { name: 'acme/app' })).toBeInTheDocument();
    });
  });
});
