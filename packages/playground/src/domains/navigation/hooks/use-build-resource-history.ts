import { useSyncExternalStore } from 'react';
import { buildResourceCatalog } from '../utils/build-resource-catalog';
import {
  parseBuildHistory,
  readBuildHistorySnapshot,
  subscribeBuildHistory,
  toggleBuildResourcePin,
} from '../utils/build-resource-history';
import type { BuildResource } from '../utils/build-resource-history';
import { useBuildHistoryScope } from './use-build-history-scope';
import { useStudioNavigation } from './use-studio-navigation';

export function useBuildResourceHistory() {
  const key = useBuildHistoryScope();
  const { sections } = useStudioNavigation();
  const snapshot = useSyncExternalStore(
    subscribeBuildHistory,
    () => readBuildHistorySnapshot(key),
    () => '',
  );
  const history = parseBuildHistory(snapshot);
  const allowedPaths = new Set(sections.flatMap(section => section.items.map(item => item.url)));
  const canShow = (item: BuildResource) => allowedPaths.has(buildResourceCatalog[item.kind].path);
  return {
    pinned: history.pinned.filter(canShow),
    recent: history.recent.filter(canShow),
    togglePin: (entry: BuildResource) => {
      if (key && canShow(entry)) toggleBuildResourcePin(key, entry);
    },
  };
}
