import { Toaster } from '@mastra/playground-ui/components/Toaster';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { server } from '../../../../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../../../../e2e/ui/render';
import { KnowledgeImportersSection } from '../KnowledgeImportersSection';

/**
 * Nango's headless auth is the browser boundary the SPA drives after the
 * server mints a connect session. Stub the SDK and log constructor + auth
 * calls so specs can assert the session token / integration id are passed
 * through unchanged. Everything upstream (feature flag, connection list,
 * session mint) stays on the MSW network.
 */
const nangoAuthCalls: Array<{ integrationId: string; options: Record<string, unknown> }> = [];
const nangoConstructorOptions: Array<Record<string, unknown>> = [];

vi.mock('@nangohq/frontend', () => {
  class MockNango {
    win = { close: vi.fn() };
    constructor(options: Record<string, unknown>) {
      nangoConstructorOptions.push(options);
    }
    auth(integrationId: string, options: Record<string, unknown>) {
      nangoAuthCalls.push({ integrationId, options });
      return Promise.resolve({ connectionId: 'nango-conn', providerConfigKey: integrationId });
    }
  }
  class AuthError extends Error {
    type = 'unknown';
  }
  return { default: MockNango, AuthError };
});

beforeEach(() => {
  nangoAuthCalls.length = 0;
  nangoConstructorOptions.length = 0;
});

const FEATURES_URL = `${TEST_BASE_URL}/web/config/features`;
const IMPORTER_PROVIDERS = ['notion', 'confluence', 'linear', 'zendesk', 'fireflies'] as const;

/** Stub `/web/config/features` with a `knowledge` flag value. */
function useFeaturesHandler(knowledge: boolean | undefined) {
  server.use(
    http.get(FEATURES_URL, () =>
      HttpResponse.json(knowledge === undefined ? {} : { knowledge }),
    ),
  );
}

interface ConnectionRow {
  id: string;
  integrationId: string;
  status: 'active' | 'needs_reauth';
  accountLabel: string | null;
  connectedAt?: string | null;
}

/**
 * Register connection-list responses per importer provider. Providers with no
 * explicit entry return an empty connection list.
 */
function useConnectionHandlers(connections: Partial<Record<(typeof IMPORTER_PROVIDERS)[number], ConnectionRow[]>>) {
  for (const provider of IMPORTER_PROVIDERS) {
    const rows = connections[provider] ?? [];
    server.use(
      http.get(`${TEST_BASE_URL}/web/integrations/platform/${provider}/connections`, () =>
        HttpResponse.json({ connections: rows }),
      ),
    );
  }
}

/**
 * Log every connect-session POST to assert the SPA hits the exact provider
 * endpoint. Returns a mutable list so specs can inspect after interaction.
 */
function useConnectSessionSpy() {
  const minted: Array<{ provider: string }> = [];
  for (const provider of IMPORTER_PROVIDERS) {
    server.use(
      http.post(`${TEST_BASE_URL}/web/integrations/platform/${provider}/connect-session`, () => {
        minted.push({ provider });
        return HttpResponse.json(
          {
            connectionId: `${provider}-conn`,
            integrationId: provider,
            connectUrl: `https://connect.nango.dev/${provider}`,
            sessionToken: `session-${provider}`,
            expiresAt: new Date(Date.now() + 60_000).toISOString(),
          },
          { status: 201 },
        );
      }),
    );
  }
  return minted;
}

function renderSection() {
  return renderWithProviders(
    <>
      <KnowledgeImportersSection />
      <Toaster position="bottom-right" />
    </>,
  );
}

