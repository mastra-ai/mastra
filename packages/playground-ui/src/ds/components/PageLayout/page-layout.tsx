import { PageLayoutColumn } from './page-layout-column';
import { PageLayoutMainArea } from './page-layout-main-area';
import { PageLayoutRoot } from './page-layout-root';
import { PageLayoutRow } from './page-layout-row';
import { PageLayoutTopArea } from './page-layout-top-area';

export const PageLayout = Object.assign(PageLayoutRoot, {
  TopArea: PageLayoutTopArea,
  MainArea: PageLayoutMainArea,
  Column: PageLayoutColumn,
  Row: PageLayoutRow,
});
