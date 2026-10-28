import { BrandLoader } from '@mastra/playground-ui/components/BrandLoader';
import { lazy, Suspense } from 'react';
import type { ComponentType, ReactNode } from 'react';

function PageLoader() {
  return (
    <div className="flex flex-1 items-center justify-center transition-opacity delay-150 starting:opacity-0">
      <BrandLoader size="lg" aria-label="Loading page" />
    </div>
  );
}

/**
 * A page loaded on first visit. Navigations run in a transition, which keeps a
 * boundary already showing a page instead of its loader; each call returns its
 * own component, so opening the page mounts a fresh boundary that shows it.
 */
export function lazyPage(load: () => Promise<ComponentType>, fallback: ReactNode = <PageLoader />) {
  const Page = lazy(async () => ({ default: await load() }));

  return function LazyPage() {
    return (
      <Suspense fallback={fallback}>
        <Page />
      </Suspense>
    );
  };
}
