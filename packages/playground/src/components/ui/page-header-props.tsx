import { PageBreadcrumbs } from './page-breadcrumbs';
import { crumbsHeading, type CrumbDef } from '@/domains/navigation/crumbs';

/** `breadcrumbs` + `heading` props for `PageLayout` / `MainContentLayout`, derived from a crumb list. */
export function pageHeaderProps(crumbs: CrumbDef[]) {
  return { breadcrumbs: <PageBreadcrumbs crumbs={crumbs} />, heading: crumbsHeading(crumbs) };
}
