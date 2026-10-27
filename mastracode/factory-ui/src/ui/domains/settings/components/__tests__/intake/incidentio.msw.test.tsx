import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '../../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL } from '../../../../../../../e2e/ui/render';
import {
  INTAKE_SOURCES_URL,
  FACTORY_A,
  baseConfig,
  useIntakeHandlers,
  useIncidentioHandlers,
  seedFactories,
  renderIntakeSection,
} from './fixtures';

describe('IntakeSection incidentio', () => {
  it('routes only follow-up sources to a Factory board', async () => {
    seedFactories();
    const { savedBindings } = useIncidentioHandlers();
    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/projects/:id/boards`, () =>
        HttpResponse.json({ boards: [{ id: 'work', title: 'Work' }] }),
      ),
    );

    renderIntakeSection();

    const section = await screen.findByRole('region', { name: 'incident.io' });
    expect(
      await within(section).findByRole('button', { name: 'Remove Incident follow-ups (acme)' }),
    ).toBeInTheDocument();
    expect(within(section).queryByText('Incidents (acme)')).not.toBeInTheDocument();

    await userEvent.click(await screen.findByLabelText('Factory for Incident follow-ups (acme)'));
    await userEvent.click(await screen.findByRole('option', { name: 'Acme Web' }));

    await waitFor(() => expect(savedBindings).toHaveLength(1));
    expect(savedBindings[0]).toEqual({
      integrationId: 'incidentio',
      sourceId: 'incidentio-source:follow-ups',
      factoryProjectId: FACTORY_A,
      board: null,
    });

    await userEvent.click(await screen.findByLabelText('Board for Incident follow-ups (acme)'));
    await userEvent.click(await screen.findByRole('option', { name: 'Work' }));

    await waitFor(() => expect(savedBindings).toHaveLength(2));
    expect(savedBindings[1]).toEqual({
      integrationId: 'incidentio',
      sourceId: 'incidentio-source:follow-ups',
      factoryProjectId: FACTORY_A,
      board: 'work',
    });
  });

  it('keeps the section usable for source selection and routing', async () => {
    seedFactories();
    useIntakeHandlers({
      config: { ...baseConfig(), incidentio: { enabled: true, sourceIds: ['incidentio-source:follow-ups'] } },
    });
    server.use(
      http.get(`${TEST_BASE_URL}/web/incidentio/status`, () =>
        HttpResponse.json({ enabled: true, configured: true, mode: 'api-key', reason: 'ready' }),
      ),
      http.get(INTAKE_SOURCES_URL, () =>
        HttpResponse.json({
          sources: [
            {
              integrationId: 'incidentio',
              id: 'incidentio-source:follow-ups',
              name: 'Incident follow-ups (acme)',
              type: 'follow-up',
            },
          ],
          failures: [],
        }),
      ),
    );

    renderIntakeSection();

    const section = await screen.findByRole('region', { name: 'incident.io' });
    expect(await within(section).findByText('incident.io API key configured on this server')).toBeInTheDocument();
    expect(within(section).queryByRole('button', { name: 'Connect incident.io' })).not.toBeInTheDocument();
    const toggle = within(section).getByRole('switch', { name: 'Sync incident.io follow-ups' });
    expect(toggle).toBeChecked();
    expect(toggle).toBeEnabled();
    expect(await within(section).findByRole('button', { name: 'Remove Incident follow-ups (acme)' })).toBeEnabled();
    expect(await screen.findByLabelText('Factory for Incident follow-ups (acme)')).toBeInTheDocument();
  });

  it('stays usable when the Platform connections request fails', async () => {
    seedFactories();
    useIntakeHandlers({
      config: { ...baseConfig(), incidentio: { enabled: true, sourceIds: ['incidentio-source:follow-ups'] } },
    });
    server.use(
      http.get(`${TEST_BASE_URL}/web/integrations/platform/incident-io/connections`, () =>
        HttpResponse.json({ error: 'boom' }, { status: 500 }),
      ),
      http.get(`${TEST_BASE_URL}/web/incidentio/status`, () =>
        HttpResponse.json({ enabled: true, configured: true, mode: 'api-key', reason: 'ready' }),
      ),
      http.get(INTAKE_SOURCES_URL, () =>
        HttpResponse.json({
          sources: [
            {
              integrationId: 'incidentio',
              id: 'incidentio-source:follow-ups',
              name: 'Incident follow-ups (acme)',
              type: 'follow-up',
            },
          ],
          failures: [],
        }),
      ),
    );

    renderIntakeSection();

    const section = await screen.findByRole('region', { name: 'incident.io' });
    expect(await within(section).findByText('incident.io API key configured on this server')).toBeInTheDocument();
    expect(within(section).queryByText("Couldn't load incident.io connections.")).not.toBeInTheDocument();
    const toggle = within(section).getByRole('switch', { name: 'Sync incident.io follow-ups' });
    expect(toggle).toBeChecked();
    expect(toggle).toBeEnabled();
    expect(await within(section).findByRole('button', { name: 'Remove Incident follow-ups (acme)' })).toBeEnabled();
  });

  it('keeps intake gated while the API key still needs an organization', async () => {
    seedFactories();
    useIntakeHandlers({
      config: { ...baseConfig(), incidentio: { enabled: true, sourceIds: ['incidentio-source:follow-ups'] } },
    });
    let sourceRequests = 0;
    server.use(
      http.get(`${TEST_BASE_URL}/web/incidentio/status`, () =>
        HttpResponse.json({
          enabled: true,
          configured: true,
          mode: 'api-key',
          organizationRequired: true,
          reason: 'organization_required',
        }),
      ),
      http.get(INTAKE_SOURCES_URL, () => {
        sourceRequests += 1;
        return HttpResponse.json({ sources: [], failures: [] });
      }),
    );

    renderIntakeSection();

    await waitFor(() => expect(screen.queryByRole('region', { name: 'incident.io' })).not.toBeInTheDocument());
    expect(screen.queryByRole('region', { name: 'incident.io' })).not.toBeInTheDocument();
    expect(sourceRequests).toBe(0);
  });
});
