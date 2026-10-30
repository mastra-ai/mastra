import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '../../../../../../../e2e/ui/msw-server';
import type { IntakeConfig, IntakeSourceBinding } from '../../../../factory/services/intake';
import type { JiraStatus } from '../../../../factory/services/jira';
import {
  BINDINGS_URL,
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

  const jiraBinding = (overrides: Partial<IntakeSourceBinding>): IntakeSourceBinding => ({
    integrationId: 'jira',
    sourceId: '10001',
    factoryProjectId: FACTORY_A,
    board: 'work',
    labels: null,
    createdAt: '2026-10-01T00:00:00.000Z',
    ...overrides,
  });

  const pickBoard = async (name: string) => {
    const trigger = screen.getByLabelText(`Board for ${name}`);
    await waitFor(() => expect(trigger).toBeEnabled());
    await userEvent.click(trigger);
    await userEvent.click(await screen.findByRole('option', { name: 'Work' }));
  };

  it('routes a selected Jira project to a factory, taking all its issues, once a board is chosen', async () => {
    seedFactories();
    const { savedBindings } = useJiraHandlers({
      config: { ...baseConfig(), jira: { enabled: true, sourceIds: ['10001'] } },
    });

    renderIntakeSection();

    expect(await screen.findByText(/Not routed — this project's issues won't be picked up\./)).toBeInTheDocument();

    await userEvent.click(await screen.findByLabelText('Factory to add for ENG · Engineering'));
    await userEvent.click(await screen.findByRole('option', { name: 'Acme Web' }));
    expect(screen.getByText('Leave labels empty to take all issues.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled();
    await pickBoard('ENG · Engineering in Acme Web');
    await userEvent.click(screen.getByRole('button', { name: 'Add' }));

    await waitFor(() => expect(savedBindings).toHaveLength(1));
    expect(savedBindings[0]).toEqual({
      integrationId: 'jira',
      sourceId: '10001',
      factoryProjectId: FACTORY_A,
      board: 'work',
      labels: null,
    });
    expect(await screen.findByLabelText('Issues from ENG · Engineering for Acme Web')).toHaveTextContent('All issues');
    expect(screen.queryByText(/Choose a board/)).toBeNull();
  });

  it('routes the labelled issues of a project another factory already takes to a second factory', async () => {
    seedFactories();
    const { savedBindings } = useJiraHandlers({
      config: { ...baseConfig(), jira: { enabled: true, sourceIds: ['10001'] } },
      bindings: [jiraBinding({})],
    });

    renderIntakeSection();

    await userEvent.click(await screen.findByLabelText('Factory to add for ENG · Engineering'));
    await userEvent.click(await screen.findByRole('option', { name: 'Acme API' }));
    expect(
      screen.getByText('Another factory takes all issues, so name the labels this factory should take.'),
    ).toBeInTheDocument();
    await pickBoard('ENG · Engineering in Acme API');
    expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled();
    await userEvent.type(screen.getByLabelText('Labels for Acme API'), 'payments, billing');
    await userEvent.click(screen.getByRole('button', { name: 'Add' }));

    await waitFor(() => expect(savedBindings).toHaveLength(1));
    expect(savedBindings[0]).toMatchObject({
      factoryProjectId: FACTORY_B,
      board: 'work',
      labels: ['payments', 'billing'],
    });
    expect(await screen.findByLabelText('Issues from ENG · Engineering for Acme API')).toHaveTextContent(
      'Only issues labelled…',
    );
    expect(screen.getByText('payments')).toBeInTheDocument();
    expect(screen.getByLabelText('Issues from ENG · Engineering for Acme Web')).toHaveTextContent('All other issues');
    expect(
      screen.getByText('Labelled factories take matching issues first, in the order they were added.'),
    ).toBeInTheDocument();
  });

  it.each([
    { board: 'work', allIssues: 'All other issues', precedenceExplained: true },
    { board: null, allIssues: 'All issues', precedenceExplained: false },
  ])(
    'calls the all-issues filter "$allIssues" and explains label precedence only once the label factory board is set ($board)',
    async ({ board, allIssues, precedenceExplained }) => {
      seedFactories();
      useJiraHandlers({
        config: { ...baseConfig(), jira: { enabled: true, sourceIds: ['10001'] } },
        bindings: [
          jiraBinding({}),
          jiraBinding({
            factoryProjectId: FACTORY_B,
            board,
            labels: ['payments', 'billing'],
            createdAt: '2026-10-02T00:00:00.000Z',
          }),
        ],
      });

      renderIntakeSection();

      expect(await screen.findByLabelText('Issues from ENG · Engineering for Acme Web')).toHaveTextContent(allIssues);
      expect(
        screen.queryByText('Labelled factories take matching issues first, in the order they were added.') !== null,
      ).toBe(precedenceExplained);
    },
  );

  it('keeps "Only issues labelled…" honest until a valid first label saves', async () => {
    seedFactories();
    const { savedBindings } = useJiraHandlers({
      config: { ...baseConfig(), jira: { enabled: true, sourceIds: ['10001'] } },
      bindings: [jiraBinding({})],
    });

    renderIntakeSection();

    await userEvent.click(await screen.findByLabelText('Issues from ENG · Engineering for Acme Web'));
    await userEvent.click(await screen.findByRole('option', { name: 'Only issues labelled…' }));
    expect(screen.getByText('Still takes all issues until you add a label.')).toBeInTheDocument();

    const input = screen.getByLabelText('Add label for Acme Web');
    await userEvent.type(input, 'needs triage{Enter}');
    expect(screen.getByRole('alert')).toHaveTextContent('Jira labels can\'t contain spaces: "needs triage".');
    expect(savedBindings).toEqual([]);

    await userEvent.clear(input);
    expect(screen.queryByRole('alert')).toBeNull();
    await userEvent.type(input, 'bug{Enter}');

    await waitFor(() => expect(savedBindings).toHaveLength(1));
    expect(savedBindings[0]).toMatchObject({ factoryProjectId: FACTORY_A, labels: ['bug'] });
    expect(input).toHaveFocus();
    await waitFor(() => expect(screen.queryByText('Still takes all issues until you add a label.')).toBeNull());
  });

  it('keeps the commas typed while a label save is in flight, so every label saves next', async () => {
    seedFactories();
    const { savedBindings } = useJiraHandlers({
      config: { ...baseConfig(), jira: { enabled: true, sourceIds: ['10001'] } },
      bindings: [jiraBinding({ labels: ['payments'] })],
    });
    let answerFirstSave = () => {};
    const firstSaveAnswered = new Promise<void>(resolve => {
      answerFirstSave = resolve;
    });
    server.use(http.put(BINDINGS_URL, () => firstSaveAnswered, { once: true }));

    renderIntakeSection();

    const input = await screen.findByLabelText('Add label for Acme Web');
    await userEvent.type(input, 'billing{Enter}');
    await waitFor(() => expect(screen.getByLabelText('Remove label payments')).toBeDisabled());
    await userEvent.type(input, 'refunds,ops');
    expect(input).toHaveValue('refunds,ops');

    answerFirstSave();
    expect(await screen.findByText('billing')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText('Remove label payments')).toBeEnabled());
    await userEvent.type(input, '{Enter}');

    await waitFor(() => expect(savedBindings).toHaveLength(2));
    expect(savedBindings[1]).toMatchObject({ labels: ['payments', 'billing', 'refunds', 'ops'] });
  });

  it('does not add a label when Enter confirms an input-method composition', async () => {
    seedFactories();
    const { savedBindings } = useJiraHandlers({
      config: { ...baseConfig(), jira: { enabled: true, sourceIds: ['10001'] } },
      bindings: [jiraBinding({ labels: ['payments'] })],
    });

    renderIntakeSection();

    const input = await screen.findByLabelText('Add label for Acme Web');
    await userEvent.type(input, 'ばぐ');
    fireEvent.keyDown(input, { key: 'Enter', isComposing: true });

    expect(input).toHaveValue('ばぐ');
    expect(savedBindings).toEqual([]);
  });

  it('explains which factory already takes a label when the save is refused, until the input changes', async () => {
    seedFactories();
    const { savedBindings } = useJiraHandlers({
      config: { ...baseConfig(), jira: { enabled: true, sourceIds: ['10001'] } },
      bindings: [jiraBinding({ labels: ['payments'] })],
      conflict: {
        message: 'Already routed to another factory: payments.',
        conflicts: [{ factoryProjectId: FACTORY_A, labels: ['payments'] }],
      },
    });

    renderIntakeSection();

    await userEvent.click(await screen.findByLabelText('Factory to add for ENG · Engineering'));
    await userEvent.click(await screen.findByRole('option', { name: 'Acme API' }));
    await pickBoard('ENG · Engineering in Acme API');
    const labels = screen.getByLabelText('Labels for Acme API');
    await userEvent.type(labels, 'payments');
    await userEvent.click(screen.getByRole('button', { name: 'Add' }));

    await waitFor(() => expect(savedBindings).toHaveLength(1));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      '"payments" already goes to Acme Web. Remove it there or pick another label.',
    );
    await userEvent.type(labels, ', refunds');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it("removes one factory from a project and leaves the other factory's routing", async () => {
    seedFactories();
    const { deletedBindings, savedBindings } = useJiraHandlers({
      config: { ...baseConfig(), jira: { enabled: true, sourceIds: ['10001'] } },
      bindings: [
        jiraBinding({}),
        jiraBinding({ factoryProjectId: FACTORY_B, labels: ['payments'], createdAt: '2026-10-02T00:00:00.000Z' }),
      ],
    });

    renderIntakeSection();

    await userEvent.click(await screen.findByRole('button', { name: 'Remove Acme API from ENG · Engineering' }));

    await waitFor(() => expect(deletedBindings).toHaveLength(1));
    expect(deletedBindings[0]).toEqual({ integrationId: 'jira', sourceId: '10001', factoryProjectId: FACTORY_B });
    expect(savedBindings).toEqual([]);
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Remove Acme API from ENG · Engineering' })).toBeNull(),
    );
    expect(screen.getByRole('button', { name: 'Remove Acme Web from ENG · Engineering' })).toBeInTheDocument();
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
