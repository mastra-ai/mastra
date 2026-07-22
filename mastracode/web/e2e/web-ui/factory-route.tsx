import { useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';
import type { ReactNode } from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';

import { queryKeys } from '../../src/shared/api/keys';
import { ActiveFactoryProvider } from '../../src/web/ui/domains/workspaces';
import { loadFactories } from '../../src/web/ui/domains/workspaces/services/factories';

/** Canonical factory-scoped URL builder for tests. */
export function factoryPath(factoryId: string, suffix = ''): string {
  return `/factories/${factoryId}${suffix}`;
}

/** Renders the current pathname so tests can assert navigation results. */
export function LocationProbe() {
  const location = useLocation();
  return <span data-testid="location">{location.pathname}</span>;
}

/**
 * Mounts children inside `ActiveFactoryProvider` at a `/factories/:factoryId`
 * route, mirroring the runtime `ActiveFactoryLayout` mount point so
 * `useActiveFactory` resolves the factory from the URL param.
 *
 * - `factoryId` chooses the initial URL (`/factories/<id><initialSuffix>`).
 * - `routePath` is the route pattern under `/factories/:factoryId/` (defaults
 *   to `*` so any sub-page matches; pass e.g. `threads/:threadId` when the
 *   children need that param resolved).
 * - Navigations that leave the factory scope (e.g. navigating to `/`)
 *   land on a fallback route that renders a `data-testid="location"` probe.
 */
export function FactoryRouteHarness({
  factoryId,
  initialSuffix = '/new',
  routePath = '*',
  children,
}: {
  factoryId: string;
  initialSuffix?: string;
  routePath?: string;
  children: ReactNode;
}) {
  // Seed the factories query cache synchronously from the localStorage list
  // the test just seeded. Without this the first render resolves no active
  // factory (session resourceId falls back to the default) and the async
  // hydration then flips it, remounting key-ed subtrees (ChatSessionBoundary)
  // mid-test — a harness-only artifact the runtime shell doesn't have. The
  // background refetch still runs and structurally shares identical data.
  const queryClient = useQueryClient();
  const seeded = useRef(false);
  if (!seeded.current) {
    seeded.current = true;
    queryClient.setQueryData(queryKeys.factories(), loadFactories());
  }

  return (
    <MemoryRouter initialEntries={[factoryPath(factoryId, initialSuffix)]}>
      <Routes>
        <Route
          path={`/factories/:factoryId/${routePath}`}
          element={<ActiveFactoryProvider>{children}</ActiveFactoryProvider>}
        />
        <Route path="*" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>
  );
}
