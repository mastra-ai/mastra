import { useParams } from 'react-router';

/**
 * Builders for factory-scoped URLs (`/factories/:factoryId/...`). The plain
 * function serves call sites that target a factory other than the one in the
 * current URL (e.g. right after creating a factory).
 */
export function factoryBasePath(factoryId: string) {
  const base = `/factories/${encodeURIComponent(factoryId)}`;
  return {
    base,
    newThread: () => `${base}/new`,
    thread: (threadId: string) => `${base}/threads/${encodeURIComponent(threadId)}`,
    userThread: (threadId: string) => `${base}/user/threads/${encodeURIComponent(threadId)}`,
  };
}

/** Factory-scoped URL builders for the factory in the current URL. */
export function useFactoryBasePath() {
  const { factoryId } = useParams<{ factoryId: string }>();
  return factoryBasePath(factoryId ?? '');
}

/**
 * Sub-pages that make sense for any factory; preserved when switching the
 * active factory. Thread routes are scope-specific, so switching falls back
 * to the draft composer.
 */
const PRESERVED_SUBPAGES = new Set(['overview', 'work', 'review', 'metrics', 'audit', 'new']);

/**
 * Destination for switching to another factory from `currentPathname`: the
 * current sub-page is preserved when it applies to any factory, otherwise
 * the draft composer (`/new`).
 */
export function factorySwitchPath(factoryId: string, currentPathname: string): string {
  const match = /^\/factories\/[^/]+\/([^/]+)$/.exec(currentPathname);
  const suffix = match && PRESERVED_SUBPAGES.has(match[1]) ? `/${match[1]}` : '/new';
  return `${factoryBasePath(factoryId).base}${suffix}`;
}
