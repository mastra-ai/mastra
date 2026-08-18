import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Component, useEffect, useMemo, type ReactNode } from 'react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { buildPortalRoutes } from './routes';
import type { StudioContext } from './context';
import { EnabledDomainsContext, useEnabledDomains } from './domains-context';

export { useEnabledDomains };
import { StudioConfigContext } from '@/domains/configuration/context/studio-config-state';
import { RoleImpersonationProvider } from '@/domains/auth/context/role-impersonation-context';

/**
 * StudioPortalShell — one React tree, one container. Renders the real Studio
 * chrome + real playground pages, gated by Platform's `enabledDomains` map.
 *
 * Configuration is portal-flavored: Studio's StudioConfigContext gets values
 * straight from `ctx` (no localStorage, no instance-status probing). Auth
 * flows through `MastraReactProvider`'s customFetch, which reads live headers
 * from `ctx.getAuthHeaders()` on every request.
 */
export function StudioPortalShell({
  ctx,
  enabledDomains,
  onReady,
}: {
  ctx: StudioContext;
  enabledDomains: Record<string, boolean>;
  onReady?: (api: { navigate: (path: string) => void }) => void;
}) {
  const queryClient = useMemo(() => new QueryClient(), []);

  // Snapshot routes + router ONCE per mount. Rebuilding on every render would
  // reset the memory router back to `initialEntries` and blow away route
  // navigation state (e.g. clicking "Workflows" would bounce back to /agents).
  const router = useMemo(
    () =>
      createMemoryRouter(buildPortalRoutes(enabledDomains), {
        initialEntries: [ctx.initialPath ?? '/agents'],
      }),
    // Intentionally mount-only; Platform is expected to remount the whole
    // portal if the domain allowlist changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useEffect(() => {
    onReady?.({
      navigate: (path: string) => {
        void router.navigate(path);
      },
    });
  }, [router, onReady]);

  const customFetch = useMemo(() => makeAuthedFetch(ctx), [ctx]);

  // Some Studio hooks bypass MastraReactProvider's customFetch and call
  // `fetch()` directly with `client.options.headers`. So we merge
  // `ctx.staticAuthHeaders` (a synchronous Platform-supplied seed) into the
  // static headers. Rotating tokens still flow through `customFetch` via
  // `getAuthHeaders()`; static headers just cover cold-start raw fetches.
  const staticHeaders = useMemo(
    () => ({ 'x-mastra-client-type': 'studio' as const, ...(ctx.staticAuthHeaders ?? {}) }),
    [ctx.staticAuthHeaders],
  );

  // Portal-flavored StudioConfig — values come from ctx, no localStorage
  // persistence, no instance-status fetching. The real StudioConfigProvider
  // is for standalone Studio where the config is user-editable.
  const studioConfig = useMemo(
    () => ({
      baseUrl: ctx.serverUrl,
      apiPrefix: ctx.apiPrefix ?? '/api',
      headers: staticHeaders as Record<string, string>,
      isLoading: false,
      setConfig: () => {
        // no-op in portal mode; Platform owns config
      },
    }),
    [ctx.serverUrl, ctx.apiPrefix, staticHeaders],
  );

  return (
    <PortalErrorBoundary>
      <EnabledDomainsContext.Provider value={enabledDomains}>
        <QueryClientProvider client={queryClient}>
          <StudioConfigContext.Provider value={studioConfig}>
            <MastraReactProvider
              baseUrl={ctx.serverUrl}
              apiPrefix={ctx.apiPrefix ?? '/api'}
              headers={staticHeaders}
              customFetch={customFetch}
            >
              <RoleImpersonationProvider>
                <RouterProvider router={router} />
              </RoleImpersonationProvider>
            </MastraReactProvider>
          </StudioConfigContext.Provider>
        </QueryClientProvider>
      </EnabledDomainsContext.Provider>
    </PortalErrorBoundary>
  );
}

function makeAuthedFetch(ctx: StudioContext): typeof fetch {
  const baseFetch = ctx.fetch ?? fetch.bind(globalThis);
  return async (input, init) => {
    const authHeaders = await ctx.getAuthHeaders();
    const headers = new Headers(init?.headers);
    for (const [k, v] of Object.entries(authHeaders)) headers.set(k, v);
    const response = await baseFetch(input, { ...init, headers });
    if ((response.status === 401 || response.status === 403) && ctx.onAuthError) {
      ctx.onAuthError(response.status);
    }
    return response;
  };
}

class PortalErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error) {
    // eslint-disable-next-line no-console
    console.error('[studio-portal] render error', error);
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 12, color: '#f66', fontFamily: 'system-ui', fontSize: 12 }}>
          <strong>Portal render error:</strong>
          <pre style={{ whiteSpace: 'pre-wrap', margin: '8px 0 0' }}>
            {this.state.error.message}
            {'\n\n'}
            {this.state.error.stack}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}
