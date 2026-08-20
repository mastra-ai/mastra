import { Toaster } from '@mastra/playground-ui/components/Toaster';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../../../../e2e/ui/render';
import type { IntakeConfig, IntakeSourceBinding } from '../../../factory/services/intake';
import type { JiraProject, JiraStatus } from '../../../factory/services/jira';
import type { LinearProject, LinearStatus } from '../../../factory/services/linear';
import { IntakeSection } from '../IntakeSection';

const CONFIG_URL = `${TEST_BASE_URL}/web/intake/config`;
const BINDINGS_URL = `${TEST_BASE_URL}/web/intake/bindings`;
const LINEAR_STATUS_URL = `${TEST_BASE_URL}/web/linear/status`;
const LINEAR_PROJECTS_URL = `${TEST_BASE_URL}/web/linear/projects`;
const JIRA_STATUS_URL = `${TEST_BASE_URL}/web/jira/status`;
const JIRA_PROJECTS_URL = `${TEST_BASE_URL}/web/jira/projects`;

const FACTORY_A = '11111111-1111-4111-8111-111111111111';
const FACTORY_B = '22222222-2222-4222-8222-222222222222';

function baseConfig(): IntakeConfig {
  return {
    github: { enabled: true, sourceIds: null },
    linear: { enabled: true, sourceIds: null },
    jira: { enabled: false, sourceIds: null },
  };
}

const connectedStatus: LinearStatus = {
  enabled: true,
  connected: true,
  workspace: { name: 'Acme', urlKey: 'acme' },
  reason: 'ready',
};

const engTeam = { id: 'team-eng', key: 'ENG', name: 'Engineering' };
const designTeam = { id: 'team-des', key: 'DES', name: 'Design' };

const linearProjects: LinearProject[] = [
  { id: 'lproj-1', name: 'Q3 Roadmap', state: 'started', teams: [engTeam] },
  { id: 'lproj-2', name: 'Design refresh', state: 'planned', teams: [] },
  { id: 'lproj-3', name: 'Shared initiative', state: 'started', teams: [engTeam, designTeam] },
];

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
}: { config?: IntakeConfig; status?: LinearStatus } = {}) {
  const saved: IntakeConfig[] = [];
  server.use(
    http.get(CONFIG_URL, () => HttpResponse.json({ config })),
    http.put(CONFIG_URL, async ({ request }) => {
      const next = (await request.json()) as IntakeConfig;
      saved.push(next);
      return HttpResponse.json({ config: next });
    }),
    http.get(LINEAR_STATUS_URL, () => HttpResponse.json(status)),
    http.get(LINEAR_PROJECTS_URL, () => HttpResponse.json({ projects: linearProjects })),
  );
  return saved;
}

const jiraReadyStatus: JiraStatus = {
  enabled: true,
  configured: true,
  site: 'acme.atlassian.net',
  reason: 'ready',
};

const jiraProjects: JiraProject[] = [
  { id: '10001', key: 'ENG', name: 'Engineering' },
  { id: '10002', key: 'OPS', name: 'Operations' },
];

/**
 * Layer a configured Jira deployment on top of the base intake handlers. The
 * ambient MSW handlers answer `/web/jira/*` with 404 (a server without the
 * `JIRA_*` env group), so unconfigured-deployment specs skip this helper.
 */
