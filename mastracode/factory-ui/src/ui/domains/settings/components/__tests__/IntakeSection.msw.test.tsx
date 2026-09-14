import { Toaster } from '@mastra/playground-ui/components/Toaster';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../../../../e2e/ui/render';
import type { IntakeConfig } from '../../../factory/services/intake';
import type { LinearProject, LinearStatus } from '../../../factory/services/linear';
import { IntakeSection } from '../IntakeSection';

const CONFIG_URL = `${TEST_BASE_URL}/web/intake/config`;
const LINEAR_STATUS_URL = `${TEST_BASE_URL}/web/linear/status`;
const LINEAR_PROJECTS_URL = `${TEST_BASE_URL}/web/linear/projects`;

function baseConfig(): IntakeConfig {
  return {
    github: { enabled: true, sourceIds: null },
    linear: { enabled: true, sourceIds: null },
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
    it('lists the GitHub repositories and Linear projects without an extra expand step', async () => {
      seedGithubProject();
      useIntakeHandlers();

      renderIntakeSection();

      expect(await screen.findByRole('switch', { name: 'Sync GitHub issues' })).toBeChecked();
      expect(await screen.findByRole('switch', { name: 'Sync Linear issues' })).toBeChecked();

      expect(await screen.findByRole('checkbox', { name: 'mastra' })).toBeInTheDocument();
      expect(await screen.findByRole('checkbox', { name: 'Q3 Roadmap' })).toBeInTheDocument();
      expect(screen.getByRole('checkbox', { name: 'Design refresh' })).toBeInTheDocument();
    });

    it('groups Linear projects by team, listing shared projects under each team', async () => {
      seedGithubProject();
      useIntakeHandlers();

      renderIntakeSection();

      const projects = await screen.findByRole('group', { name: 'Linear projects' });

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
          linear: { enabled: true, sourceIds: ['lproj-1'] },
        },
      });

      renderIntakeSection();

      // One count per source picker: the selected repository and the selected project.
      await waitFor(() => expect(screen.getAllByText('1 selected')).toHaveLength(2));
    });

    it('filters every team from one search bar', async () => {
      useIntakeHandlers();

      renderIntakeSection();

      const search = await screen.findByRole('textbox', { name: 'Search Linear projects' });
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

      expect(await screen.findByRole('status', { name: 'Saving Linear projects selection' })).toBeInTheDocument();
      // Base UI's checkbox root is a span, so disabled state is exposed via aria-disabled.
      expect(screen.getByRole('checkbox', { name: 'Q3 Roadmap' })).toHaveAttribute('aria-disabled', 'true');

      releaseSave();

      await waitFor(() =>
        expect(screen.queryByRole('status', { name: 'Saving Linear projects selection' })).not.toBeInTheDocument(),
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
