import { PageBreadcrumbs, type PageBreadcrumbsProps } from '@mastra/playground-ui/components/PageBreadcrumbs';
import { forwardRef, type AnchorHTMLAttributes } from 'react';
import { Link } from 'react-router';

const RouterLink = forwardRef<HTMLAnchorElement, AnchorHTMLAttributes<HTMLAnchorElement>>(function RouterLink(
  { href = '', ...props },
  ref,
) {
  return <Link ref={ref} to={href} {...props} />;
});

/** Factory breadcrumbs: the shared DS component bound to react-router's `Link`. */
export function FactoryBreadcrumbs(props: Omit<PageBreadcrumbsProps, 'LinkComponent'>) {
  return <PageBreadcrumbs {...props} LinkComponent={RouterLink} />;
}
