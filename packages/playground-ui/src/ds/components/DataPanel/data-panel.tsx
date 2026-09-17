import { DataPanelCloseButton } from './data-panel-close-button';
import { DataPanelContent } from './data-panel-content';
import { DataPanelHeader } from './data-panel-header';
import { DataPanelHeaderActions } from './data-panel-header-actions';
import { DataPanelHeaderContent } from './data-panel-header-content';
import { DataPanelHeading } from './data-panel-heading';
import { DataPanelLoadingData } from './data-panel-loading-data';
import { DataPanelMeta, DataPanelMetadata } from './data-panel-metadata';
import { DataPanelNextPrevNav } from './data-panel-next-prev-nav';
import { DataPanelNoData } from './data-panel-no-data';
import { DataPanelRoot } from './data-panel-root';
import { DataPanelSectionHeading } from './data-panel-section-heading';
import { DataCodeSection } from '@/ds/components/DataCodeSection';

export const DataPanel = Object.assign(DataPanelRoot, {
  Header: DataPanelHeader,
  HeaderContent: DataPanelHeaderContent,
  HeaderActions: DataPanelHeaderActions,
  Heading: DataPanelHeading,
  Metadata: DataPanelMetadata,
  Meta: DataPanelMeta,
  CloseButton: DataPanelCloseButton,
  NextPrevNav: DataPanelNextPrevNav,
  LoadingData: DataPanelLoadingData,
  NoData: DataPanelNoData,
  Content: DataPanelContent,
  CodeSection: DataCodeSection,
  SectionHeading: DataPanelSectionHeading,
});
