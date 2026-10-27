import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '../../../../../../../e2e/ui/msw-server';
import type { JiraStatus } from '../../../../factory/services/jira';
import {
  JIRA_STATUS_URL,
  JIRA_PROJECTS_URL,
  FACTORY_A,
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

  it('routes a selected Jira project to a Factory through the generic bindings', async () => {
    seedFactories();
    const { savedBindings } = useJiraHandlers({
      config: { ...baseConfig(), jira: { enabled: true, sourceIds: ['10001'] } },
    });

    renderIntakeSection();

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
    expect(
      within(screen.getByRole('region', { name: 'Jira' })).getByRole('link', { name: 'Manage connection' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Jira projects' })).not.toBeInTheDocument();
  });
});
