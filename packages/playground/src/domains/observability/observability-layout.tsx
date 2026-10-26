import { ObservabilityPageLayout, observabilityViewCrumbLabel } from '@mastra/playground-ui/domains/observability';
import type { ObservabilityView } from '@mastra/playground-ui/domains/observability';
import type { ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { PageBreadcrumbs } from '@/components/ui/page-breadcrumbs';
import { navCrumb } from '@/domains/navigation/crumbs';
import { STUDIO_TRACES_FEATURES } from '@/pages/traces/features';

const tracesCrumb = navCrumb('/traces');

function viewFromPathname(pathname: string): ObservabilityView {
  if (pathname.startsWith('/spans')) return 'spans';
  if (pathname.startsWith('/threads')) return 'threads';
  return 'traces';
}

/** The header shared by /traces, /spans and /threads, so switching views keeps it mounted. */
export function ObservabilityLayout({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();

  return (
    <ObservabilityPageLayout
      current={viewFromPathname(pathname)}
      features={STUDIO_TRACES_FEATURES}
      onViewChange={view => navigate(`/${view}`)}
      breadcrumbs={state => {
        const label = observabilityViewCrumbLabel(state);
        return <PageBreadcrumbs crumbs={label ? [tracesCrumb, { id: state.current, label }] : [tracesCrumb]} />;
      }}
    >
      {children}
    </ObservabilityPageLayout>
  );
}
