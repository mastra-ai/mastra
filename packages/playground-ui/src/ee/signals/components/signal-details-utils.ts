import { getSignalCatalogEntry } from '../signals-data';

export function getSignalName(signalId: string) {
  return getSignalCatalogEntry(signalId).name;
}
