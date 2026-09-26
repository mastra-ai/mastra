import { DataDetailsPanelKeyValueListHeader } from './data-details-panel-key-value-list-header';
import { DataDetailsPanelKeyValueListKey } from './data-details-panel-key-value-list-key';
import { DataDetailsPanelKeyValueListRoot } from './data-details-panel-key-value-list-root';
import { DataDetailsPanelKeyValueListValue } from './data-details-panel-key-value-list-value';

export type { DataDetailsPanelKeyValueListHeaderProps } from './data-details-panel-key-value-list-header';
export type { DataDetailsPanelKeyValueListKeyProps } from './data-details-panel-key-value-list-key';
export type { DataDetailsPanelKeyValueListProps } from './data-details-panel-key-value-list-root';
export type { DataDetailsPanelKeyValueListValueProps } from './data-details-panel-key-value-list-value';

export const DataDetailsPanelKeyValueList = Object.assign(DataDetailsPanelKeyValueListRoot, {
  Key: DataDetailsPanelKeyValueListKey,
  Value: DataDetailsPanelKeyValueListValue,
  Header: DataDetailsPanelKeyValueListHeader,
});
