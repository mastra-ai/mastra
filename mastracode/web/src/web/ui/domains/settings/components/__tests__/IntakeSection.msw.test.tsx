import { Toaster } from '@mastra/playground-ui/components/Toaster';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../../../../e2e/web-ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../../../../../e2e/web-ui/render';
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
    it('renders the GitHub repository and Linear project pickers behind collapsible sections', async () => {
      seedGithubProject();
      useIntakeHandlers();

      renderIntakeSection();

      expect(await screen.findByText('Intake sources')).toBeInTheDocument();
      expect(await screen.findByRole('switch', { name: 'Sync GitHub repositories' })).toBeChecked();
      expect(await screen.findByRole('switch', { name: 'Sync Linear projects' })).toBeChecked();

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

      await userEvent.click(await screen.findByRole('switch', { name: 'Sync GitHub repositories' }));

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
      expect(screen.getByRole('switch', { name: 'Sync Linear projects' })).toBeDisabled();
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
