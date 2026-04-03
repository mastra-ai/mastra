export function getItemsTabCount(params: {
  hasSearchQuery: boolean;
  filteredItemsLength: number;
  unfilteredItemsTotal?: number | null;
  itemsTotal?: number | null;
}): number {
  if (params.hasSearchQuery) {
    return params.filteredItemsLength;
  }

  return params.unfilteredItemsTotal ?? params.itemsTotal ?? params.filteredItemsLength;
}

export function getExperimentsTabCount(params: {
  experimentsLength: number;
  experimentsTotal?: number | null;
}): number {
  return params.experimentsTotal ?? params.experimentsLength;
}
