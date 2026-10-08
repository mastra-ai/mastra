import type { CrumbDef } from '@/domains/navigation/crumbs';

export function BreadcrumbLabel({ crumb }: { crumb: CrumbDef }) {
  if ('Component' in crumb && crumb.Component) {
    const Component = crumb.Component;
    return <Component />;
  }
  return 'node' in crumb ? crumb.node : crumb.label;
}
