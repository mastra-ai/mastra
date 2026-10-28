import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { Suspense } from 'react';
import { Outlet, useMatches } from 'react-router';

/**
 * Settings section pages are `React.lazy` components rendered under this
 * eager layout, not route-level `lazy`: a route `lazy` blocks the navigation
 * commit until its chunk loads, whereas suspending here lets the URL (and the
 * settings sidebar, which keys off it) switch immediately while the page chunk
 * streams in.
 *
 * Router updates run inside `startTransition`, which keeps an already-mounted
 * boundary showing stale content instead of its fallback. Keying on the leaf
 * route remounts the boundary when switching to a page backed by another chunk.
 */
export function SettingsLayout() {
  const leafRouteId = useMatches().at(-1)?.id;

  return (
    <Suspense
      key={leafRouteId}
      fallback={
        <div className="flex flex-1 items-center justify-center">
          <Spinner aria-label="Loading settings" className="text-muted-foreground" />
        </div>
      }
    >
      <Outlet />
    </Suspense>
  );
}
