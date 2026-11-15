import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '../../../../../../../e2e/ui/msw-server';
import type { LinearStatus } from '../../../../factory/services/linear';
import {
  CONFIG_URL,
  BINDINGS_URL,
  GITHUB_STATUS_URL,
  LINEAR_STATUS_URL,
  LINEAR_PROJECTS_URL,
  LINEAR_TEAMS_URL,
  GITLAB_STATUS_URL,
  baseConfig,
  githubReadyStatus,
  connectedStatus,
  linearProjects,
  linearTeams,
  seedGithubProject,
  useIntakeHandlers,
  renderIntakeSection,
  openSourcePicker,
  closeSourcePicker,
  holdFirstPut,
} from './fixtures';

describe('IntakeSection common', () => {
  describe('given a config with the default sources enabled', () => {
    it('keeps source pickers closed until requested', async () => {
      seedGithubProject();
      useIntakeHandlers();

      renderIntakeSection();

      expect(await screen.findByRole('switch', { name: 'Sync GitHub issues' })).toBeChecked();
      expect(await screen.findByRole('switch', { name: 'Sync Linear issues' })).toBeChecked();
      expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      const connectedSources = screen.getByRole('region', { name: 'Connected sources' });
      const availableSources = screen.getByRole('region', { name: 'Add a source' });
      expect(within(connectedSources).getByRole('region', { name: 'GitHub' })).toBeInTheDocument();
      expect(within(connectedSources).getByRole('region', { name: 'Linear' })).toBeInTheDocument();
      expect(connectedSources).not.toContainElement(availableSources);
      await openSourcePicker('Linear projects and teams');
      expect(await screen.findByRole('button', { name: 'Add Q3 Roadmap' })).toBeInTheDocument();
    });

    it('focuses drawer search and returns to the add action on Escape', async () => {
      useIntakeHandlers();
      renderIntakeSection();
      const trigger = await screen.findByRole('button', { name: 'Add project or team to Linear projects and teams' });
      await userEvent.click(trigger);
      await waitFor(() =>
        expect(screen.getByRole('searchbox', { name: 'Search Linear projects and teams' })).toHaveFocus(),
      );
      await userEvent.keyboard('{Escape}');
      expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
      await waitFor(() => expect(trigger).toHaveFocus());
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      await userEvent.keyboard('{Enter}');
      expect(screen.getByRole('searchbox', { name: 'Search Linear projects and teams' })).toBeInTheDocument();
    });
  });

  describe('given Linear projects fail to load', () => {
    it('reports failed project loading with retry rather than empty search results', async () => {
      useIntakeHandlers();
      server.use(http.get(LINEAR_PROJECTS_URL, () => HttpResponse.json({ error: 'unavailable' }, { status: 500 })));
      renderIntakeSection();
      expect(await screen.findByText("Couldn't load Linear projects and teams.")).toBeInTheDocument();
      await openSourcePicker('Linear projects and teams');
      expect(screen.queryByText('No matches')).not.toBeInTheDocument();
      server.use(http.get(LINEAR_PROJECTS_URL, () => HttpResponse.json({ projects: linearProjects })));
      await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
      expect(await screen.findByRole('button', { name: 'Add Q3 Roadmap' })).toBeInTheDocument();
    });
  });

  describe('when the GitHub source is toggled off', () => {
    it('sends only the GitHub selection when GitHub is toggled off', async () => {
      seedGithubProject();
      const custom = { enabled: false, sourceIds: ['src-1'] };
      const saved = useIntakeHandlers({ config: { ...baseConfig(), 'custom-tracker': custom } });

      renderIntakeSection();

      await userEvent.click(await screen.findByRole('switch', { name: 'Sync GitHub issues' }));

      await waitFor(() => expect(saved).toEqual([{ github: { enabled: false, sourceIds: null } }]));
    });
  });

  describe('given a source status is still loading', () => {
    it('waits before classifying an unconnected source', async () => {
      useIntakeHandlers();
      let releaseStatus!: () => void;
      const pendingStatus = new Promise<void>(resolve => {
        releaseStatus = resolve;
      });
      let requested = false;
      server.use(
        http.get(LINEAR_STATUS_URL, async () => {
          requested = true;
          await pendingStatus;
          return HttpResponse.json({
            enabled: true,
            connected: false,
            workspace: null,
            reason: 'not_connected',
          } satisfies LinearStatus);
        }),
      );

      renderIntakeSection();

      await waitFor(() => expect(requested).toBe(true));
      expect(screen.getByRole('status', { name: 'Loading intake sources' })).toBeInTheDocument();
      expect(screen.queryByRole('region', { name: 'Linear' })).not.toBeInTheDocument();
      expect(screen.queryByRole('region', { name: 'Connected sources' })).not.toBeInTheDocument();

      releaseStatus();

      const connect = await screen.findByRole('button', { name: 'Connect Linear' });
      expect(screen.getByRole('region', { name: 'Add a source' })).toContainElement(connect);
      expect(screen.getByRole('region', { name: 'Connected sources' })).not.toContainElement(connect);
      expect(screen.queryByRole('switch', { name: 'Sync Linear issues' })).not.toBeInTheDocument();
    });
  });

  describe('when a Linear project is picked', () => {
    it('shows a picked source as added at once and keeps the drawer usable while it saves', async () => {
      const saved = useIntakeHandlers();
      const release = holdFirstPut(CONFIG_URL);
      renderIntakeSection();
      await openSourcePicker('Linear projects and teams');

      await userEvent.click(await screen.findByRole('button', { name: 'Add Q3 Roadmap' }));

      const drawer = screen.getByRole('dialog', { name: 'Add project or team' });
      const added = await within(drawer).findByRole('region', { name: 'Added' });
      expect(within(added).getByRole('button', { name: 'Remove Q3 Roadmap' })).toBeInTheDocument();
      expect(screen.getByRole('status', { name: 'Saving Linear projects and teams selection' })).toBeInTheDocument();
      expect(within(drawer).getByRole('button', { name: 'Add Design refresh' })).toBeEnabled();

      await closeSourcePicker();
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(screen.getByRole('button', { name: 'Remove Q3 Roadmap' })).toBeInTheDocument();
      expect(screen.getByRole('status', { name: 'Saving Linear projects and teams selection' })).toBeInTheDocument();

      release();

      await waitFor(() =>
        expect(
          screen.queryByRole('status', { name: 'Saving Linear projects and teams selection' }),
        ).not.toBeInTheDocument(),
      );
      expect(await screen.findByText('Intake sources updated')).toBeInTheDocument();
      expect(saved).toEqual([{ linear: { enabled: true, sourceIds: ['lproj-1'] } }]);
    });

    it('keeps every pick made while an earlier save is in flight, in click order', async () => {
      const saved = useIntakeHandlers();
      const release = holdFirstPut(CONFIG_URL);
      renderIntakeSection();
      await openSourcePicker('Linear projects and teams');

      await userEvent.click(await screen.findByRole('button', { name: 'Add Q3 Roadmap' }));
      await userEvent.click(screen.getByRole('button', { name: 'Add Design refresh' }));

      const added = within(screen.getByRole('dialog', { name: 'Add project or team' })).getByRole('region', {
        name: 'Added',
      });
      expect(within(added).getByRole('button', { name: 'Remove Q3 Roadmap' })).toBeInTheDocument();
      expect(within(added).getByRole('button', { name: 'Remove Design refresh' })).toBeInTheDocument();

      release();

      await waitFor(() =>
        expect(saved).toEqual([
          { linear: { enabled: true, sourceIds: ['lproj-1'] } },
          { linear: { enabled: true, sourceIds: ['lproj-1', 'lproj-2'] } },
        ]),
      );
      await closeSourcePicker();
      expect(await screen.findByRole('button', { name: 'Remove Q3 Roadmap' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Remove Design refresh' })).toBeInTheDocument();
    });

    it('takes a refused pick back and says why', async () => {
      useIntakeHandlers();
      server.use(http.put(CONFIG_URL, () => HttpResponse.json({ error: 'storage_unavailable' }, { status: 500 })));
      renderIntakeSection();
      await openSourcePicker('Linear projects and teams');

      await userEvent.click(await screen.findByRole('button', { name: 'Add Q3 Roadmap' }));

      expect(await screen.findByText('storage_unavailable')).toBeInTheDocument();
      const drawer = screen.getByRole('dialog', { name: 'Add project or team' });
      expect(await within(drawer).findByRole('button', { name: 'Add Q3 Roadmap' })).toBeInTheDocument();
      expect(within(drawer).queryByRole('region', { name: 'Added' })).not.toBeInTheDocument();
    });

    it('lets a refused pick be retried in the open drawer after the reload fails too', async () => {
      const saved = useIntakeHandlers();
      renderIntakeSection();
      await openSourcePicker('Linear projects and teams');
      let down = true;
      let reloadFailed = false;
      server.use(
        http.put(CONFIG_URL, () => (down ? HttpResponse.json({ error: 'bad_gateway' }, { status: 502 }) : undefined)),
        http.get(CONFIG_URL, () => {
          if (!down) return;
          reloadFailed = true;
          return HttpResponse.json({ error: 'unavailable' }, { status: 500 });
        }),
      );

      await userEvent.click(await screen.findByRole('button', { name: 'Add Q3 Roadmap' }));
      expect(await screen.findByText('bad_gateway')).toBeInTheDocument();
      await waitFor(() => expect(reloadFailed).toBe(true));
      down = false;

      const drawer = screen.getByRole('dialog', { name: 'Add project or team' });
      await userEvent.click(within(drawer).getByRole('button', { name: 'Add Q3 Roadmap' }));

      const added = await within(drawer).findByRole('region', { name: 'Added' });
      expect(within(added).getByRole('button', { name: 'Remove Q3 Roadmap' })).toBeInTheDocument();
      await waitFor(() => expect(saved).toEqual([{ linear: { enabled: true, sourceIds: ['lproj-1'] } }]));
    });
  });

  describe('given the server omits unregistered integrations', () => {
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

      expect(await screen.findByText('GitHub is not configured on this server.')).toBeInTheDocument();
      expect(screen.queryByRole('switch', { name: 'Sync GitHub issues' })).not.toBeInTheDocument();
      expect(screen.getByRole('switch', { name: 'Sync Linear issues' })).not.toBeChecked();
      expect(screen.queryByRole('switch', { name: 'Sync GitLab issues' })).not.toBeInTheDocument();
    });
  });

  describe('given the config endpoint fails', () => {
    it('shows the unavailable notice', async () => {
      server.use(
        http.get(BINDINGS_URL, () => HttpResponse.json({ bindings: [] })),
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

  describe('given a source status endpoint fails', () => {
    it.each([
      ['GitHub', GITHUB_STATUS_URL],
      ['GitLab', GITLAB_STATUS_URL],
    ])(
      'keeps an unknown %s connection out of the connected and available source lists',
      async (provider, statusUrl) => {
        useIntakeHandlers();
        server.use(http.get(statusUrl, () => HttpResponse.json({ error: 'unavailable' }, { status: 500 })));
        renderIntakeSection();
        const unavailableSources = await screen.findByRole('region', { name: 'Unavailable sources' });
        expect(within(unavailableSources).getByRole('region', { name: provider })).toBeInTheDocument();
        expect(
          within(screen.getByRole('region', { name: 'Connected sources' })).queryByRole('region', { name: provider }),
        ).not.toBeInTheDocument();
        expect(
          within(screen.getByRole('region', { name: 'Add a source' })).queryByRole('link', {
            name: `Connect ${provider}`,
          }),
        ).not.toBeInTheDocument();
        expect(within(unavailableSources).getByRole('button', { name: 'Retry' })).toBeInTheDocument();
      },
    );

    it('keeps Linear with saved sources out of the connected list while its status is unknown', async () => {
      const config = baseConfig();
      useIntakeHandlers({ config: { ...config, linear: { ...config.linear, sourceIds: ['project-1'] } } });
      server.use(http.get(LINEAR_STATUS_URL, () => HttpResponse.json({ error: 'unavailable' }, { status: 500 })));
      renderIntakeSection();
      const unavailableSources = await screen.findByRole('region', { name: 'Unavailable sources' });
      expect(within(unavailableSources).getByRole('region', { name: 'Linear' })).toBeInTheDocument();
      expect(within(unavailableSources).getByText("Couldn't load Linear status.")).toBeInTheDocument();
    });
  });

  describe('given no source is connected', () => {
    it('lists sources to add without an empty connected section', async () => {
      useIntakeHandlers({
        githubStatus: { enabled: true, connected: false, installations: [], reason: 'ready' },
        status: { enabled: true, connected: false, workspace: null, reason: 'not_connected' },
      });

      renderIntakeSection();

      const addSource = await screen.findByRole('region', { name: 'Add a source' });
      expect(within(addSource).getByRole('button', { name: 'Connect GitHub' })).toBeEnabled();
      expect(screen.queryByRole('region', { name: 'Connected sources' })).not.toBeInTheDocument();
      expect(screen.queryByText('Connected sources')).not.toBeInTheDocument();
    });
  });
});
