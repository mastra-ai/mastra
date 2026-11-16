import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { builtinBoardCatalog } from '../../../../../../../e2e/ui/board-catalog';
import { server } from '../../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL } from '../../../../../../../e2e/ui/render';
import type { IntakeSourceBinding } from '../../../../factory/services/intake';
import {
  openSourcePicker,
  BINDINGS_URL,
  FACTORY_A,
  FACTORY_B,
  baseConfig,
  renderIntakeSection,
  seedFactories,
  useIntakeHandlers,
} from './fixtures';

const STATUS_URL = `${TEST_BASE_URL}/web/mastra-alerts/status`;
const CONNECT_URL = `${TEST_BASE_URL}/web/mastra-alerts/connect`;

function useAlertsStatus(initiallyConnected: boolean) {
  let connected = initiallyConnected;
  let connects = 0;
  server.use(
    http.get(STATUS_URL, () => HttpResponse.json({ enabled: true, configured: true, reason: 'ready', connected })),
    http.post(CONNECT_URL, () => {
      connects += 1;
      connected = true;
      return HttpResponse.json({ connected: true });
    }),
  );
  return { connects: () => connects };
}

describe('IntakeSection Mastra Alerts', () => {
  describe('given the deployment has no Platform credentials', () => {
    it('does not offer Mastra Alerts', async () => {
      seedFactories();
      useIntakeHandlers();
      server.use(http.get(STATUS_URL, () => new HttpResponse(null, { status: 404 })));

      renderIntakeSection();

      expect(await screen.findByText('GitHub')).toBeInTheDocument();
      expect(screen.queryByText('Mastra Alerts')).not.toBeInTheDocument();
    });
  });

  describe('given the organization has not connected alerts', () => {
    it('connects, then brings organization alerts in once the source is selected', async () => {
      seedFactories();
      // The server returns a key for every registered integration.
      const saved = useIntakeHandlers({
        config: { ...baseConfig(), 'mastra-alerts': { enabled: false, sourceIds: null } },
      });
      const alerts = useAlertsStatus(false);

      renderIntakeSection();

      expect(
        await screen.findByText('Connect to turn alerts from this organization into cards the Factory diagnoses.'),
      ).toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: 'Connect' }));

      await waitFor(() => expect(alerts.connects()).toBe(1));
      const section = await screen.findByRole('region', { name: 'Mastra Alerts' });
      expect(within(section).queryByRole('switch')).not.toBeInTheDocument();
      await openSourcePicker('Alert sources');
      const sources = await screen.findByRole('group', { name: 'Alert sources' });
      await userEvent.click(within(sources).getByRole('button', { name: 'Add Organization alerts' }));

      await waitFor(() => expect(saved).toContainEqual({ 'mastra-alerts': { enabled: true, sourceIds: ['alerts'] } }));
    });
  });

  describe('given organization alerts are selected', () => {
    function useAlertBindings(initial: IntakeSourceBinding[] = []) {
      let bindings = initial;
      const saved: unknown[] = [];
      server.use(
        http.get(`${TEST_BASE_URL}/web/factory/projects/:id/boards`, () => HttpResponse.json(builtinBoardCatalog)),
        http.get(BINDINGS_URL, () => HttpResponse.json({ bindings })),
        http.put(BINDINGS_URL, async ({ request }) => {
          const body = (await request.json()) as IntakeSourceBinding;
          saved.push(body);
          bindings = [
            ...bindings.filter(binding => binding.factoryProjectId !== body.factoryProjectId),
            { ...body, labels: body.labels ?? null },
          ];
          return HttpResponse.json({ bindings });
        }),
      );
      return saved;
    }
    const binding = (factoryProjectId: string, labels: string[] | null): IntakeSourceBinding => ({
      integrationId: 'mastra-alerts',
      sourceId: 'alerts',
      factoryProjectId,
      labels,
    });

    it('routes all organization alerts to a Factory', async () => {
      seedFactories();
      useIntakeHandlers({ config: { ...baseConfig(), 'mastra-alerts': { enabled: true, sourceIds: ['alerts'] } } });
      useAlertsStatus(true);
      const saved = useAlertBindings();

      renderIntakeSection();

      const section = await screen.findByRole('region', { name: 'Mastra Alerts' });
      expect(within(section).getByText('This organization')).toBeInTheDocument();
      expect(
        await within(section).findByText("Not routed. This source's alerts won't be picked up."),
      ).toBeInTheDocument();
      await userEvent.click(await within(section).findByLabelText('Factory to add for Organization alerts'));
      await userEvent.click(await screen.findByRole('option', { name: 'Acme Web' }));
      expect(screen.getByText('Leave labels empty to take all alerts.')).toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: 'Add' }));

      await waitFor(() => expect(saved).toHaveLength(1));
      expect(saved[0]).toMatchObject({
        integrationId: 'mastra-alerts',
        sourceId: 'alerts',
        factoryProjectId: FACTORY_A,
        labels: null,
      });
      expect(await screen.findByLabelText('Alerts from Organization alerts for Acme Web')).toHaveTextContent(
        'All alerts',
      );
    });

    it("sends one Platform project's alerts to a second Factory by label", async () => {
      seedFactories();
      useIntakeHandlers({ config: { ...baseConfig(), 'mastra-alerts': { enabled: true, sourceIds: ['alerts'] } } });
      useAlertsStatus(true);
      const saved = useAlertBindings([binding(FACTORY_A, null)]);

      renderIntakeSection();

      await userEvent.click(await screen.findByLabelText('Factory to add for Organization alerts'));
      await userEvent.click(await screen.findByRole('option', { name: 'Acme API' }));
      expect(
        screen.getByText('Another factory takes all alerts, so name the labels this factory should take.'),
      ).toBeInTheDocument();
      await userEvent.type(screen.getByLabelText('Labels for Acme API'), 'platform-project:p-1, severity:warning');
      await userEvent.click(screen.getByRole('button', { name: 'Add' }));

      await waitFor(() => expect(saved).toHaveLength(1));
      expect(saved[0]).toMatchObject({
        factoryProjectId: FACTORY_B,
        labels: ['platform-project:p-1', 'severity:warning'],
      });
      expect(await screen.findByLabelText('Alerts from Organization alerts for Acme API')).toHaveTextContent(
        'Only alerts labelled…',
      );
      expect(screen.getByLabelText('Alerts from Organization alerts for Acme Web')).toHaveTextContent(
        'All other alerts',
      );
    });
  });
});
