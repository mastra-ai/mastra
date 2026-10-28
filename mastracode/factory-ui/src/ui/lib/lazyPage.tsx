import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { lazy, Suspense } from 'react';
import type { ComponentType, ReactNode } from 'react';

const pageSpinner = (
  <div className="flex flex-1 items-center justify-center">
    <Spinner aria-label="Loading page" className="text-muted-foreground" />
  </div>
);

/**
 * Code-splits a route page behind its own `Suspense` boundary. Component-level
 * lazy (not route `lazy`) lets the navigation commit — URL, sidebar — before
 * the chunk arrives. Each call returns a distinct component, so switching pages
 * mounts a fresh boundary and shows the fallback even inside the router's
 * `startTransition`.
 */
export function lazyPage(load: () => Promise<ComponentType>, fallback: ReactNode = pageSpinner) {
  const Page = lazy(() => load().then(Component => ({ default: Component })));

  return function LazyPage() {
    return (
      <Suspense fallback={fallback}>
        <Page />
      </Suspense>
    );
  };
}
