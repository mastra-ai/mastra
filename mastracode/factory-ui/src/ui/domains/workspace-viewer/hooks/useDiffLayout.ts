import { createLocalStorageStore, useLocalStorageStore } from '@mastra/playground-ui/hooks/use-local-storage-store';

const DIFF_LAYOUTS = ['unified', 'split'] as const;
export type DiffLayout = (typeof DIFF_LAYOUTS)[number];

const diffLayoutStore = createLocalStorageStore<DiffLayout>({
  key: 'mastracode.diffLayout',
  defaultValue: 'unified',
  parse: stored => {
    const layout = DIFF_LAYOUTS.find(candidate => candidate === stored);
    if (!layout) throw new Error('Stored diff layout is unknown');
    return layout;
  },
});

export function useDiffLayout(): DiffLayout {
  return useLocalStorageStore(diffLayoutStore);
}

export function setDiffLayout(layout: DiffLayout) {
  diffLayoutStore.write(layout);
}
