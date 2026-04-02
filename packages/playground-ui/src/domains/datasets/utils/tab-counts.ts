export function getItemsTabCount(params: {
  hasSearchQuery: boolean;
  filteredItemsLength: number;
  unfilteredItemsTotal: number;
  itemsTotal: number;
}): number {
  if (params.hasSearchQuery) {
    return params.filteredItemsLength;
  }

  return params.unfilteredItemsTotal || params.itemsTotal;
}

export function getExperimentsTabCount(params: {
  experimentsLength: number;
  experimentsTotal?: number | null;
}): number {
  return params.experimentsTotal ?? params.experimentsLength;
}