function useJiraHandlers({
  config = baseConfig(),
  bindings = [],
}: { config?: IntakeConfig; bindings?: IntakeSourceBinding[] } = {}) {
  const saved = useIntakeHandlers({ config });
  const savedBindings: Array<{ integrationId: string; sourceId: string; factoryProjectId: string | null }> = [];
  server.use(
    http.get(JIRA_STATUS_URL, () => HttpResponse.json(jiraReadyStatus)),
    http.get(JIRA_PROJECTS_URL, () => HttpResponse.json({ projects: jiraProjects })),
    http.get(BINDINGS_URL, () => HttpResponse.json({ bindings })),
    http.put(BINDINGS_URL, async ({ request }) => {
      const body = (await request.json()) as { integrationId: string; sourceId: string; factoryProjectId: string | null };
      savedBindings.push(body);
      const next = body.factoryProjectId === null ? [] : [body as IntakeSourceBinding];
      return HttpResponse.json({ bindings: next });
    }),
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
  describe('given a config with both sources enabled', () => {
    it('renders the GitHub repository and Linear project pickers behind collapsible sections', async () => {
      seedGithubProject();
      useIntakeHandlers();

      renderIntakeSection();

      expect(await screen.findByText(/feed issues into Intake/)).toBeInTheDocument();
      expect(await screen.findByRole('switch', { name: 'Sync GitHub issues' })).toBeChecked();
      expect(await screen.findByRole('switch', { name: 'Sync Linear issues' })).toBeChecked();

      await userEvent.click(await screen.findByRole('button', { name: 'Repositories' }));
      expect(await screen.findByRole('checkbox', { name: 'mastra' })).toBeInTheDocument();

      await userEvent.click(await screen.findByRole('button', { name: 'ENG · Engineering' }));
      expect(await screen.findByRole('checkbox', { name: 'Q3 Roadmap' })).toBeInTheDocument();

      await userEvent.click(screen.getByRole('button', { name: 'No team' }));
      expect(await screen.findByRole('checkbox', { name: 'Design refresh' })).toBeInTheDocument();
    });

    it('groups Linear projects by team, listing shared projects under each team', async () => {
      seedGithubProject();
      useIntakeHandlers();

      renderIntakeSection();

      const eng = await screen.findByRole('group', { name: 'ENG · Engineering' });
      await userEvent.click(within(eng).getByRole('button', { name: 'ENG · Engineering' }));
      expect(within(eng).getByRole('checkbox', { name: 'Q3 Roadmap' })).toBeInTheDocument();
      expect(within(eng).getByRole('checkbox', { name: 'Shared initiative' })).toBeInTheDocument();

      const design = screen.getByRole('group', { name: 'DES · Design' });
      await userEvent.click(within(design).getByRole('button', { name: 'DES · Design' }));
      expect(within(design).getByRole('checkbox', { name: 'Shared initiative' })).toBeInTheDocument();

      const noTeam = screen.getByRole('group', { name: 'No team' });
      await userEvent.click(within(noTeam).getByRole('button', { name: 'No team' }));
      expect(within(noTeam).getByRole('checkbox', { name: 'Design refresh' })).toBeInTheDocument();
    });

    it('starts every section collapsed, hiding the checkboxes until expanded', async () => {
      seedGithubProject();
      useIntakeHandlers();

      renderIntakeSection();

      expect(await screen.findByRole('button', { name: 'ENG · Engineering' })).toBeInTheDocument();
      expect(await screen.findByRole('button', { name: 'Repositories' })).toBeInTheDocument();
      expect(screen.queryByRole('checkbox', { name: 'Q3 Roadmap' })).not.toBeInTheDocument();
      expect(screen.queryByRole('checkbox', { name: 'mastra' })).not.toBeInTheDocument();
    });

    it('shows a selected count on the collapsed trigger', async () => {
      seedGithubProject();
      useIntakeHandlers({
        config: {
          github: { enabled: true, sourceIds: ['mastra'] },
          linear: { enabled: true, sourceIds: ['lproj-1'] },
          jira: { enabled: false, sourceIds: null },
        },
      });

      renderIntakeSection();

      const eng = await screen.findByRole('group', { name: 'ENG · Engineering' });
      expect(within(eng).getByText('1 selected')).toBeInTheDocument();
      expect(screen.queryByRole('checkbox', { name: 'Q3 Roadmap' })).not.toBeInTheDocument();

      const repos = screen.getByRole('group', { name: 'Repositories' });
      expect(within(repos).getByText('1 selected')).toBeInTheDocument();

      const design = screen.getByRole('group', { name: 'DES · Design' });
      expect(within(design).queryByText(/selected/)).not.toBeInTheDocument();
    });

    it('filters the section list from its search bar', async () => {
      useIntakeHandlers();

      renderIntakeSection();

      const eng = await screen.findByRole('group', { name: 'ENG · Engineering' });
      await userEvent.click(within(eng).getByRole('button', { name: 'ENG · Engineering' }));
      expect(within(eng).getByRole('checkbox', { name: 'Shared initiative' })).toBeInTheDocument();

      await userEvent.type(within(eng).getByRole('textbox', { name: 'Search ENG · Engineering' }), 'road');

      // ListSearch debounces before filtering.
      await waitFor(() =>
        expect(within(eng).queryByRole('checkbox', { name: 'Shared initiative' })).not.toBeInTheDocument(),
      );
      expect(within(eng).getByRole('checkbox', { name: 'Q3 Roadmap' })).toBeInTheDocument();

      await userEvent.clear(within(eng).getByRole('textbox', { name: 'Search ENG · Engineering' }));
      await userEvent.type(within(eng).getByRole('textbox', { name: 'Search ENG · Engineering' }), 'zzz');
      expect(await within(eng).findByText('No matches')).toBeInTheDocument();
    });

    it('clears the search when the section is collapsed', async () => {
      useIntakeHandlers();

      renderIntakeSection();

      const eng = await screen.findByRole('group', { name: 'ENG · Engineering' });
      const trigger = within(eng).getByRole('button', { name: 'ENG · Engineering' });
      await userEvent.click(trigger);
      await userEvent.type(within(eng).getByRole('textbox', { name: 'Search ENG · Engineering' }), 'road');
      await waitFor(() =>
        expect(within(eng).queryByRole('checkbox', { name: 'Shared initiative' })).not.toBeInTheDocument(),
      );

      await userEvent.click(trigger); // collapse
      await userEvent.click(trigger); // reopen

      expect(within(eng).getByRole('textbox', { name: 'Search ENG · Engineering' })).toHaveValue('');
      expect(within(eng).getByRole('checkbox', { name: 'Q3 Roadmap' })).toBeInTheDocument();
      expect(within(eng).getByRole('checkbox', { name: 'Shared initiative' })).toBeInTheDocument();
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

  describe('when a Linear project is picked', () => {
    it('persists an explicit project selection', async () => {
      const saved = useIntakeHandlers();

      renderIntakeSection();

      await userEvent.click(await screen.findByRole('button', { name: 'ENG · Engineering' }));
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

      const eng = await screen.findByRole('group', { name: 'ENG · Engineering' });
      await userEvent.click(within(eng).getByRole('button', { name: 'ENG · Engineering' }));
      await userEvent.click(within(eng).getByRole('checkbox', { name: 'Q3 Roadmap' }));

      expect(
        await within(eng).findByRole('status', { name: 'Saving ENG · Engineering selection' }),
      ).toBeInTheDocument();
      // Base UI's checkbox root is a span, so disabled state is exposed via aria-disabled.
      expect(within(eng).getByRole('checkbox', { name: 'Q3 Roadmap' })).toHaveAttribute('aria-disabled', 'true');

      releaseSave();

      await waitFor(() =>
        expect(
          within(eng).queryByRole('status', { name: 'Saving ENG · Engineering selection' }),
        ).not.toBeInTheDocument(),
      );
      expect(within(eng).getByRole('checkbox', { name: 'Q3 Roadmap' })).not.toHaveAttribute('aria-disabled');
    });

    it('persists the selection when the row itself is clicked instead of the checkbox', async () => {
      const saved = useIntakeHandlers();

      renderIntakeSection();

      const eng = await screen.findByRole('group', { name: 'ENG · Engineering' });
      await userEvent.click(within(eng).getByRole('button', { name: 'ENG · Engineering' }));
      await userEvent.click(within(eng).getByRole('button', { name: 'Q3 Roadmap' }));

      await waitFor(() => expect(saved).toHaveLength(1));
      expect(saved[0]!.linear.sourceIds).toEqual(['lproj-1']);
      // Row click and checkbox click share one toggle — no duplicate PUT.
      expect(saved).toHaveLength(1);
    });
  });

  describe('when a GitHub repository is picked', () => {
    it('persists an explicit repository selection under sourceIds', async () => {
      seedGithubProject();
      const saved = useIntakeHandlers();

      renderIntakeSection();

      await userEvent.click(await screen.findByRole('button', { name: 'Repositories' }));
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

  describe('given Jira is not configured on the server', () => {
    it('explains the env-only setup with a disabled toggle and no connect button', async () => {
      // Only the base handlers — the ambient `/web/jira/*` 404s stand in for a
      // server without the JIRA_* env group.
      useIntakeHandlers();

      renderIntakeSection();

      expect(
        await screen.findByText(
          'Jira is not configured on this server. Set JIRA_BASE_URL, JIRA_EMAIL, and JIRA_API_TOKEN to enable it.',
        ),
      ).toBeInTheDocument();
      expect(screen.getByRole('switch', { name: 'Sync Jira issues' })).toBeDisabled();
      expect(screen.getByRole('switch', { name: 'Sync Jira issues' })).not.toBeChecked();
      expect(screen.queryByRole('button', { name: /Connect Jira/ })).not.toBeInTheDocument();
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

    it('shows the site and persists an explicit project selection', async () => {
      const { saved } = useJiraHandlers({
        config: { ...baseConfig(), jira: { enabled: true, sourceIds: null } },
      });

      renderIntakeSection();

      expect(await screen.findByText('Connected to acme.atlassian.net')).toBeInTheDocument();

      const projects = await screen.findByRole('group', { name: 'Projects' });
      await userEvent.click(within(projects).getByRole('button', { name: 'Projects' }));
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
      expect(await screen.findByText(/Not routed — this project's issues won't be picked up\./)).toBeInTheDocument();

      await userEvent.click(await screen.findByLabelText('Factory for ENG · Engineering'));
      await userEvent.click(await screen.findByRole('option', { name: 'Acme Web' }));

      await waitFor(() => expect(savedBindings).toHaveLength(1));
      expect(savedBindings[0]).toEqual({ integrationId: 'jira', sourceId: '10001', factoryProjectId: FACTORY_A });
      expect(await screen.findByText('Jira routing updated')).toBeInTheDocument();
    });

    it('clears a Jira routing back to not routed', async () => {
      seedFactories();
      const { savedBindings } = useJiraHandlers({
        config: { ...baseConfig(), jira: { enabled: true, sourceIds: ['10001'] } },
        bindings: [{ integrationId: 'jira', sourceId: '10001', factoryProjectId: FACTORY_A }],
      });

      renderIntakeSection();

      const trigger = await screen.findByLabelText('Factory for ENG · Engineering');
      await waitFor(() => expect(trigger).toHaveTextContent('Acme Web'));

      await userEvent.click(trigger);
      await userEvent.click(await screen.findByRole('option', { name: 'Not routed' }));

      await waitFor(() => expect(savedBindings).toHaveLength(1));
      expect(savedBindings[0]).toEqual({ integrationId: 'jira', sourceId: '10001', factoryProjectId: null });
    });

    it('surfaces rejected credentials as operator guidance instead of an empty picker', async () => {
      useJiraHandlers({ config: { ...baseConfig(), jira: { enabled: true, sourceIds: null } } });
      server.use(
        http.get(JIRA_PROJECTS_URL, () =>
          HttpResponse.json({ error: 'jira_auth_failed', message: 'Jira rejected the credentials' }, { status: 409 }),
        ),
      );

      renderIntakeSection();

      expect(
        await screen.findByText('Jira rejected the configured credentials. Ask the operator to check the Jira API token.'),
      ).toBeInTheDocument();
      expect(screen.queryByRole('group', { name: 'Projects' })).not.toBeInTheDocument();
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
        http.get(LINEAR_STATUS_URL, () => HttpResponse.json(connectedStatus)),
        http.get(LINEAR_PROJECTS_URL, () => HttpResponse.json({ projects: linearProjects })),
      );

      renderIntakeSection();

      expect(await screen.findByText(/feed issues into Intake/)).toBeInTheDocument();
      // GitHub defaults to enabled; Linear stays off until it's connected here.
      expect(await screen.findByRole('switch', { name: 'Sync GitHub issues' })).toBeChecked();
      expect(screen.getByRole('switch', { name: 'Sync Linear issues' })).not.toBeChecked();
    });
  });

  describe('given the config endpoint fails', () => {
    it('shows the unavailable notice', async () => {
      server.use(
        http.get(CONFIG_URL, () => HttpResponse.json({ error: 'nope' }, { status: 500 })),
        http.get(LINEAR_STATUS_URL, () => HttpResponse.json(connectedStatus)),
        http.get(LINEAR_PROJECTS_URL, () => HttpResponse.json({ projects: linearProjects })),
      );

      renderIntakeSection();

      expect(await screen.findByText(/Intake configuration is unavailable/)).toBeInTheDocument();
    });
  });
});
