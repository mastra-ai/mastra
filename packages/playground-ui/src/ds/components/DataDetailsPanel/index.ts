import { DataDetailsPanel as Root } from './data-details-panel';
import { DataDetailsPanelCloseButton } from './data-details-panel-close-button';
import { DataDetailsPanelCodeSection } from './data-details-panel-code-section';
import { DataDetailsPanelContent } from './data-details-panel-content';
import { DataDetailsPanelHeader } from './data-details-panel-header';
import { DataDetailsPanelHeading } from './data-details-panel-heading';
import { DataDetailsPanelKeyValueList } from './data-details-panel-key-value-list';
import { DataDetailsPanelLoadingData } from './data-details-panel-loading-data';
import { DataDetailsPanelNoData } from './data-details-panel-no-data';

const DataDetailsPanel = Object.assign(Root, {
  Header: DataDetailsPanelHeader,
  Heading: DataDetailsPanelHeading,
  CloseButton: DataDetailsPanelCloseButton,
  LoadingData: DataDetailsPanelLoadingData,
  NoData: DataDetailsPanelNoData,
  Content: DataDetailsPanelContent,
  KeyValueList: DataDetailsPanelKeyValueList,
  CodeSection: DataDetailsPanelCodeSection,
});

export { DataDetailsPanel };
export type { DataDetailsPanelProps } from './data-details-panel';
export type { DataDetailsPanelHeaderProps } from './data-details-panel-header';
export type { DataDetailsPanelHeadingProps } from './data-details-panel-heading';
export type { DataDetailsPanelCloseButtonProps } from './data-details-panel-close-button';
export type { DataDetailsPanelLoadingDataProps } from './data-details-panel-loading-data';
export type { DataDetailsPanelNoDataProps } from './data-details-panel-no-data';
export type { DataDetailsPanelContentProps } from './data-details-panel-content';
export type {
  DataDetailsPanelKeyValueListProps,
  DataDetailsPanelKeyValueListKeyProps,
  DataDetailsPanelKeyValueListValueProps,
  DataDetailsPanelKeyValueListHeaderProps,
} from './data-details-panel-key-value-list';
export type { DataDetailsPanelCodeSectionProps } from './data-details-panel-code-section';
