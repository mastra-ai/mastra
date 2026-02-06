import { ListAndDetailsRoot } from './list-and-details-root';
import { ListAndDetailsSeparator } from './list-and-details-separator';
import { ListAndDetailsColumn } from './list-and-details-column';

export { type ListAndDetailsRootProps } from './list-and-details-root';
export { type ListAndDetailsColumnProps } from './list-and-details-column';

export const ListAndDetails = Object.assign(ListAndDetailsRoot, {
  Separator: ListAndDetailsSeparator,
  Column: ListAndDetailsColumn,
});
