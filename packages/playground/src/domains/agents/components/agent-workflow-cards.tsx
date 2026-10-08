import type { GetAgentResponse } from '@mastra/client-js';
import { Badge } from '@mastra/playground-ui/components/Badge';
import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useLinkComponent } from '@mastra/playground-ui/lib/framework';
import { ArrowUpRight, Component, Workflow } from 'lucide-react';

/** Steps are shown as a collection: execution order and branches remain in the workflow graph. */
export function AgentWorkflowCards({ workflows }: { workflows: GetAgentResponse['workflows'] }) {
  const { Link, paths } = useLinkComponent();
  const entries = Object.entries(workflows ?? {});
  if (!entries.length)
    return (
      <EmptyState
        iconSlot={<Workflow />}
        titleSlot="No attached workflows"
        descriptionSlot="Workflows made available to this agent will appear here."
      />
    );
  return (
    <div className="grid gap-4 @2xl:grid-cols-2">
      {entries.map(([id, workflow]) => {
        const steps = Object.entries(workflow.allSteps ?? workflow.steps ?? {});
        return (
          <Link
            key={id}
            href={paths.workflowLink(id)}
            aria-label={`Open workflow ${workflow.name || id}`}
            className="group flex min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-card transition-colors hover:border-border-focus focus-visible:outline focus-visible:outline-2 focus-visible:outline-border-focus"
          >
            <div className="flex min-w-0 items-start gap-3 p-4">
              <span className="bg-accent flex size-10 shrink-0 items-center justify-center rounded-xl">
                <Workflow className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <Txt as="h3" variant="subheading" className="break-words">
                  {workflow.name || id}
                </Txt>
                <Txt variant="meta" tone="muted">
                  {steps.length} {steps.length === 1 ? 'step' : 'steps'}
                </Txt>
              </div>
              <ArrowUpRight className="size-4 shrink-0 text-muted-foreground" />
            </div>
            {workflow.description && (
              <Txt tone="muted" className="px-4 pb-4">
                {workflow.description}
              </Txt>
            )}
            <div className="mt-auto grid gap-3 border-t border-border bg-muted/20 p-4">
              <div className="flex flex-wrap gap-2">
                {steps.slice(0, 4).map(([stepId]) => (
                  <Badge key={stepId} className="max-w-full gap-1.5 rounded-lg px-2 py-1">
                    <Component className="size-3 shrink-0" />
                    <span className="truncate">{stepId}</span>
                  </Badge>
                ))}
                {steps.length > 4 && <Badge>+{steps.length - 4} more</Badge>}
              </div>
              <Txt variant="meta" tone="muted">
                View graph, run workflow and inspect history
              </Txt>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
