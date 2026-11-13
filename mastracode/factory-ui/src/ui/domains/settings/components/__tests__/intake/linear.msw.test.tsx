import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { listedRepository } from '../../../../../../../e2e/ui/factory-projects';
import { server } from '../../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL } from '../../../../../../../e2e/ui/render';
import type { LinearStatus } from '../../../../factory/services/linear';
import { linearWorkspaceStatus } from '../fixtures/linearConnections';
import {
  BINDINGS_URL,
  LINEAR_PROJECTS_URL,
  LINEAR_STATUS_URL,
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

const authCalls: Array<{ integrationId: string }> = [];
vi.mock('@nangohq/frontend', () => {
  class Nango {
    auth(integrationId: string) {
      authCalls.push({ integrationId });
      return Promise.resolve({ connectionId: 'vendor-connection', providerConfigKey: integrationId });
    }
  }
  class AuthError extends Error {
    type = 'unknown';
  }
  return { default: Nango, AuthError };
});

const LINEAR_CONNECT_ROOT = `${TEST_BASE_URL}/web/integrations/platform/linear`;
const MIGRATE_URL = `${LINEAR_CONNECT_ROOT}/migrate`;

/** Linear's Mastra Connect sessions. Each connect activates a new connection right away. */
function linearConnectSessions() {
  const minted: Array<'connect' | 'reconnect'> = [];
  server.use(
    http.get(`${LINEAR_CONNECT_ROOT}/connections`, () =>
      HttpResponse.json({
        connections: [{ id: 'linear-new', integrationId: 'linear', status: 'active', accountLabel: 'Linear' }],
      }),
    ),
    http.post(`${LINEAR_CONNECT_ROOT}/connect-session`, () => {
      minted.push('connect');
      return HttpResponse.json(
        {
          connectionId: 'linear-new',
          integrationId: 'linear',
          connectUrl: 'https://example.com/consent',
          sessionToken: 'session-token',
          expiresAt: '2099-01-01T00:00:00.000Z',
        },
        { status: 201 },
      );
    }),
    http.post(`${LINEAR_CONNECT_ROOT}/connections/:id/reconnect-session`, () => {
      minted.push('reconnect');
      return HttpResponse.json({ error: 'imported connections cannot reconnect' }, { status: 409 });
    }),
  );
  return minted;
}

function orgAdmin(admin: boolean) {
  server.use(
    http.get(`${TEST_BASE_URL}/web/config/providers`, () => HttpResponse.json({ providers: [], orgKeyAdmin: admin })),
  );
}

describe('IntakeSection linear', () => {
  beforeEach(() => {
    authCalls.length = 0;
  });

  const sourceId = (workspaceId: string, projectId: string) =>
    `linear-project:${Buffer.from(JSON.stringify({ workspaceId, projectId })).toString('base64url')}`;
  const pausedProject = sourceId('mastra', 'docs-watch');
  const liveProject = sourceId('labs', 'roadmap');

  it.each([true, false])(
    'keeps paused sources named and removable when another workspace is connected: %s',
    async connected => {
      const saved = useIntakeHandlers({
        status: {
          ...linearWorkspaceStatus,
          connected,
          workspaces: linearWorkspaceStatus.workspaces.filter(workspace => connected || !workspace.connected),
        },
        config: { ...baseConfig(), linear: { enabled: true, sourceIds: [pausedProject, liveProject] } },
      });
      server.use(
        http.get(LINEAR_PROJECTS_URL, () =>
          HttpResponse.json({ projects: [{ id: liveProject, name: 'Labs roadmap', state: 'started', teams: [] }] }),
        ),
        http.get(LINEAR_TEAMS_URL, () => HttpResponse.json({ teams: [] })),
      );
      renderIntakeSection();
      const paused = await screen.findByRole('button', { name: 'Remove sources from Mastra' });
      expect(screen.getByRole('button', { name: 'Reconnect Mastra' })).toBeEnabled();
      expect(screen.getByText(/1 project or team paused/)).toBeInTheDocument();
      expect(screen.queryByText(/linear-project:/)).not.toBeInTheDocument();
      if (connected) expect(await screen.findByText('Labs roadmap')).toBeInTheDocument();
      if (connected) expect(screen.getByRole('button', { name: 'Connect another Linear workspace' })).toBeEnabled();
      else expect(screen.queryByRole('button', { name: /^Connect .*Linear/ })).not.toBeInTheDocument();
      await userEvent.click(paused);
      await waitFor(() => expect(saved.at(-1)?.linear.sourceIds).toEqual([liveProject]));
    },
  );

  it("explains when a paused workspace's reconnect connected a different workspace, and clears once it's back", async () => {
    let restored = false;
    const minted = linearConnectSessions();
    useIntakeHandlers({
      config: { ...baseConfig(), linear: { enabled: true, sourceIds: [pausedProject, liveProject] } },
    });
    server.use(
      http.get(LINEAR_STATUS_URL, () =>
        HttpResponse.json({
          ...linearWorkspaceStatus,
          workspaces: linearWorkspaceStatus.workspaces.map(workspace => ({
            ...workspace,
            connected: workspace.connected || restored,
          })),
        }),
      ),
      http.get(LINEAR_PROJECTS_URL, () =>
        HttpResponse.json({ projects: [{ id: liveProject, name: 'Labs roadmap', state: 'started', teams: [] }] }),
      ),
      http.get(LINEAR_TEAMS_URL, () => HttpResponse.json({ teams: [] })),
    );
    renderIntakeSection();

    const message = 'This workspace is still disconnected. Choose Mastra when authorizing in Linear.';
    await userEvent.click(await screen.findByRole('button', { name: 'Reconnect Mastra' }));
    await userEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Continue to Linear' }),
    );
    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reconnect Mastra' })).toBeEnabled();

    restored = true;
    await userEvent.click(screen.getByRole('button', { name: 'Reconnect Mastra' }));
    await userEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Continue to Linear' }),
    );
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Reconnect Mastra' })).not.toBeInTheDocument());
    expect(screen.queryByText(message)).not.toBeInTheDocument();
    // Imported connections can't be reauthorized in place, so both attempts were fresh connects.
    expect(minted).toEqual(['connect', 'connect']);
    expect(authCalls.map(call => call.integrationId)).toEqual(['linear', 'linear']);
  });

  it('shows healthy sources and a retry for a workspace outage without calling it disconnected', async () => {
    useIntakeHandlers({
      status: {
        ...linearWorkspaceStatus,
        workspaces: linearWorkspaceStatus.workspaces.map(workspace => ({ ...workspace, connected: true })),
      },
      config: { ...baseConfig(), linear: { enabled: true, sourceIds: [pausedProject, liveProject] } },
    });
    let recovered = false;
    server.use(
      http.get(LINEAR_PROJECTS_URL, () =>
        HttpResponse.json({
          projects: [
            { id: liveProject, name: 'Labs roadmap', state: 'started', teams: [] },
            ...(recovered ? [{ id: pausedProject, name: 'DocsWatch', state: 'started', teams: [] }] : []),
          ],
          workspaceErrors: recovered ? [] : [{ workspaceId: 'mastra', name: 'Mastra' }],
        }),
      ),
      http.get(LINEAR_TEAMS_URL, () => HttpResponse.json({ teams: [] })),
    );
    renderIntakeSection();
    expect(await screen.findByText("Couldn't load sources from Mastra.")).toBeInTheDocument();
    expect(screen.getByText('Labs roadmap')).toBeInTheDocument();
    expect(screen.queryByText('Disconnected')).not.toBeInTheDocument();
    recovered = true;
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('DocsWatch')).toBeInTheDocument();
    expect(screen.queryByText("Couldn't load sources from Mastra.")).not.toBeInTheDocument();
  });
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
      expect(within(projects).getAllByRole('button', { name: 'Add Shared initiative' })).toHaveLength(2);

      await userEvent.click(within(projects).getAllByRole('button', { name: 'Add Shared initiative' })[0]);
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
            bindings: [{ integrationId: 'linear', sourceId: 'lproj-1', factoryProjectId: 'fp-1' }],
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
      expect(
        within(within(drawer).getByRole('region', { name: 'Added' })).getByRole('combobox', {
          name: 'Repository for Q3 Roadmap',
        }),
      ).toHaveTextContent('mastra');
      expect(
        within(within(drawer).getByRole('group', { name: 'Linear repository mappings' })).queryByRole('combobox', {
          name: 'Repository for Q3 Roadmap',
        }),
      ).not.toBeInTheDocument();
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
            bindings: [{ integrationId: 'linear', sourceId: engTeam.sourceId, factoryProjectId: 'fp-1' }],
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
            bindings: [{ integrationId: 'linear', sourceId: 'lproj-1', factoryProjectId: 'fp-1' }],
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
            bindings: [{ integrationId: 'linear', sourceId: engTeam.sourceId, factoryProjectId: 'fp-1' }],
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
      expect(await screen.findByRole('button', { name: 'Add Design refresh' })).toBeInTheDocument();

      await userEvent.type(search, 'road');

      await waitFor(() => expect(screen.queryByRole('button', { name: 'Add Design refresh' })).not.toBeInTheDocument());
      expect(screen.getByRole('button', { name: 'Add Q3 Roadmap' })).toBeInTheDocument();
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

      await userEvent.click(await screen.findByRole('button', { name: 'Add Q3 Roadmap' }));

      await waitFor(() => expect(saved).toHaveLength(1));
      expect(saved[0].linear.sourceIds).toEqual(['lproj-1']);
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

      await userEvent.click(await screen.findByRole('button', { name: 'Add All issues in Engineering' }));

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

      expect(await screen.findByRole('button', { name: 'Add Q3 Roadmap' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Add All issues in Engineering' })).not.toBeInTheDocument();

      releaseTeams();

      const team = await screen.findByRole('button', { name: 'Add All issues in Engineering' });
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
      expect(screen.getByRole('button', { name: /Add Design refresh/ })).toBeEnabled();
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

  describe('given Linear workspaces are connected through Mastra Platform', () => {
    it('keeps the card free of connect prompts and offers another workspace under Add a source', async () => {
      useIntakeHandlers({ status: linearWorkspaceStatus });

      renderIntakeSection();

      const linearSection = await screen.findByRole('region', { name: 'Linear' });
      expect(await within(linearSection).findByText('Mastra Labs')).toBeInTheDocument();
      expect(within(linearSection).queryByRole('button', { name: /connect/i })).not.toBeInTheDocument();
      expect(
        within(screen.getByRole('region', { name: 'Add a source' })).getByRole('button', {
          name: 'Connect another Linear workspace',
        }),
      ).toBeEnabled();
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
        within(screen.getByRole('region', { name: 'Linear' })).getByRole('button', { name: 'Reconnect Linear' }),
      ).toBeEnabled();
      expect(screen.queryByRole('button', { name: 'Add Q3 Roadmap' })).not.toBeInTheDocument();
    });
  });

  describe('given Linear is not connected', () => {
    it('shows the connect prompt instead of the project picker', async () => {
      useIntakeHandlers({
        status: { enabled: true, connected: false, workspace: null, reason: 'not_connected' },
      });

      renderIntakeSection();

      expect(await screen.findByText('Connect a Linear workspace to sync its issues.')).toBeInTheDocument();
      expect(
        within(screen.getByRole('region', { name: 'Add a source' })).getByRole('button', { name: 'Connect Linear' }),
      ).toBeEnabled();
      expect(screen.queryByRole('button', { name: 'Add Q3 Roadmap' })).not.toBeInTheDocument();
      expect(screen.queryByRole('switch', { name: 'Sync Linear issues' })).not.toBeInTheDocument();
    });
  });

  describe('given a Platform server, where Linear connects through Mastra Connect', () => {
    const platformStatus = (overrides: Partial<LinearStatus> = {}): LinearStatus => ({
      enabled: true,
      connected: false,
      workspace: null,
      reason: 'not_connected',
      mode: 'platform',
      workspaces: [],
      migration: { required: false, pending: [], skipped: [] },
      requiresFreshConnect: [],
      ...overrides,
    });

    it('connects in a Mastra Connect popup and shows the workspace once it is active', async () => {
      let connected = false;
      const minted = linearConnectSessions();
      useIntakeHandlers({ status: platformStatus() });
      server.use(
        http.get(LINEAR_STATUS_URL, () =>
          HttpResponse.json(
            connected
              ? { ...linearWorkspaceStatus, migration: { required: false, pending: [], skipped: [] } }
              : platformStatus(),
          ),
        ),
        http.post(`${LINEAR_CONNECT_ROOT}/connect-session`, () => {
          connected = true;
          minted.push('connect');
          return HttpResponse.json(
            {
              connectionId: 'linear-new',
              integrationId: 'linear',
              connectUrl: 'https://example.com/consent',
              sessionToken: 'session-token',
              expiresAt: '2099-01-01T00:00:00.000Z',
            },
            { status: 201 },
          );
        }),
      );
      renderIntakeSection();

      await userEvent.click(
        within(await screen.findByRole('region', { name: 'Add a source' })).getByRole('button', {
          name: 'Connect Linear',
        }),
      );

      expect(await screen.findByRole('switch', { name: 'Sync Linear issues' })).toBeInTheDocument();
      expect(minted).toEqual(['connect']);
      expect(authCalls.map(call => call.integrationId)).toEqual(['linear']);
    });

    it('asks for a fresh connect when Linear revoked a moved connection', async () => {
      const minted = linearConnectSessions();
      useIntakeHandlers({
        status: platformStatus({
          requiresFreshConnect: [{ connectionId: 'conn-1', accountLabel: 'Acme', linearWorkspaceId: 'acme' }],
        }),
      });
      renderIntakeSection();

      expect(
        await screen.findByText('Linear access was revoked. Reconnect to keep syncing issues.'),
      ).toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: 'Reconnect Linear' }));

      // An imported connection can't be reauthorized in place, so Reconnect starts a fresh connect.
      await waitFor(() => expect(minted).toEqual(['connect']));
      expect(authCalls.map(call => call.integrationId)).toEqual(['linear']);
    });

    it("says when Linear isn't answering for a connection, so paused sources aren't a mystery", async () => {
      useIntakeHandlers({
        status: platformStatus({
          connected: true,
          reason: 'ready',
          workspace: { name: 'Acme', urlKey: 'acme' },
          workspaces: [{ id: 'acme', name: 'Acme', urlKey: 'acme', connected: true }],
          unidentified: [{ connectionId: 'conn-beta', error: 'Linear returned 503' }],
        }),
      });
      renderIntakeSection();

      expect(await screen.findByText("Linear isn't answering for some connections")).toBeInTheDocument();
      expect(screen.getByText(/Factory couldn't reach 1 Linear connection and keeps checking/)).toBeInTheDocument();
    });

    it('shows a move to Mastra Connect in progress without asking anyone to act', async () => {
      orgAdmin(true);
      useIntakeHandlers({
        status: platformStatus({
          reason: 'migration_required',
          migration: {
            required: true,
            pending: ['acme'],
            skipped: [],
          },
        }),
      });
      renderIntakeSection();

      expect(await screen.findByText('Moving Linear to Mastra Connect')).toBeInTheDocument();
      expect(screen.getByText(/Factory is moving 1 Linear workspace to Mastra Connect/)).toBeInTheDocument();
      expect(screen.getByText('Linear workspaces are moving to Mastra Connect.')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Retry now' })).not.toBeInTheDocument();
    });

    const stalled = platformStatus({
      reason: 'migration_required',
      migration: {
        required: true,
        pending: ['acme'],
        skipped: [{ linearWorkspaceId: 'beta', reason: 'disconnected' }],
        lastError: { message: 'The platform is unavailable.', at: '2026-11-13T12:00:00.000Z' },
      },
    });

    it('lets an organization admin retry a stalled move, warning that it is org-wide and one-way', async () => {
      orgAdmin(true);
      let moved = false;
      const migrateCalls: string[] = [];
      useIntakeHandlers({ status: stalled });
      server.use(
        http.get(LINEAR_STATUS_URL, () => HttpResponse.json(moved ? linearWorkspaceStatus : stalled)),
        http.post(MIGRATE_URL, () => {
          migrateCalls.push('migrate');
          moved = true;
          return HttpResponse.json({
            requested: ['acme'],
            connections: [],
            skipped: [],
            migration: { required: false, pending: [], skipped: [] },
          });
        }),
      );
      renderIntakeSection();

      expect(await screen.findByText(/The platform is unavailable\./)).toBeInTheDocument();
      expect(
        within(screen.getByRole('list', { name: 'Linear workspaces not moved' })).getByText('beta: disconnected'),
      ).toBeInTheDocument();
      expect(screen.getByText(/covers every Factory in this organization and can't be undone/)).toBeInTheDocument();

      await userEvent.click(await screen.findByRole('button', { name: 'Retry now' }));

      await waitFor(() => expect(screen.queryByText(/The platform is unavailable/)).not.toBeInTheDocument());
      expect(migrateCalls).toEqual(['migrate']);
      expect(await screen.findByRole('switch', { name: 'Sync Linear issues' })).toBeInTheDocument();
    });

    it('shows a stalled move to members without a retry they are not allowed to run', async () => {
      orgAdmin(false);
      useIntakeHandlers({ status: stalled });
      renderIntakeSection();

      expect(await screen.findByText(/The platform is unavailable\./)).toBeInTheDocument();
      expect(screen.getByText(/Factory keeps retrying on its own/)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Retry now' })).not.toBeInTheDocument();
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
});
