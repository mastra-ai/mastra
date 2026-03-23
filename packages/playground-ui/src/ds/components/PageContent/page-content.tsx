import { PageContentMain } from './page-content-main';
import { PageContentRoot } from './page-content-root';
import { PageContentTopBar } from './page-content-top-bar';

export const PageContent = Object.assign(PageContentRoot, {
  TopBar: PageContentTopBar,
  Main: PageContentMain,
});
