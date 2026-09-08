type getToItemFnParams = {
  entries: { id: string }[];
  id: string | undefined;
  update: (id: string) => void;
};

export const ITEM_LIST_VERSION_STATUS_LABELS = {
  latest: 'Latest version',
  deleted: 'Deleted in this version',
} as const;

export function getItemListVersionStatusLabel({
  isLatest,
  isDeleted,
}: {
  isLatest?: boolean;
  isDeleted?: boolean;
}): string | undefined {
  const labels: string[] = [];
  if (isLatest) labels.push(ITEM_LIST_VERSION_STATUS_LABELS.latest);
  if (isDeleted) labels.push(ITEM_LIST_VERSION_STATUS_LABELS.deleted);
  return labels.length > 0 ? labels.join(' · ') : undefined;
}

export function getToNextItemFn({ entries, id, update }: getToItemFnParams) {
  const currentIndex = entries.findIndex(entry => entry.id === id);
  const thereIsNextItem = currentIndex < entries.length - 1;

  if (thereIsNextItem) {
    return () => {
      const nextItem = entries[currentIndex + 1];
      if (!nextItem) return;
      update(nextItem.id);
    };
  }

  return undefined;
}

export function getToPreviousItemFn({ entries, id, update }: getToItemFnParams) {
  const currentIndex = entries.findIndex(entry => entry.id === id);
  const thereIsPreviousItem = currentIndex > 0;

  if (thereIsPreviousItem) {
    return () => {
      const previousItem = entries[currentIndex - 1];
      if (!previousItem) return;
      update(previousItem.id);
    };
  }

  return undefined;
}
