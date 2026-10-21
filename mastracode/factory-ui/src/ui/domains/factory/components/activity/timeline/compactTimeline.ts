import { createLocalStorageStore, useLocalStorageStore } from '@mastra/playground-ui/hooks/use-local-storage-store';

/** Density follows the person across visits. */
const compactTimelineStore = createLocalStorageStore<boolean>({
  key: 'mastracode.activityTimeline.compact',
  defaultValue: false,
  parse: stored => {
    if (typeof stored !== 'boolean') throw new Error('Stored compact flag is not a boolean');
    return stored;
  },
});

export function useCompactTimeline(): boolean {
  return useLocalStorageStore(compactTimelineStore);
}

export function setCompactTimeline(compact: boolean): void {
  compactTimelineStore.write(compact);
}
