import { PageHeaderAction } from './page-header-action';
import { PageHeaderDescription } from './page-header-description';
import { PageHeaderEyebrow } from './page-header-eyebrow';
import { PageHeaderIcon } from './page-header-icon';
import { PageHeaderMeta } from './page-header-meta';
import { PageHeaderRoot } from './page-header-root';
import { PageHeaderTitle } from './page-header-title';

export type { PageHeaderActionProps } from './page-header-action';
export type { PageHeaderDescriptionProps } from './page-header-description';
export type { PageHeaderEyebrowProps } from './page-header-eyebrow';
export type { PageHeaderIconProps } from './page-header-icon';
export type { PageHeaderMetaProps } from './page-header-meta';
export type { PageHeaderRootProps } from './page-header-root';
export type { PageHeaderTitleProps, PageHeaderTitleSize } from './page-header-title';

export const PageHeader = Object.assign(PageHeaderRoot, {
  Eyebrow: PageHeaderEyebrow,
  Icon: PageHeaderIcon,
  Title: PageHeaderTitle,
  Meta: PageHeaderMeta,
  Description: PageHeaderDescription,
  Action: PageHeaderAction,
});
