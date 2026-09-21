import { PageLayoutBase } from './page-layout';
import { PageLayoutColumn } from './page-layout-column';
import { PageLayoutMainArea } from './page-layout-main-area';
import { PageLayoutRow } from './page-layout-row';
import { PageLayoutTopArea } from './page-layout-top-area';

export { NoDataPageLayout } from './no-data-page-layout';
export type { PageLayoutProps } from './page-layout';

export const PageLayout = Object.assign(PageLayoutBase, {
  TopArea: PageLayoutTopArea,
  MainArea: PageLayoutMainArea,
  Column: PageLayoutColumn,
  Row: PageLayoutRow,
});
