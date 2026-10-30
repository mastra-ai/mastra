import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '../../../../../../../e2e/ui/msw-server';
import type { IntakeConfig } from '../../../../factory/services/intake';
import type { JiraStatus } from '../../../../factory/services/jira';
import {
  CONFIG_URL,
  JIRA_STATUS_URL,
  JIRA_PROJECTS_URL,
  FACTORY_A,
  FACTORY_B,
  jiraProjects,
  baseConfig,
  useIntakeHandlers,
  useJiraHandlers,
  seedFactories,
  renderIntakeSection,
  openSourcePicker,
} from './fixtures';

describe('IntakeSection jira', () => {
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
    expect(screen.queryByRole('switch', { name: 'Sync Jira issues' })).not.toBeInTheDocument();
  });

  it('enables the toggle and persists switching Jira on', async () => {
    const { saved } = useJiraHandlers();

    renderIntakeSection();

    const toggle = await screen.findByRole('switch', { name: 'Sync Jira issues' });
    expect(toggle).toBeEnabled();
    expect(toggle).not.toBeChecked();

    await userEvent.click(toggle);

    await waitFor(() => expect(saved).toHaveLength(1));
    expect(saved[0].jira.enabled).toBe(true);
    expect(saved[0].github.enabled).toBe(true);
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
    await openSourcePicker('Jira projects');
    expect(await screen.findByRole('group', { name: 'Jira projects' })).toBeInTheDocument();
  });

  it('shows the site and persists an explicit project selection', async () => {
    const { saved } = useJiraHandlers({
      config: { ...baseConfig(), jira: { enabled: true, sourceIds: null } },
    });

    renderIntakeSection();

    const jiraSection = await screen.findByRole('region', { name: 'Jira' });
    expect(await within(jiraSection).findByText('acme.atlassian.net, beta.atlassian.net')).toBeInTheDocument();
    await openSourcePicker('Jira projects');

    const projects = await screen.findByRole('group', { name: 'Jira projects' });
    await userEvent.click(within(projects).getByRole('checkbox', { name: 'ENG · Engineering' }));

    await waitFor(() => expect(saved).toHaveLength(1));
    expect(saved[0].jira.sourceIds).toEqual(['10001']);
  });

  it('returns focus to Add after a selected project finishes being removed', async () => {
    useJiraHandlers({
      config: { ...baseConfig(), jira: { enabled: true, sourceIds: ['10001'] } },
    });
    const saved: IntakeConfig[] = [];
    let releaseSave!: () => void;
    const pendingSave = new Promise<void>(resolve => {
      releaseSave = resolve;
    });
    server.use(
      http.put<Record<string, never>, IntakeConfig>(CONFIG_URL, async ({ request }) => {
        const config = await request.json();
        saved.push(config);
        await pendingSave;
        return HttpResponse.json({ config });
      }),
    );
    renderIntakeSection();
    const remove = await screen.findByRole('button', { name: 'Remove ENG · Engineering' });
    const add = screen.getByRole('button', { name: 'Add project to Jira projects' });
    await userEvent.click(remove);
    try {
      await waitFor(() => expect(saved).toHaveLength(1));
      expect(add).toBeDisabled();
      expect(remove).toBeInTheDocument();
      expect(saved[0].jira.sourceIds).toBeNull();
      expect(saved[0].github).toEqual(baseConfig().github);
    } finally {
      releaseSave();
    }
    await waitFor(() => expect(add).toHaveFocus());
    expect(screen.queryByRole('button', { name: 'Remove ENG · Engineering' })).not.toBeInTheDocument();
  });

  it('waits for Jira projects before listing saved sources, so rows never show raw project IDs', async () => {
    seedFactories();
    useJiraHandlers({ config: { ...baseConfig(), jira: { enabled: true, sourceIds: ['10001'] } } });
    let releaseProjects!: () => void;
    const projectsPending = new Promise<void>(resolve => (releaseProjects = resolve));
    server.use(
      http.get(JIRA_PROJECTS_URL, async () => {
        await projectsPending;
        return HttpResponse.json({ projects: jiraProjects });
      }),
    );

    renderIntakeSection();

    const section = await screen.findByRole('region', { name: 'Jira' });
    expect(await within(section).findByText('Loading Jira projects…')).toBeInTheDocument();
    expect(within(section).queryByText('10001')).not.toBeInTheDocument();
    expect(within(section).queryByLabelText('Factory to add for 10001')).not.toBeInTheDocument();

    releaseProjects();

    expect(await within(section).findByLabelText('Factory to add for ENG · Engineering')).toBeInTheDocument();
  });

  it('routes a selected Jira project to a factory, taking all its issues', async () => {
    seedFactories();
    const { savedBindings } = useJiraHandlers({
      config: { ...baseConfig(), jira: { enabled: true, sourceIds: ['10001'] } },
    });

    renderIntakeSection();

    expect(await screen.findByText(/Not routed — this project's issues won't be picked up\./)).toBeInTheDocument();

    await userEvent.click(await screen.findByLabelText('Factory to add for ENG · Engineering'));
    await userEvent.click(await screen.findByRole('option', { name: 'Acme Web' }));
    expect(screen.getByText('Leave labels empty to take all issues.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Add' }));

    await waitFor(() => expect(savedBindings).toHaveLength(1));
    expect(savedBindings[0]).toEqual({
      integrationId: 'jira',
      sourceId: '10001',
      factoryProjectId: FACTORY_A,
      board: null,
      labels: null,
    });
    expect(await screen.findByText('Jira routing updated')).toBeInTheDocument();
    expect(await screen.findByLabelText('Issues from ENG · Engineering for Acme Web')).toHaveTextContent('All issues');
  });

  it('routes the labelled issues of a project another factory already takes to a second factory', async () => {
    seedFactories();
    const { savedBindings } = useJiraHandlers({
      config: { ...baseConfig(), jira: { enabled: true, sourceIds: ['10001'] } },
      bindings: [
        {
          integrationId: 'jira',
          sourceId: '10001',
          factoryProjectId: FACTORY_A,
          board: 'work',
          labels: null,
          createdAt: '2026-10-01T00:00:00.000Z',
        },
      ],
    });

    renderIntakeSection();

    await userEvent.click(await screen.findByLabelText('Factory to add for ENG · Engineering'));
    await userEvent.click(await screen.findByRole('option', { name: 'Acme API' }));
    expect(
      screen.getByText('Another factory takes all issues, so name the labels this factory should take.'),
    ).toBeInTheDocument();
    // Without labels the new factory would collide with the all-issues binding.
    expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled();
    await userEvent.type(screen.getByLabelText('Labels for the new ENG · Engineering factory'), 'payments, billing');
    await userEvent.click(screen.getByRole('button', { name: 'Add' }));

    await waitFor(() => expect(savedBindings).toHaveLength(1));
    expect(savedBindings[0]).toMatchObject({ factoryProjectId: FACTORY_B, labels: ['payments', 'billing'] });
    expect(await screen.findByLabelText('Issues from ENG · Engineering for Acme API')).toHaveTextContent(
      'Only issues labelled…',
    );
    expect(screen.getByText('payments')).toBeInTheDocument();
    expect(
      screen.getByText("Choose a board — this factory won't pick up issues until one is set."),
    ).toBeInTheDocument();
    // The new factory takes nothing until it has a board, so the all-issues factory keeps its labels for now.
    expect(screen.queryByText(/Takes all issues except/)).toBeNull();
    expect(
      screen.getByText(
        'Label filters take precedence over "All issues". An issue matching two filters goes to the factory added first.',
      ),
    ).toBeInTheDocument();
  });

  it.each([
    { board: 'work', excepted: true },
    { board: null, excepted: false },
  ])(
    'shows the labels the all-issues factory gives up only once the label factory has a board ($board)',
    async ({ board, excepted }) => {
      seedFactories();
      useJiraHandlers({
        config: { ...baseConfig(), jira: { enabled: true, sourceIds: ['10001'] } },
        bindings: [
          {
            integrationId: 'jira',
            sourceId: '10001',
            factoryProjectId: FACTORY_A,
            board: 'work',
            labels: null,
            createdAt: '2026-10-01T00:00:00.000Z',
          },
          {
            integrationId: 'jira',
            sourceId: '10001',
            factoryProjectId: FACTORY_B,
            board,
            labels: ['payments', 'billing'],
            createdAt: '2026-10-02T00:00:00.000Z',
          },
        ],
      });

      renderIntakeSection();

      expect(await screen.findByLabelText('Issues from ENG · Engineering for Acme API')).toBeInTheDocument();
      const note = screen.queryByText('Takes all issues except those labelled payments, billing.');
      if (excepted) expect(note).toBeInTheDocument();
      else expect(note).toBeNull();
    },
  );

  it('explains which factory already takes a label when the save is refused', async () => {
    seedFactories();
    const { savedBindings } = useJiraHandlers({
      config: { ...baseConfig(), jira: { enabled: true, sourceIds: ['10001'] } },
      bindings: [
        {
          integrationId: 'jira',
          sourceId: '10001',
          factoryProjectId: FACTORY_A,
          board: 'work',
          labels: ['payments'],
          createdAt: '2026-10-01T00:00:00.000Z',
        },
      ],
      conflict: {
        message: 'Already routed to another factory: payments.',
        conflicts: [{ factoryProjectId: FACTORY_A, labels: ['payments'] }],
      },
    });

    renderIntakeSection();

    await userEvent.click(await screen.findByLabelText('Factory to add for ENG · Engineering'));
    await userEvent.click(await screen.findByRole('option', { name: 'Acme API' }));
    await userEvent.type(screen.getByLabelText('Labels for the new ENG · Engineering factory'), 'payments');
    await userEvent.click(screen.getByRole('button', { name: 'Add' }));

    await waitFor(() => expect(savedBindings).toHaveLength(1));
    expect(await screen.findByRole('alert')).toHaveTextContent('"payments" already routed to Acme Web');
  });

  it("stops routing a project to one factory and leaves the other factory's routing", async () => {
    seedFactories();
    const { deletedBindings, savedBindings } = useJiraHandlers({
      config: { ...baseConfig(), jira: { enabled: true, sourceIds: ['10001'] } },
      bindings: [
        {
          integrationId: 'jira',
          sourceId: '10001',
          factoryProjectId: FACTORY_A,
          board: 'work',
          labels: null,
          createdAt: '2026-10-01T00:00:00.000Z',
        },
        {
          integrationId: 'jira',
          sourceId: '10001',
          factoryProjectId: FACTORY_B,
          board: 'work',
          labels: ['payments'],
          createdAt: '2026-10-02T00:00:00.000Z',
        },
      ],
    });

    renderIntakeSection();

    await userEvent.click(await screen.findByRole('button', { name: 'Stop routing ENG · Engineering to Acme API' }));

    await waitFor(() => expect(deletedBindings).toHaveLength(1));
    expect(deletedBindings[0]).toEqual({ integrationId: 'jira', sourceId: '10001', factoryProjectId: FACTORY_B });
    expect(savedBindings).toEqual([]);
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Stop routing ENG · Engineering to Acme API' })).toBeNull(),
    );
    expect(screen.getByRole('button', { name: 'Stop routing ENG · Engineering to Acme Web' })).toBeInTheDocument();
    // The project itself stays selected.
    expect(screen.getByRole('button', { name: 'Remove ENG · Engineering' })).toBeInTheDocument();
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
    expect(
      within(screen.getByRole('region', { name: 'Jira' })).getByRole('link', { name: 'Manage connection' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Jira projects' })).not.toBeInTheDocument();
  });
});
