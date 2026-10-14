import { createLocalStorageStore, useLocalStorageStore } from '@mastra/playground-ui/hooks/use-local-storage-store';

const pinnedSessionsStore = createLocalStorageStore<ReadonlySet<string>>({
  key: 'mastracode.pinnedSessions',
  defaultValue: new Set(),
  parse: stored => {
    if (!Array.isArray(stored)) throw new Error('Stored pinned sessions are not a list');
    return new Set(stored.filter((id): id is string => typeof id === 'string'));
  },
  toJSON: sessions => [...sessions],
});

export function usePinnedSessions(): ReadonlySet<string> {
  return useLocalStorageStore(pinnedSessionsStore);
}

export function setSessionPinned(sessionId: string, pinned: boolean) {
  const next = new Set(pinnedSessionsStore.read());
  if (pinned) next.add(sessionId);
  else next.delete(sessionId);
  pinnedSessionsStore.write(next);
}
