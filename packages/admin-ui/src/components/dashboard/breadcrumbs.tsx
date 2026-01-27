import { Link, useLocation, useParams } from 'react-router';
import { ChevronRight, Home } from 'lucide-react';
import { useCurrentTeam } from '@/hooks/use-current-team';
import { useProject } from '@/hooks/projects/use-project';
import { cn } from '@/lib/utils';

interface BreadcrumbItem {
  label: string;
  href?: string;
}

export function Breadcrumbs() {
  const location = useLocation();
  const params = useParams<{ teamId?: string; projectId?: string; deploymentId?: string; buildId?: string }>();
  const { currentTeam } = useCurrentTeam();
  const { data: project } = useProject(params.projectId ?? '');

  const breadcrumbs = getBreadcrumbs(location.pathname, {
    teamId: params.teamId,
    teamName: currentTeam?.name,
    projectId: params.projectId,
    projectName: project?.name,
    deploymentId: params.deploymentId,
    buildId: params.buildId,
  });

  if (breadcrumbs.length <= 1) {
    return null;
  }

  return (
    <nav className="flex items-center gap-1 text-sm text-neutral6 mb-4">
      <Link to="/" className="p-1 hover:text-neutral9 hover:bg-surface3 rounded">
        <Home className="h-4 w-4" />
      </Link>
      {breadcrumbs.map((crumb, index) => {
        const isLast = index === breadcrumbs.length - 1;
        return (
          <div key={crumb.label} className="flex items-center gap-1">
            <ChevronRight className="h-4 w-4" />
            {crumb.href && !isLast ? (
              <Link to={crumb.href} className="hover:text-neutral9 hover:underline">
                {crumb.label}
              </Link>
            ) : (
              <span className={cn(isLast && 'text-neutral9')}>{crumb.label}</span>
            )}
          </div>
        );
      })}
    </nav>
  );
}

interface BreadcrumbContext {
  teamId?: string;
  teamName?: string;
  projectId?: string;
  projectName?: string;
  deploymentId?: string;
  buildId?: string;
}

function getBreadcrumbs(pathname: string, context: BreadcrumbContext): BreadcrumbItem[] {
  const segments = pathname.split('/').filter(Boolean);
  const breadcrumbs: BreadcrumbItem[] = [];

  let currentPath = '';

  let deploymentPath = '';

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    currentPath += `/${segment}`;

    // Handle dynamic segments
    if (segment === context.teamId && context.teamName) {
      breadcrumbs.push({ label: context.teamName, href: currentPath });
    } else if (segment === context.projectId && context.projectName) {
      breadcrumbs.push({ label: context.projectName, href: currentPath });
    } else if (segment === context.deploymentId) {
      deploymentPath = currentPath;
      breadcrumbs.push({ label: `Deployment ${segment.slice(0, 8)}...`, href: currentPath });
    } else if (segment === context.buildId) {
      breadcrumbs.push({ label: `Build ${segment.slice(0, 8)}...`, href: currentPath });
    } else if (segment === 'builds' && deploymentPath) {
      // "Builds" links back to the deployment page since builds are shown there
      breadcrumbs.push({ label: 'Builds', href: deploymentPath });
    } else {
      // Standard route segments
      const label = getSegmentLabel(segment);
      if (label) {
        breadcrumbs.push({ label, href: currentPath });
      }
    }
  }

  return breadcrumbs;
}

function getSegmentLabel(segment: string): string | null {
  const labels: Record<string, string> = {
    teams: 'Teams',
    projects: 'Projects',
    deployments: 'Deployments',
    builds: 'Builds',
    settings: 'Settings',
    members: 'Members',
    observability: 'Observability',
    traces: 'Traces',
    logs: 'Logs',
    metrics: 'Metrics',
    'env-vars': 'Environment Variables',
    new: 'New',
  };

  return labels[segment] ?? null;
}
