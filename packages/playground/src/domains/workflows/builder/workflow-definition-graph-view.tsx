import { Badge } from '@mastra/playground-ui/components/Badge';
import { Card, CardContent } from '@mastra/playground-ui/components/Card';

import { createWorkflowDefinitionGraph } from './workflow-definition-graph';
import type { WorkflowDraft } from './workflow-draft';

export interface WorkflowDefinitionGraphViewProps {
  draft: WorkflowDraft;
}

export function WorkflowDefinitionGraphView({ draft }: WorkflowDefinitionGraphViewProps) {
  const graph = createWorkflowDefinitionGraph(draft);
  const topLevelNodes = graph.nodes.filter(node => !node.parentId);

  if (topLevelNodes.length === 0) {
    return (
      <div className="grid min-h-48 place-items-center rounded-lg border border-dashed border-border1 bg-surface2 text-ui-sm text-neutral3">
        Describe your workflow to add its first step.
      </div>
    );
  }

  return (
    <div className="flex min-w-max items-start gap-8 p-6" data-testid="workflow-definition-graph">
      {topLevelNodes.map((node, index) => {
        const children = graph.nodes.filter(candidate => candidate.parentId === node.id);
        return (
          <div key={node.id} className="flex items-center gap-8">
            <Card className="w-56 bg-surface3">
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="truncate text-ui-sm font-medium text-neutral6">{node.label}</span>
                  <Badge size="xs">{node.type}</Badge>
                </div>
                {node.detail ? <p className="truncate text-ui-xs text-neutral3">{node.detail}</p> : null}
                {children.length > 0 ? (
                  <div className="space-y-2 border-l border-border2 pl-3">
                    {children.map(child => (
                      <div key={child.id} className="rounded-md border border-border1 bg-surface2 p-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-ui-xs font-medium text-neutral5">{child.label}</span>
                          <Badge size="xs">{child.type}</Badge>
                        </div>
                        {child.detail ? <p className="mt-1 truncate text-ui-xs text-neutral3">{child.detail}</p> : null}
                      </div>
                    ))}
                  </div>
                ) : null}
              </CardContent>
            </Card>
            {index < topLevelNodes.length - 1 ? <div className="h-px w-8 bg-border2" aria-hidden="true" /> : null}
          </div>
        );
      })}
    </div>
  );
}
