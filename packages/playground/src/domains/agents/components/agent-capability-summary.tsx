import type { GetAgentResponse } from '@mastra/client-js';
import { Button } from '@mastra/playground-ui/components/Button';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useLinkComponent } from '@mastra/playground-ui/lib/framework';
import { ArrowUpRight, Wrench } from 'lucide-react';
import { useLocation } from 'react-router';
import { AgentResourceCard } from './agent-resource-cards';

/** A readable capability summary; the complete schemas and inspector live in Configuration. */
export function AgentCapabilitySummary({ agent }: { agent: GetAgentResponse }) {
  const { Link } = useLinkComponent();
  const { search } = useLocation();
  const tools = Object.values(agent.tools ?? {});
  const configurationPath = `/agents/${encodeURIComponent(agent.id)}/configuration`;

  return (
    <section aria-label="Attached tools" className="grid min-w-0 gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Txt as="h2" variant="heading" className="flex items-center gap-2">
          <Wrench className="size-4 text-muted-foreground" />
          Tools
        </Txt>
        <Button
          variant="ghost"
          size="sm"
          icon={<ArrowUpRight />}
          render={<Link href={`${configurationPath}${search}#tools`} />}
        >
          View configuration
        </Button>
      </div>
      {tools.length ? (
        <div className="grid min-w-0 gap-3 @2xl:grid-cols-2 @4xl:grid-cols-3">
          {tools.slice(0, 6).map(tool => {
            const params = new URLSearchParams(search);
            params.set('tool', tool.id);
            return (
              <AgentResourceCard
                key={tool.id}
                name={tool.id}
                description={tool.description}
                href={`${configurationPath}?${params}#tools`}
              />
            );
          })}
        </div>
      ) : (
        <Txt tone="muted">No tools attached to this agent.</Txt>
      )}
      {tools.length > 6 && (
        <Link
          href={`${configurationPath}${search}#tools`}
          className="text-ui-sm w-fit text-muted-foreground hover:underline"
        >
          View all {tools.length} tools
        </Link>
      )}
    </section>
  );
}
