import { ListAndDetailsRoot } from './list-and-details-root';
import { ListAndDetailsSeparator } from './list-and-details-separator';
import { ListAndDetailsList } from './list-and-details-list';
import { ListAndDetailsDetails } from './list-and-details-details';
import { ListAndDetailsColumn } from './list-and-details-column';
import { ListAndDetailsColumnToolbar } from './list-and-details-column-toolbar';
import { ListAndDetailsColumnContent } from './list-and-details-column-content';
import { ListAndDetailsNextPrevNavigation } from './list-and-details-next-prev-navigation';
import { ListAndDetailsCloseButton } from './list-and-details-close-button';

export { type ListAndDetailsRootProps } from './list-and-details-root';
export { type ListAndDetailsColumnProps } from './list-and-details-column';
export { type ListAndDetailsColumnToolbarProps } from './list-and-details-column-toolbar';
export { type ListAndDetailsColumnContentProps } from './list-and-details-column-content';
export { type ListAndDetailsNextPrevNavigationProps } from './list-and-details-next-prev-navigation';
export { type ListAndDetailsCloseButtonProps } from './list-and-details-close-button';

export const ListAndDetails = Object.assign(ListAndDetailsRoot, {
  Separator: ListAndDetailsSeparator,
  List: ListAndDetailsList,
  Details: ListAndDetailsDetails,
  Column: ListAndDetailsColumn,
  ColumnToolbar: ListAndDetailsColumnToolbar,
  ColumnContent: ListAndDetailsColumnContent,
  NextPrevNavigation: ListAndDetailsNextPrevNavigation,
  CloseButton: ListAndDetailsCloseButton,
});
