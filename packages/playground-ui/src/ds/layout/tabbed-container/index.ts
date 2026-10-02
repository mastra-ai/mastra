import { TabbedContainerDataList, TabbedContainerPanel, TabbedContainerRoot } from './tabbed-container-root';

export type {
  TabbedContainerDataListProps,
  TabbedContainerFilterProps,
  TabbedContainerPanelProps,
  TabbedContainerProps,
  TabbedContainerSearchProps,
} from './tabbed-container-root';

export const TabbedContainer = Object.assign(TabbedContainerRoot, {
  Panel: TabbedContainerPanel,
  DataList: TabbedContainerDataList,
});
