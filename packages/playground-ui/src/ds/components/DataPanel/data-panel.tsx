import { DataPanelCloseButton } from './data-panel-close-button';
import { DataPanelContent } from './data-panel-content';
import { DataPanelHeader } from './data-panel-header';
import { DataPanelHeading } from './data-panel-heading';
import { DataPanelLoadingData } from './data-panel-loading-data';
import { DataPanelNextPrevNav } from './data-panel-next-prev-nav';
import { DataPanelNoData } from './data-panel-no-data';
import { DataPanelRoot } from './data-panel-root';
import { DataCodeSection } from '@/ds/components/DataCodeSection';

export const DataPanel = Object.assign(DataPanelRoot, {
  Header: DataPanelHeader,
  Heading: DataPanelHeading,
  CloseButton: DataPanelCloseButton,
  NextPrevNav: DataPanelNextPrevNav,
  LoadingData: DataPanelLoadingData,
  NoData: DataPanelNoData,
  Content: DataPanelContent,
  CodeSection: DataCodeSection,
});
