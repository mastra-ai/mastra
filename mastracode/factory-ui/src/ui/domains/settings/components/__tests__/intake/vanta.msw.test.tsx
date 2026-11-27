import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '../../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL } from '../../../../../../../e2e/ui/render';
import type { PlatformProviderConnection } from '../../../../factory/services/platformConnect';
import { INTAKE_SOURCES_URL, baseConfig, renderIntakeSection, seedFactories, useIntakeHandlers } from './fixtures';

const VANTA_STATUS_URL = `${TEST_BASE_URL}/web/vanta/status`;
const VANTA_CONNECTIONS_URL = `${TEST_BASE_URL}/web/integrations/platform/vanta/connections`;

const expiredConnection: PlatformProviderConnection = {
  id: 'vanta-acme',
  integrationId: 'vanta',
  status: 'needs_reauth',
  accountLabel: 'acme',
};

/** Vanta reports `ready` for any tenant with an organization, whatever state its connections are in. */
function useVantaHandlers(connections: () => Response) {
  useIntakeHandlers({ config: { ...baseConfig(), vanta: { enabled: true, sourceIds: ['vanta-source:vulns'] } } });
  const sourceRequests: string[] = [];
  server.use(
    http.get(VANTA_STATUS_URL, () => HttpResponse.json({ enabled: true, configured: true, reason: 'ready' })),
    http.get(VANTA_CONNECTIONS_URL, connections),
    http.get(INTAKE_SOURCES_URL, ({ request }) => {
      sourceRequests.push(request.url);
      return HttpResponse.json({ sources: [], failures: [] });
    }),
  );
  return sourceRequests;
}

describe('IntakeSection vanta', () => {
  describe('given saved Vanta sources and a connection that needs to be reconnected', () => {
    it('asks to reconnect instead of loading sources forever', async () => {
      seedFactories();
      const sourceRequests = useVantaHandlers(() => HttpResponse.json({ connections: [expiredConnection] }));

      renderIntakeSection();

      const section = await screen.findByRole('region', { name: 'Vanta' });
      expect(
        await within(section).findByText('A Vanta account needs to be reconnected to keep syncing vulnerabilities.'),
      ).toBeInTheDocument();
      expect(within(section).queryByRole('status', { name: 'Loading Vulnerability sources' })).not.toBeInTheDocument();
      expect(within(section).queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();
      expect(sourceRequests).toHaveLength(0);
    });
  });

  describe('given Vanta connections fail to load', () => {
    it('retries connections and status without listing sources', async () => {
      seedFactories();
      let connectionRequests = 0;
      const sourceRequests = useVantaHandlers(() => {
        connectionRequests += 1;
        return HttpResponse.json({ error: 'boom' }, { status: 500 });
      });

      renderIntakeSection();

      // With no account connected, Vanta is a plain row, not a region of its own.
      const row = (await screen.findByText("Couldn't load Vanta connections.")).closest<HTMLElement>(
        '[data-slot="settings-item"]',
      );
      await userEvent.click(within(row!).getByRole('button', { name: 'Retry' }));

      await expect.poll(() => connectionRequests).toBe(2);
      expect(sourceRequests).toHaveLength(0);
    });
  });
});
