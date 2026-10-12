import { coreFeatures } from '@mastra/core/features';
import { Button } from '@mastra/playground-ui/components/Button';
import { useLinkComponent } from '@mastra/playground-ui/lib/framework';
import { useMatch } from 'react-router';
import { usePermissions } from '@/domains/auth/hooks/use-permissions';
import { useIsCmsAvailable } from '@/domains/cms/hooks/use-is-cms-available';
import { useHasObservability } from '@/domains/configuration/hooks/use-has-observability';

type AgentView = { view: string; label: string } & (
  | { available: true }
  | { available: false; explanation: string; docsHref: `https://${string}` }
);

/** The sidebar lists agents; the open agent's views switch from a row that stays above the scrolling view. */
export function AgentViewTabs({ agentId }: { agentId: string }) {
  const { Link } = useLinkComponent();
  const { hasPermission } = usePermissions();
  const activeView = useMatch('/agents/:agentId/:view/*')?.params.view;
  const { isCmsAvailable } = useIsCmsAvailable();
  const { hasObservability } = useHasObservability();
  const experimentalFeatures = coreFeatures.has('datasets');
  const canReadTraces = hasObservability && experimentalFeatures && hasPermission('observability:read');
  const base = `/agents/${encodeURIComponent(agentId)}`;

  const views: AgentView[] = [
    { view: 'overview', label: 'Overview', available: true },
    isCmsAvailable && experimentalFeatures
      ? { view: 'editor', label: 'Editor', available: true }
      : {
          view: 'editor',
          label: 'Editor',
          available: false,
          explanation: 'Add @mastra/editor to enable the Editor.',
          docsHref: 'https://mastra.ai/docs/editor/overview',
        },
    ...(canReadTraces ? [{ view: 'metrics', label: 'Metrics', available: true } as const] : []),
    canReadTraces
      ? { view: 'traces', label: 'Traces', available: true }
      : {
          view: 'traces',
          label: 'Traces',
          available: false,
          explanation: 'Add @mastra/observability to enable Traces.',
          docsHref: 'https://mastra.ai/docs/observability/overview',
        },
    ...(experimentalFeatures ? [{ view: 'evals', label: 'Evals', available: true } as const] : []),
  ];

  return (
    <nav aria-label="Agent views" className="flex min-w-0 [scrollbar-width:none] items-center gap-1 overflow-x-auto">
      {views.map(item => {
        if (!item.available) {
          return (
            <Button
              key={item.view}
              variant="ghost"
              size="sm"
              aria-disabled="true"
              tooltip={
                <>
                  {item.explanation}{' '}
                  <a href={item.docsHref} target="_blank" rel="noopener noreferrer" className="underline">
                    Learn more
                  </a>
                </>
              }
            >
              {item.label}
            </Button>
          );
        }
        const isActive = item.view === activeView;
        return (
          <Button
            key={item.view}
            variant={isActive ? 'default' : 'ghost'}
            size="sm"
            aria-current={isActive ? 'page' : undefined}
            render={<Link href={`${base}/${item.view}`} />}
          >
            {item.label}
          </Button>
        );
      })}
    </nav>
  );
}
