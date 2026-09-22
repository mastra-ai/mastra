import { PageBreadcrumbs as DsPageBreadcrumbs } from '@mastra/playground-ui/components/PageBreadcrumbs';
import type { PageBreadcrumbsProps as DsPageBreadcrumbsProps } from '@mastra/playground-ui/components/PageBreadcrumbs';
import { Link } from '@/lib/link';

export type PageBreadcrumbsProps = Omit<DsPageBreadcrumbsProps, 'LinkComponent'>;

/** Studio breadcrumbs: the shared DS component bound to the app's router-aware `Link`. */
export function PageBreadcrumbs(props: PageBreadcrumbsProps) {
  return <DsPageBreadcrumbs {...props} LinkComponent={Link} />;
}
