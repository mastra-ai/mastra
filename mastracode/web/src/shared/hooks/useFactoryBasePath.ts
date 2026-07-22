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
