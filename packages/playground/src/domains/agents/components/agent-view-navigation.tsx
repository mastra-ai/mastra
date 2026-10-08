import { coreFeatures } from '@mastra/core/features';
import { Sidebar } from '@mastra/playground-ui/components/Sidebar';
import { TraceIcon } from '@mastra/playground-ui/icons/TraceIcon';
import { GitBranch, LayoutDashboard, ChartNoAxesCombined } from 'lucide-react';
import { useMatch } from 'react-router';
import { ContextualSidebarSection } from '@/components/ui/contextual-sidebar-section';
import { UnavailableNavigationItem } from '@/components/ui/unavailable-navigation-item';
import { usePermissions } from '@/domains/auth/hooks/use-permissions';
import { useIsCmsAvailable } from '@/domains/cms/hooks/use-is-cms-available';
import { useHasObservability } from '@/domains/configuration/hooks/use-has-observability';

/** Agent-scoped routes and their availability belong to the contextual navigation. */
export function AgentViewNavigation({ agentId }: { agentId: string }) {
  const { hasPermission } = usePermissions();
  const match = useMatch('/agents/:agentId/:view/*');
  const { isCmsAvailable } = useIsCmsAvailable();
  const { hasObservability } = useHasObservability();
  const experimentalFeatures = coreFeatures.has('datasets');
  const showEditor = isCmsAvailable && experimentalFeatures;
  const showTraces = hasObservability && experimentalFeatures && hasPermission('observability:read');
  const base = `/agents/${encodeURIComponent(agentId)}`;
  const view = match?.params.view;

  return (
    <nav aria-label="Agent views" className="shrink-0 border-b border-border">
      <ContextualSidebarSection>
        <Sidebar.NavList>
          <Sidebar.NavLink
            state="default"
            link={{ name: 'Overview', url: `${base}/overview`, icon: <LayoutDashboard /> }}
            isActive={view === 'overview'}
          />
          {showEditor ? (
            <Sidebar.NavLink
              state="default"
              link={{ name: 'Editor', url: `${base}/editor`, icon: <GitBranch /> }}
              isActive={view === 'editor'}
            />
          ) : (
            <UnavailableNavigationItem
              icon={<GitBranch />}
              label="Editor"
              explanation="Add @mastra/editor to enable the Editor."
              docsHref="https://mastra.ai/docs/editor/overview"
            />
          )}
          {showTraces && (
            <Sidebar.NavLink
              state="default"
              link={{ name: 'Metrics', url: `${base}/metrics`, icon: <ChartNoAxesCombined /> }}
              isActive={view === 'metrics'}
            />
          )}
          {showTraces ? (
            <Sidebar.NavLink
              state="default"
              link={{ name: 'Traces', url: `${base}/traces`, icon: <TraceIcon /> }}
              isActive={view === 'traces'}
            />
          ) : (
            <UnavailableNavigationItem
              icon={<TraceIcon />}
              label="Traces"
              explanation="Add @mastra/observability to enable Traces."
              docsHref="https://mastra.ai/docs/observability/overview"
            />
          )}
        </Sidebar.NavList>
      </ContextualSidebarSection>
    </nav>
  );
}
