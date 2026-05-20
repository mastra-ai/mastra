import { PageHeaderDescription } from './page-header-description';
import { PageHeaderRoot } from './page-header-root';
import { PageHeaderTitle } from './page-header-title';

export { type PageHeaderRootProps } from './page-header-root';
export { type PageHeaderTitleProps } from './page-header-title';
export { type PageHeaderDescriptionProps } from './page-header-description';

export const PageHeader = Object.assign(PageHeaderRoot, {
  Title: PageHeaderTitle,
  Description: PageHeaderDescription,
});
