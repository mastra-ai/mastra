export function getItemsTabCount(params: {
  hasSearchQuery: boolean;
  filteredItemsLength: number;
  unfilteredItemsTotal?: number | null;
  itemsTotal?: number | null;
}): number {
  // During active search, mirror visible rows instead of an unfiltered total.
  if (params.hasSearchQuery) {
    return params.filteredItemsLength;
  }

  return params.unfilteredItemsTotal ?? params.itemsTotal ?? params.filteredItemsLength;
}