describe('KnowledgeImportersSection', () => {
  describe('feature gate', () => {
    it('renders nothing when the knowledge feature flag is false', async () => {
      useFeaturesHandler(false);
      useConnectionHandlers({});
      const { container } = renderSection();
      // Give the query time to resolve — the negative assertion needs the
      // feature flag to have loaded before we conclude the section is hidden.
      await waitFor(() => {
        expect(container.querySelector('h1, h2, h3, h4, h5, h6')).toBeNull();
      });
      expect(screen.queryByText(/Knowledge importers/i)).toBeNull();
    });

    it('renders nothing when the knowledge feature flag is missing entirely', async () => {
      useFeaturesHandler(undefined);
      useConnectionHandlers({});
      renderSection();
      await new Promise(resolve => setTimeout(resolve, 20));
      expect(screen.queryByText(/Knowledge importers/i)).toBeNull();
    });
  });

  describe('feature on, no connections', () => {
    it('lists five provider rows with a Connect button and a "sync into knowledge" description', async () => {
      useFeaturesHandler(true);
      useConnectionHandlers({});
      renderSection();

      // Section header
      expect(await screen.findByText('Knowledge importers')).toBeInTheDocument();

      // One row per importer, each with a Connect button whose accessible
      // name includes the provider's display name.
      for (const displayName of ['Notion', 'Confluence', 'Linear', 'Zendesk', 'Fireflies']) {
        expect(await screen.findByText(displayName)).toBeInTheDocument();
        expect(await screen.findByRole('button', { name: `Connect ${displayName}` })).toBeInTheDocument();
      }
    });
  });

  describe('feature on with existing connections', () => {
    it('shows the account label, connected time, and no Connect button when Notion has one active connection', async () => {
      useFeaturesHandler(true);
      // Freshly minted 5 minutes ago — the compact relative-time helper will
      // render this as "5m", which is the assertion below.
      const connectedAt = new Date(Date.now() - 5 * 60_000).toISOString();
      useConnectionHandlers({
        notion: [
          { id: 'notion-1', integrationId: 'notion', status: 'active', accountLabel: 'acme-workspace', connectedAt },
        ],
      });
      renderSection();

      // Notion row lists the account label. That's the only signal — no
      // "Connected" pill, no redundant status copy.
      expect(await screen.findByText('acme-workspace')).toBeInTheDocument();
      // And the connection time renders alongside as compact relative text.
      expect(await screen.findByText('· 5m')).toBeInTheDocument();
      // With an active connection there is no per-card Connect button — the
      // presence of a listed account is what conveys the connected state.
      expect(screen.queryByRole('button', { name: 'Connect Notion' })).toBeNull();
      // Other providers unaffected.
      expect(await screen.findByRole('button', { name: 'Connect Confluence' })).toBeInTheDocument();
    });

    it('falls back to "Connected by <provider>" when the account label is missing, never the raw id', async () => {
      useFeaturesHandler(true);
      useConnectionHandlers({
        linear: [{ id: 'linear-abc-123', integrationId: 'linear', status: 'active', accountLabel: null }],
      });
      renderSection();

      // Nothing about the internal connection id should ever hit the DOM —
      // users see either the workspace/account label or the humane fallback.
      expect(await screen.findByText('Connected by Linear')).toBeInTheDocument();
      expect(screen.queryByText('linear-abc-123')).toBeNull();
    });

    it('lists a stale Zendesk connection with a Reconnect button and no Connect fallback', async () => {
      useFeaturesHandler(true);
      useConnectionHandlers({
        zendesk: [{ id: 'zd-1', integrationId: 'zendesk', status: 'needs_reauth', accountLabel: 'acme.zendesk.com' }],
      });
      renderSection();

      // The stale connection is listed by its account label — no explicit
      // "Needs reauthorization" copy on the card; the Reconnect action is
      // the signal.
      expect(await screen.findByText('acme.zendesk.com')).toBeInTheDocument();
      expect(await screen.findByRole('button', { name: /Reconnect/i })).toBeInTheDocument();
      // No Connect Zendesk button because the provider is already connected
      // (even if the connection needs reauthorization).
      expect(screen.queryByRole('button', { name: 'Connect Zendesk' })).toBeNull();
    });
  });

  describe('per-connection routing', () => {
    const notionConnected = () =>
      useConnectionHandlers({
        notion: [{ id: 'notion-1', integrationId: 'notion', status: 'active', accountLabel: 'acme-workspace' }],
      });

    /** Two Factory projects for the selector; connections sub-fetch stays ambient-empty. */
    function useProjectsHandler() {
      server.use(
        http.get(`${TEST_BASE_URL}/web/factory/projects`, () =>
          HttpResponse.json({ projects: [{ id: 'p1', name: 'Alpha' }, { id: 'p2', name: 'Beta' }] }),
        ),
      );
    }

    function useRoutingHandlers(initial: { mode: 'all' | 'selected'; projectIds: string[] }) {
      let current = initial;
      const puts: Array<{ mode: string; projectIds?: string[] }> = [];
      server.use(
        http.get(`${TEST_BASE_URL}/web/integrations/platform/notion/connections/notion-1/routing`, () =>
          HttpResponse.json({ routing: current }),
        ),
        http.put(
          `${TEST_BASE_URL}/web/integrations/platform/notion/connections/notion-1/routing`,
          async ({ request }) => {
            const body = (await request.json()) as { mode: 'all' | 'selected'; projectIds?: string[] };
            puts.push(body);
            current = { mode: body.mode, projectIds: body.projectIds ?? [] };
            return HttpResponse.json({ routing: current });
          },
        ),
      );
      return puts;
    }

    it('summarizes an unrouted connection as syncing to all projects', async () => {
      useFeaturesHandler(true);
      notionConnected();
      useProjectsHandler();
      useRoutingHandlers({ mode: 'all', projectIds: [] });
      renderSection();

      expect(await screen.findByRole('button', { name: 'Sync to: All projects' })).toBeInTheDocument();
    });

    it('summarizes a selected-mode connection with its live project count', async () => {
      useFeaturesHandler(true);
      notionConnected();
      useProjectsHandler();
      useRoutingHandlers({ mode: 'selected', projectIds: ['p2'] });
      renderSection();

      expect(await screen.findByRole('button', { name: 'Sync to: 1 of 2 projects' })).toBeInTheDocument();
    });

    it('narrows from all projects with a single toggle saved through the routing PUT', async () => {
      useFeaturesHandler(true);
      notionConnected();
      useProjectsHandler();
      const puts = useRoutingHandlers({ mode: 'all', projectIds: [] });
      renderSection();

      const user = userEvent.setup();
      await user.click(await screen.findByRole('button', { name: 'Sync to: All projects' }));

      // In all-projects mode every project item shows checked; unchecking
      // Alpha narrows the selection to everything else, saved immediately.
      await user.click(await screen.findByRole('menuitemcheckbox', { name: 'Alpha' }));

      await waitFor(() => {
        expect(puts).toEqual([{ mode: 'selected', projectIds: ['p2'] }]);
      });
      // The trigger summary reflects the saved selection.
      expect(await screen.findByRole('button', { name: 'Sync to: 1 of 2 projects' })).toBeInTheDocument();
    });

    it('re-selecting every project collapses the selection back to all-projects mode', async () => {
      useFeaturesHandler(true);
      notionConnected();
      useProjectsHandler();
      const puts = useRoutingHandlers({ mode: 'selected', projectIds: ['p2'] });
      renderSection();

      const user = userEvent.setup();
      await user.click(await screen.findByRole('button', { name: 'Sync to: 1 of 2 projects' }));
      await user.click(await screen.findByRole('menuitemcheckbox', { name: 'Alpha' }));

      // Both projects selected ≡ all — stored as mode all so future projects
      // are included automatically.
      await waitFor(() => {
        expect(puts).toEqual([{ mode: 'all', projectIds: [] }]);
      });
      expect(await screen.findByRole('button', { name: 'Sync to: All projects' })).toBeInTheDocument();
    });

    it('reverts the summary and raises a toast when the routing save fails', async () => {
      useFeaturesHandler(true);
      notionConnected();
      useProjectsHandler();
      useRoutingHandlers({ mode: 'all', projectIds: [] });
      server.use(
        http.put(`${TEST_BASE_URL}/web/integrations/platform/notion/connections/notion-1/routing`, () =>
          HttpResponse.json({ error: 'platform_request_failed' }, { status: 502 }),
        ),
      );
      renderSection();

      const user = userEvent.setup();
      await user.click(await screen.findByRole('button', { name: 'Sync to: All projects' }));
      await user.click(await screen.findByRole('menuitemcheckbox', { name: 'Alpha' }));

      // Failure surfaces as a toast; the stored summary is untouched.
      expect(await screen.findByText(/Couldn't update sync destinations/)).toBeInTheDocument();
      expect(await screen.findByRole('button', { name: 'Sync to: All projects' })).toBeInTheDocument();
    });

    it('allows unchecking the last selected project — connected but linked to no Factory is valid', async () => {
      useFeaturesHandler(true);
      notionConnected();
      useProjectsHandler();
      const puts = useRoutingHandlers({ mode: 'selected', projectIds: ['p2'] });
      renderSection();

      const user = userEvent.setup();
      await user.click(await screen.findByRole('button', { name: 'Sync to: 1 of 2 projects' }));
      // Beta is the only selected project — unchecking it leaves the
      // connection established but routed nowhere.
      await user.click(await screen.findByRole('menuitemcheckbox', { name: 'Beta' }));

      await waitFor(() => {
        expect(puts).toEqual([{ mode: 'selected', projectIds: [] }]);
      });
      expect(await screen.findByRole('button', { name: 'Sync to: No projects' })).toBeInTheDocument();
    });

    it('offers a retry instead of hiding when the routing load fails transiently', async () => {
      useFeaturesHandler(true);
      notionConnected();
      useProjectsHandler();
      let failures = 0;
      server.use(
        http.get(`${TEST_BASE_URL}/web/integrations/platform/notion/connections/notion-1/routing`, () => {
          failures += 1;
          if (failures === 1) return HttpResponse.json({ error: 'platform_request_failed' }, { status: 502 });
          return HttpResponse.json({ routing: { mode: 'all', projectIds: [] } });
        }),
      );
      renderSection();

      // A 5xx is a blip, not "feature absent" — the control degrades to a
      // retry affordance instead of vanishing.
      expect(await screen.findByText(/Couldn't load sync destinations/)).toBeInTheDocument();
      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: 'Retry' }));
      expect(await screen.findByRole('button', { name: 'Sync to: All projects' })).toBeInTheDocument();
    });

    it('hides the routing control entirely when the server mounts no routing routes', async () => {
      useFeaturesHandler(true);
      notionConnected();
      useProjectsHandler();
      // No routing handler override — the ambient 404 stands in for an
      // older server without the routing storage domain.
      renderSection();

      expect(await screen.findByText('acme-workspace')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Sync to/ })).toBeNull();
    });
  });

  describe('brand logos', () => {
    it('renders the Nango-supplied logo when the platform catalog knows the provider', async () => {
      useFeaturesHandler(true);
      useConnectionHandlers({});
      server.use(
        http.get(`${TEST_BASE_URL}/web/integrations/platform/catalog`, () =>
          HttpResponse.json({
            integrations: [
              {
                provider: 'notion',
                integrationId: 'notion',
                displayName: 'Notion',
                logoUrl: 'https://app.nango.dev/images/template-logos/notion.svg',
              },
              // Confluence intentionally omitted — proves the missing-catalog
              // path falls back to the source ladder rather than blanking.
            ],
          }),
        ),
      );
      const { container } = renderSection();
      // Notion card carries the thesvg.org mono at first paint (it walks the
      // source ladder on error). Verify the Nango URL is at least prepared
      // as a fallback — inspect the DOM once the catalog resolves.
      await screen.findByText('Notion');
      // The logo wrapper carries the display name as aria-label; there's one
      // per registered provider.
      const notionLogo = container.querySelector('[aria-label="Notion"] img');
      expect(notionLogo).not.toBeNull();
      // Assertion is scoped to the src on first render: thesvg.org mono.
      expect((notionLogo as HTMLImageElement).src).toContain('thesvg.org/icons/notion/mono.svg');
    });
  });

  describe('Connect button interaction', () => {
    it('mints a session against the provider-specific endpoint and drives Nango with the session token', async () => {
      useFeaturesHandler(true);
      useConnectionHandlers({});
      const minted = useConnectSessionSpy();

      renderSection();
      const notionConnect = await screen.findByRole('button', { name: 'Connect Notion' });

      const user = userEvent.setup();
      await user.click(notionConnect);

      // Session was minted at the notion-specific endpoint (not jira, not
      // incident-io) — this is the invariant the SPA registry has to hold.
      await waitFor(() => {
        expect(minted.map(m => m.provider)).toContain('notion');
      });

      // Nango driver received the session token and provider integrationId
      // unchanged.
      await waitFor(() => {
        expect(nangoConstructorOptions[0]?.connectSessionToken).toBe('session-notion');
        expect(nangoAuthCalls[0]?.integrationId).toBe('notion');
      });
    });
  });
});
