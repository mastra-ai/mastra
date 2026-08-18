import type { RouteObject } from 'react-router';
import { Outlet } from 'react-router';
import { useEnabledDomains } from './StudioPortalShell';
import type { StudioDomain } from './context';

// Real playground pages
import Agents from '@/pages/agents';
import Agent from '@/pages/agents/agent';
import AgentPlayground from '@/pages/agents/agent-playground';
import AgentTraces from '@/pages/agents/agent-traces';
import Workflows from '@/pages/workflows';
import { Workflow } from '@/pages/workflows/workflow';
import Traces from '@/pages/traces';
import TraceDetails from '@/pages/traces/trace';
import Scorers from '@/pages/scorers';
import Scorer from '@/pages/scorers/scorer';

// Layouts that pair with these pages (Studio's own chrome)
import { AgentLayout } from '@/domains/agents/agent-layout';
import { WorkflowLayout } from '@/domains/workflows/workflow-layout';
import { PortalRootLayout } from './PortalRootLayout';

/**
 * Domain catalogue — pairs manifest metadata with the real playground routes
 * that render it. When Studio ships a new domain, add an entry here and its
 * real Page components; the manifest export is derived from this list.
 */
type PortalDomain = {
  descriptor: StudioDomain;
  navPath: string;
  routes: RouteObject[];
};

const ALL_DOMAINS: PortalDomain[] = [
  {
    descriptor: { id: 'agents', label: 'Agents', stability: 'stable' },
    navPath: '/agents',
    routes: [
      { path: 'agents', element: <Agents /> },
      {
        path: 'agents/:agentId',
        element: <AgentLayout><Outlet /></AgentLayout>,
        children: [
          { index: true, element: <Agent /> },
          { path: 'chat/:threadId?', element: <AgentPlayground /> },
          { path: 'traces', element: <AgentTraces /> },
        ],
      },
    ],
  },
  {
    descriptor: { id: 'workflows', label: 'Workflows', stability: 'stable' },
    navPath: '/workflows',
    routes: [
      { path: 'workflows', element: <Workflows /> },
      {
        path: 'workflows/:workflowId',
        element: <WorkflowLayout><Outlet /></WorkflowLayout>,
        children: [
          { index: true, element: <Workflow /> },
          { path: 'graph', element: <Workflow /> },
          { path: 'graph/:runId', element: <Workflow /> },
        ],
      },
    ],
  },
  {
    descriptor: { id: 'chat', label: 'Chat', stability: 'beta' },
    navPath: '/agents',
    // Chat isn't its own page — it's a tab inside an agent. Reuse Agents index
    // as the entry until we ship a real "all chats" surface.
    routes: [],
  },
  {
    descriptor: { id: 'traces', label: 'Traces', stability: 'stable' },
    navPath: '/traces',
    routes: [
      { path: 'traces', element: <Traces /> },
      { path: 'traces/:traceId', element: <TraceDetails /> },
    ],
  },
  {
    descriptor: { id: 'scorers', label: 'Scorers', stability: 'experimental' },
    navPath: '/scorers',
    routes: [
      { path: 'scorers', element: <Scorers /> },
      { path: 'scorers/:scorerId', element: <Scorer /> },
    ],
  },
];

/** Manifest of every domain this bundle can render. */
export const bundleDomains: StudioDomain[] = ALL_DOMAINS.map((d) => d.descriptor);

function DomainNotEnabled({ label }: { label: string }) {
  return (
    <div className="studio-portal-scope p-6 text-neutral6">
      <p className="text-ui-sm text-neutral3">
        <strong>{label}</strong> is not enabled for this project. Platform has not opted into this
        domain yet.
      </p>
    </div>
  );
}

function StudioLanding() {
  const enabled = useEnabledDomains();
  const first = ALL_DOMAINS.find((d) => enabled[d.descriptor.id] && d.routes.length > 0);
  return (
    <div className="studio-portal-scope p-6 text-neutral6">
      <p className="text-ui-sm text-neutral3">
        <strong>Studio landing.</strong> Enabled: [{Object.entries(enabled).filter(([, v]) => v).map(([k]) => k).join(', ') || 'none'}]. First: {first?.descriptor.label ?? 'none'}.
      </p>
    </div>
  );
}

/**
 * Build the route tree given Platform's opt-in map. Disabled domains render
 * a "not enabled" placeholder instead of a blank 404 — makes it obvious when
 * Platform hasn't opted in vs. when something is broken.
 */
export function buildPortalRoutes(enabled: Record<string, boolean>): RouteObject[] {
  const children: RouteObject[] = [{ index: true, element: <StudioLanding /> }];

  for (const domain of ALL_DOMAINS) {
    for (const route of domain.routes) {
      children.push(
        enabled[domain.descriptor.id]
          ? route
          : { ...route, element: <DomainNotEnabled label={domain.descriptor.label} /> },
      );
    }
  }

  // eslint-disable-next-line no-console
  console.log('[studio-portal] buildPortalRoutes', {
    enabled,
    childPaths: children.map((c) => (c as { path?: string; index?: boolean }).path ?? (c.index ? '(index)' : '(none)')),
  });

  return [
    {
      element: <PortalRootLayout />,
      children,
    },
  ];
}
