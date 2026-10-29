import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '../../../../../../../e2e/ui/msw-server';
import type { IntakeConfig } from '../../../../factory/services/intake';
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
      expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
      const connectedSources = screen.getByRole('region', { name: 'Connected sources' });
      const availableSources = screen.getByRole('region', { name: 'Add a source' });
      expect(within(connectedSources).getByRole('region', { name: 'GitHub' })).toBeInTheDocument();
      expect(within(connectedSources).getByRole('region', { name: 'Linear' })).toBeInTheDocument();
      expect(connectedSources).not.toContainElement(availableSources);
      await openSourcePicker('Linear projects and teams');
      expect(await screen.findByRole('checkbox', { name: 'Q3 Roadmap' })).toBeInTheDocument();
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
      expect(await screen.findByRole('checkbox', { name: 'Q3 Roadmap' })).toBeInTheDocument();
    });
  });

  describe('when the GitHub source is toggled off', () => {
    it('sends back a custom integration selection it does not render', async () => {
      seedGithubProject();
      const custom = { enabled: false, sourceIds: ['src-1'] };
      const saved = useIntakeHandlers({ config: { ...baseConfig(), 'custom-tracker': custom } });

      renderIntakeSection();

      await userEvent.click(await screen.findByRole('switch', { name: 'Sync GitHub issues' }));

      await waitFor(() => expect(saved).toHaveLength(1));
      expect(saved[0].github.enabled).toBe(false);
      expect(saved[0]['custom-tracker']).toEqual(custom);
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

      const connect = await screen.findByRole('link', { name: 'Connect Linear' });
      expect(connect).toHaveAttribute('href', '/factories/fp-1/settings/connections?add=1');
      expect(screen.getByRole('region', { name: 'Add a source' })).toContainElement(connect);
      expect(screen.getByRole('region', { name: 'Connected sources' })).not.toContainElement(connect);
      expect(screen.queryByRole('switch', { name: 'Sync Linear issues' })).not.toBeInTheDocument();
    });
  });

  describe('when a Linear project is picked', () => {
    it('disables the checkboxes and shows a spinner while the selection saves', async () => {
      useIntakeHandlers();
      let releaseSave!: () => void;
      const savePending = new Promise<void>(resolve => {
        releaseSave = resolve;
      });
      server.use(
        http.put<Record<string, never>, IntakeConfig>(CONFIG_URL, async ({ request }) => {
          await savePending;
          return HttpResponse.json({ config: await request.json() });
        }),
      );

      renderIntakeSection();
      await openSourcePicker('Linear projects and teams');

      await userEvent.click(await screen.findByRole('checkbox', { name: 'Q3 Roadmap' }));

      expect(
        await screen.findByRole('status', { name: 'Saving Linear projects and teams selection' }),
      ).toBeInTheDocument();
      expect(screen.getByRole('checkbox', { name: 'Q3 Roadmap' })).toHaveAttribute('aria-disabled', 'true');

      releaseSave();

      await waitFor(() =>
        expect(
          screen.queryByRole('status', { name: 'Saving Linear projects and teams selection' }),
        ).not.toBeInTheDocument(),
      );
      await closeSourcePicker();
      expect(await screen.findByRole('button', { name: 'Remove Q3 Roadmap' })).toBeEnabled();
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
  });

  describe('given no source is connected', () => {
    it('lists sources to add without an empty connected section', async () => {
      useIntakeHandlers({
        githubStatus: { enabled: true, connected: false, installations: [], reason: 'ready' },
        status: { enabled: true, connected: false, workspace: null, reason: 'not_connected' },
      });

      renderIntakeSection();

      expect(await screen.findByRole('region', { name: 'Add a source' })).toBeInTheDocument();
      expect(screen.queryByRole('region', { name: 'Connected sources' })).not.toBeInTheDocument();
      expect(screen.queryByText('Connected sources')).not.toBeInTheDocument();
    });
  });
});
