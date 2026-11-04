import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { listedRepository } from '../../../../../../../e2e/ui/factory-projects';
import { server } from '../../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL } from '../../../../../../../e2e/ui/render';
import {
  BINDINGS_URL,
  LINEAR_PROJECTS_URL,
  LINEAR_TEAMS_URL,
  baseConfig,
  engTeam,
  linearTeams,
  seedGithubProject,
  useIntakeHandlers,
  renderIntakeSection,
  openSourcePicker,
  closeSourcePicker,
} from './fixtures';

describe('IntakeSection linear', () => {
  describe('given a config with the default sources enabled', () => {
    it('groups Linear projects by team, listing shared projects under each team', async () => {
      seedGithubProject();
      useIntakeHandlers();

      renderIntakeSection();
      await openSourcePicker('Linear projects and teams');

      const projects = await screen.findByRole('group', { name: 'Linear projects and teams' });

      expect(within(projects).getByText('Engineering')).toBeInTheDocument();
      expect(within(projects).getByText('Design')).toBeInTheDocument();
      expect(within(projects).getByText('No team')).toBeInTheDocument();
      expect(within(projects).getAllByRole('checkbox', { name: 'Shared initiative' })).toHaveLength(2);

      await userEvent.click(within(projects).getAllByRole('checkbox', { name: 'Shared initiative' })[0]);
      await closeSourcePicker();
      expect(await screen.findByRole('button', { name: 'Remove Shared initiative' })).toBeInTheDocument();
    });

    it('maps a Linear project only to repositories in its routed Factory', async () => {
      seedGithubProject();
      const saved = useIntakeHandlers({
        config: { ...baseConfig(), linear: { enabled: true, sourceIds: ['lproj-1'] } },
      });
      server.use(
        http.get(BINDINGS_URL, () =>
          HttpResponse.json({
            bindings: [{ integrationId: 'linear', sourceId: 'lproj-1', factoryProjectId: 'fp-1', board: 'work' }],
          }),
        ),
        http.get(`${TEST_BASE_URL}/web/factory/projects`, () =>
          HttpResponse.json({
            projects: [
              { id: 'fp-1', name: 'mastra', repositories: [listedRepository('ghp-1', 'mastra')] },
              { id: 'fp-2', name: 'Other Factory', repositories: [listedRepository('ghp-2', 'unrelated/repo')] },
            ],
          }),
        ),
      );

      renderIntakeSection();
      await openSourcePicker('Linear repository mappings');

      const drawer = await screen.findByRole('dialog', { name: 'Add repository mapping' });
      expect(within(drawer).queryByRole('combobox', { name: 'Repository for Design refresh' })).not.toBeInTheDocument();
      await userEvent.click(await within(drawer).findByRole('combobox', { name: 'Repository for Q3 Roadmap' }));
      expect(screen.queryByRole('option', { name: 'unrelated/repo' })).not.toBeInTheDocument();
      await userEvent.click(await screen.findByRole('option', { name: 'mastra' }));

      await waitFor(() => expect(saved.at(-1)?.linear.repositoryByLinearProject).toEqual({ 'lproj-1': 'mastra' }));
      await waitFor(() =>
        expect(within(drawer).queryByRole('combobox', { name: 'Repository for Q3 Roadmap' })).not.toBeInTheDocument(),
      );
      await closeSourcePicker();
      const mappings = screen.getByRole('group', { name: 'Linear repository mappings' });
      expect(within(mappings).getByRole('combobox', { name: 'Repository for Q3 Roadmap' })).toHaveTextContent('mastra');
    });

    it('lists only mapped projects on the page and clears a mapping on remove', async () => {
      seedGithubProject();
      const saved = useIntakeHandlers({
        config: {
          ...baseConfig(),
          linear: { enabled: true, sourceIds: [engTeam.sourceId], repositoryByLinearProject: { 'lproj-1': 'mastra' } },
        },
      });
      server.use(
        http.get(BINDINGS_URL, () =>
          HttpResponse.json({
            bindings: [
              { integrationId: 'linear', sourceId: engTeam.sourceId, factoryProjectId: 'fp-1', board: 'work' },
            ],
          }),
        ),
      );

      renderIntakeSection();

      const mappings = await screen.findByRole('group', { name: 'Linear repository mappings' });
      expect(await within(mappings).findByRole('combobox', { name: 'Repository for Q3 Roadmap' })).toHaveTextContent(
        'mastra',
      );
      expect(
        within(mappings).queryByRole('combobox', { name: 'Repository for Shared initiative' }),
      ).not.toBeInTheDocument();

      await userEvent.click(within(mappings).getByRole('button', { name: 'Remove Q3 Roadmap' }));
      await waitFor(() => expect(saved.at(-1)?.linear.repositoryByLinearProject).toEqual({}));
    });

    it('keeps repository mapping available while Linear sync is off', async () => {
      seedGithubProject();
      useIntakeHandlers({
        config: { ...baseConfig(), linear: { enabled: false, sourceIds: ['lproj-1'] } },
      });
      server.use(
        http.get(BINDINGS_URL, () =>
          HttpResponse.json({
            bindings: [{ integrationId: 'linear', sourceId: 'lproj-1', factoryProjectId: 'fp-1', board: 'work' }],
          }),
        ),
        http.get(`${TEST_BASE_URL}/web/factory/projects`, () =>
          HttpResponse.json({
            projects: [{ id: 'fp-1', name: 'mastra', repositories: [listedRepository('ghp-1', 'mastra')] }],
          }),
        ),
      );

      renderIntakeSection();

      expect(
        await screen.findByRole('button', { name: 'Add repository mapping to Linear repository mappings' }),
      ).toBeInTheDocument();
    });

    it('maps projects included through a team source to that team’s routed Factory', async () => {
      seedGithubProject();
      const saved = useIntakeHandlers({
        config: { ...baseConfig(), linear: { enabled: true, sourceIds: [engTeam.sourceId] } },
      });
      server.use(
        http.get(BINDINGS_URL, () =>
          HttpResponse.json({
            bindings: [
              { integrationId: 'linear', sourceId: engTeam.sourceId, factoryProjectId: 'fp-1', board: 'work' },
            ],
          }),
        ),
      );

      renderIntakeSection();
      await openSourcePicker('Linear repository mappings');

      const drawer = await screen.findByRole('dialog', { name: 'Add repository mapping' });
      expect(within(drawer).getByRole('combobox', { name: 'Repository for Shared initiative' })).toBeInTheDocument();
      expect(within(drawer).queryByRole('combobox', { name: 'Repository for Design refresh' })).not.toBeInTheDocument();
      await userEvent.click(within(drawer).getByRole('combobox', { name: 'Repository for Q3 Roadmap' }));
      await userEvent.click(await screen.findByRole('option', { name: 'mastra' }));
      await waitFor(() => expect(saved.at(-1)?.linear.repositoryByLinearProject).toEqual({ 'lproj-1': 'mastra' }));
    });

    it('filters every team from one search bar', async () => {
      useIntakeHandlers();

      renderIntakeSection();
      await openSourcePicker('Linear projects and teams');

      const search = await screen.findByRole('searchbox', { name: 'Search Linear projects and teams' });
      expect(await screen.findByRole('checkbox', { name: 'Design refresh' })).toBeInTheDocument();

      await userEvent.type(search, 'road');

      await waitFor(() => expect(screen.queryByRole('checkbox', { name: 'Design refresh' })).not.toBeInTheDocument());
      expect(screen.getByRole('checkbox', { name: 'Q3 Roadmap' })).toBeInTheDocument();
      expect(screen.queryByText('No team')).not.toBeInTheDocument();

      await userEvent.clear(search);
      await userEvent.type(search, 'zzz');
      expect(await screen.findByText('No matches')).toBeInTheDocument();
    });
  });

  describe('when a Linear project is picked', () => {
    it('persists an explicit project selection', async () => {
      const saved = useIntakeHandlers();

      renderIntakeSection();
      await openSourcePicker('Linear projects and teams');

      await userEvent.click(await screen.findByRole('checkbox', { name: 'Q3 Roadmap' }));

      await waitFor(() => expect(saved).toHaveLength(1));
      expect(saved[0].linear.sourceIds).toEqual(['lproj-1']);
    });

    it('persists the selection when the row label is clicked instead of the checkbox', async () => {
      const saved = useIntakeHandlers();

      renderIntakeSection();
      await openSourcePicker('Linear projects and teams');

      await userEvent.click(await screen.findByText('Q3 Roadmap'));
      await waitFor(() => expect(saved).toHaveLength(1));
      expect(saved[0].linear.sourceIds).toEqual(['lproj-1']);

      await userEvent.click(await screen.findByText('Design refresh'));
      await waitFor(() => expect(saved).toHaveLength(2));
    });
  });

  describe('when the last selected Linear project is removed', () => {
    it('removes the final selected project without turning it into all-project intake', async () => {
      const saved = useIntakeHandlers({
        config: { ...baseConfig(), linear: { enabled: true, sourceIds: ['lproj-1'] } },
      });
      renderIntakeSection();
      await userEvent.click(await screen.findByRole('button', { name: 'Remove Q3 Roadmap' }));
      await waitFor(() => expect(saved).toHaveLength(1));
      expect(saved[0].linear.sourceIds).toBeNull();
      expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
      await waitFor(() =>
        expect(screen.queryByRole('combobox', { name: 'Factory for Q3 Roadmap' })).not.toBeInTheDocument(),
      );
    });
  });

  describe('when a Linear team is picked', () => {
    it('persists the team as its own source id', async () => {
      const saved = useIntakeHandlers();

      renderIntakeSection();
      await openSourcePicker('Linear projects and teams');

      await userEvent.click(await screen.findByRole('checkbox', { name: 'All issues in Engineering' }));

      await waitFor(() => expect(saved).toHaveLength(1));
      expect(saved[0].linear.sourceIds).toEqual(['linear-team:opaque-eng']);
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
      await openSourcePicker('Linear projects and teams');

      expect(await screen.findByRole('checkbox', { name: 'Q3 Roadmap' })).toBeInTheDocument();
      expect(screen.queryByRole('checkbox', { name: 'All issues in Engineering' })).not.toBeInTheDocument();

      releaseTeams();

      const team = await screen.findByRole('checkbox', { name: 'All issues in Engineering' });
      await userEvent.click(team);
      await waitFor(() => expect(saved).toHaveLength(1));
      expect(saved[0].linear.sourceIds).toEqual(['linear-team:opaque-eng']);
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

      const project = await screen.findByRole('button', { name: 'Remove Q3 Roadmap' });
      expect(project).toBeEnabled();
      const linearSection = screen.getByRole('region', { name: 'Linear' });
      const precedence = within(linearSection).getByText('project takes precedence');
      expect(within(precedence.parentElement!).getByText('Engineering')).toBeInTheDocument();

      await userEvent.click(project);
      await waitFor(() => expect(saved).toHaveLength(1));
      expect(saved[0].linear.sourceIds).toEqual(['linear-team:opaque-eng']);
      await openSourcePicker('Linear projects and teams');

      expect(screen.getAllByText('included via team').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByRole('checkbox', { name: /Design refresh/ })).not.toHaveAttribute('aria-disabled');
    });
  });

  describe('given saved sources from a Linear workspace that is no longer connected', () => {
    const encode = (prefix: string, payload: Record<string, string>) =>
      `${prefix}${Buffer.from(JSON.stringify(payload)).toString('base64url')}`;
    const liveProject = encode('linear-project:', { workspaceId: 'ws-live', projectId: 'p-live' });
    const liveTeam = encode('linear-team:', { workspaceId: 'ws-live', teamId: 't-live' });
    const deletedProject = encode('linear-project:', { workspaceId: 'ws-live', projectId: 'p-deleted' });
    const goneProject = encode('linear-project:', { workspaceId: 'ws-gone', projectId: 'p-gone' });
    const goneTeam = encode('linear-team:', { workspaceId: 'ws-gone', teamId: 't-gone' });

    function useWorkspaceHandlers(sourceIds: string[]) {
      const saved = useIntakeHandlers({ config: { ...baseConfig(), linear: { enabled: true, sourceIds } } });
      server.use(
        http.get(LINEAR_PROJECTS_URL, () =>
          HttpResponse.json({
            projects: [{ id: liveProject, name: 'Live roadmap', state: 'started', teams: [], workspaceId: 'ws-live' }],
          }),
        ),
        http.get(LINEAR_TEAMS_URL, () =>
          HttpResponse.json({
            teams: [{ id: 't-live', key: 'LIV', name: 'Live team', sourceId: liveTeam, workspaceId: 'ws-live' }],
          }),
        ),
      );
      return saved;
    }

    it('collapses them into one disconnected row instead of listing raw source IDs', async () => {
      useWorkspaceHandlers([liveProject, goneProject, goneTeam]);

      renderIntakeSection();

      const disconnected = await screen.findByRole('list', { name: 'Disconnected Linear workspaces' });
      expect(within(disconnected).getByText('Other Linear workspace')).toBeInTheDocument();
      expect(within(disconnected).getByText('Disconnected')).toBeInTheDocument();
      expect(within(disconnected).getByText(/2 projects and teams paused/)).toBeInTheDocument();
      expect(await screen.findByRole('button', { name: 'Remove Live roadmap' })).toBeInTheDocument();
      expect(screen.queryByText(goneProject)).not.toBeInTheDocument();
      expect(screen.queryByText(goneTeam)).not.toBeInTheDocument();
    });

    it('removes only that workspace’s sources from the saved config', async () => {
      const saved = useWorkspaceHandlers([liveProject, goneProject, goneTeam]);

      renderIntakeSection();
      await userEvent.click(await screen.findByRole('button', { name: 'Remove Other Linear workspace' }));

      await waitFor(() => expect(saved.at(-1)?.linear.sourceIds).toEqual([liveProject]));
    });

    it('labels a source missing from a connected workspace instead of showing its ID', async () => {
      useWorkspaceHandlers([liveProject, deletedProject]);

      renderIntakeSection();

      expect(await screen.findByRole('button', { name: 'Remove Unknown Linear project' })).toBeInTheDocument();
      expect(screen.queryByText(deletedProject)).not.toBeInTheDocument();
      expect(screen.queryByRole('list', { name: 'Disconnected Linear workspaces' })).not.toBeInTheDocument();
    });

    it('numbers missing sources so each Remove targets a distinct one', async () => {
      const otherDeleted = encode('linear-project:', { workspaceId: 'ws-live', projectId: 'p-deleted-2' });
      const saved = useWorkspaceHandlers([liveProject, deletedProject, otherDeleted]);

      renderIntakeSection();
      expect(await screen.findByRole('button', { name: 'Remove Unknown Linear project 1' })).toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: 'Remove Unknown Linear project 2' }));

      await waitFor(() => expect(saved.at(-1)?.linear.sourceIds).toEqual([liveProject, deletedProject]));
    });

    it('does not call saved sources unknown when the Linear lists fail to load', async () => {
      useWorkspaceHandlers([liveProject, liveTeam]);
      server.use(http.get(LINEAR_PROJECTS_URL, () => HttpResponse.json({ error: 'boom' }, { status: 500 })));

      renderIntakeSection();

      expect(await screen.findByText("Couldn't load Linear projects and teams.")).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Remove Linear project' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Remove All issues in Live team' })).toBeInTheDocument();
      expect(screen.queryByText(/Unknown Linear/)).not.toBeInTheDocument();
      expect(screen.queryByText(liveProject)).not.toBeInTheDocument();
    });

    it('labels a team missing from a connected workspace as an unknown team', async () => {
      const deletedTeam = encode('linear-team:', { workspaceId: 'ws-live', teamId: 't-deleted' });
      const saved = useWorkspaceHandlers([liveProject, deletedProject, deletedTeam]);

      renderIntakeSection();
      expect(await screen.findByRole('button', { name: 'Remove Unknown Linear project' })).toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: 'Remove Unknown Linear team' }));

      await waitFor(() => expect(saved.at(-1)?.linear.sourceIds).toEqual([liveProject, deletedProject]));
    });
  });

  describe('given Linear is connected', () => {
    it('shows the workspace with a link to connection management', async () => {
      useIntakeHandlers();

      renderIntakeSection();

      expect(await screen.findByText('Acme')).toBeInTheDocument();
      const linearSection = screen.getByRole('region', { name: 'Linear' });
      expect(within(linearSection).getByRole('link', { name: 'Manage connection' })).toHaveAttribute(
        'href',
        '/factories/fp-1/settings/connections',
      );
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
      expect(
        within(screen.getByRole('region', { name: 'Linear' })).getByRole('link', { name: 'Manage connection' }),
      ).toBeInTheDocument();
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
      expect(screen.getByRole('link', { name: 'Connect Linear' })).toHaveAttribute(
        'href',
        '/factories/fp-1/settings/connections?add=1',
      );
      expect(screen.queryByRole('checkbox', { name: 'Q3 Roadmap' })).not.toBeInTheDocument();
      expect(screen.queryByRole('switch', { name: 'Sync Linear issues' })).not.toBeInTheDocument();
    });
  });

  describe('given Linear is not configured on the server', () => {
    it('explains the source is unavailable without a connect button', async () => {
      useIntakeHandlers({ status: { enabled: false, connected: false, workspace: null, reason: 'missing_config' } });

      renderIntakeSection();

      expect(await screen.findByText('Linear is not configured on this server.')).toBeInTheDocument();
      expect(screen.queryByRole('link', { name: 'Connect Linear' })).not.toBeInTheDocument();
    });
  });
});
