import type { GetAgentResponse } from '@mastra/client-js';
import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useLinkComponent } from '@mastra/playground-ui/lib/framework';
import { Workflow } from 'lucide-react';
import { AgentResourceCard, AgentResourceList } from './agent-resource-cards';

/** Steps are shown as a collection: execution order and branches remain in the workflow graph. */
export function AgentWorkflowCards({ workflows }: { workflows: GetAgentResponse['workflows'] }) {
  const { paths } = useLinkComponent();
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
    <AgentResourceList>
      {entries.map(([id, workflow]) => {
        const steps = Object.keys(workflow.allSteps ?? workflow.steps ?? {});
        return (
          <AgentResourceCard
            key={id}
            name={workflow.name || id}
            description={workflow.description}
            href={paths.workflowLink(id)}
          >
            <Txt variant="meta" tone="faint" className="[overflow-wrap:anywhere]">
              {steps.length} {steps.length === 1 ? 'step' : 'steps'}
              {steps.length > 0 && ` · ${steps.join(', ')}`}
            </Txt>
          </AgentResourceCard>
        );
      })}
    </AgentResourceList>
  );
}
