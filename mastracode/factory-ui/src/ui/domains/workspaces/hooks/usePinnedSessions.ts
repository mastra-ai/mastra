import { createLocalStorageStore, useLocalStorageStore } from '@mastra/playground-ui/hooks/use-local-storage-store';

const pinnedSessionsStore = createLocalStorageStore<ReadonlySet<string>>({
  key: 'mastracode.pinnedSessions',
  empty: new Set(),
  parse: stored => new Set(Array.isArray(stored) ? stored.filter((id): id is string => typeof id === 'string') : []),
  toJSON: sessions => [...sessions],
});

export function usePinnedSessions() {
  const pinnedSessions = useLocalStorageStore(pinnedSessionsStore);
  const setPinned = (sessionId: string, pinned: boolean) => {
    const next = new Set(pinnedSessionsStore.read());
    if (pinned) next.add(sessionId);
    else next.delete(sessionId);
    pinnedSessionsStore.write(next);
  };

  return { pinnedSessions, setPinned };
}
