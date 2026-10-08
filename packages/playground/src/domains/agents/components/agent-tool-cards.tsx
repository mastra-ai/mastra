import type { GetToolResponse } from '@mastra/client-js';
import { Button } from '@mastra/playground-ui/components/Button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@mastra/playground-ui/components/Collapsible';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useLinkComponent } from '@mastra/playground-ui/lib/framework';
import { ArrowUpRight, ChevronRight, Wrench } from 'lucide-react';
import { useLocation } from 'react-router';
import { ToolOverview } from '@/domains/tools/components/tool-overview';
import { parseToolSchema } from '@/domains/tools/utils/parse-tool-schema';

/** Inspect in the agent context: not all attached tools exist in the global tools catalog. */
export function AgentToolCards({ tools }: { tools: GetToolResponse[] }) {
  const { Link } = useLinkComponent();
  const location = useLocation();
  if (!tools.length) return <Txt tone="muted">No tools attached to this agent.</Txt>;
  return (
    <div className="grid min-w-0 gap-3 @3xl:grid-cols-2">
      {tools.map(tool => {
        const params = new URLSearchParams(location.search);
        params.set('tool', tool.id);
        return (
          <article key={tool.id} className="flex min-w-0 flex-col gap-3 rounded-xl border border-border p-4">
            <div className="flex min-w-0 items-start gap-2">
              <Wrench className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <Txt as="h4" variant="subheading" className="[overflow-wrap:anywhere]">
                {tool.id}
              </Txt>
            </div>
            <Txt tone="muted" className="[overflow-wrap:anywhere]">
              {tool.description || 'No description provided.'}
            </Txt>
            <Collapsible className="min-w-0 rounded-lg bg-muted/30">
              <CollapsibleTrigger className="text-ui-sm flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left">
                <ChevronRight className="size-3 shrink-0" />
                Input & output schemas
              </CollapsibleTrigger>
              <CollapsibleContent className="min-w-0 p-3 pt-1">
                <ToolOverview
                  inputSchema={parseToolSchema(tool.inputSchema)}
                  outputSchema={parseToolSchema(tool.outputSchema)}
                  requestContextSchema={parseToolSchema(tool.requestContextSchema)}
                />
              </CollapsibleContent>
            </Collapsible>
            <Button
              variant="ghost"
              size="sm"
              className="mt-auto self-start"
              aria-label={`Inspect and test ${tool.id}`}
              render={<Link href={`${location.pathname}?${params}${location.hash}`} />}
              icon={<ArrowUpRight />}
            >
              Inspect and test
            </Button>
          </article>
        );
      })}
    </div>
  );
}
