import type { GetWorkflowResponse } from '@mastra/client-js';
import { Button } from '@mastra/playground-ui/components/Button';
import { Sidebar } from '@mastra/playground-ui/components/Sidebar';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { WorkflowIcon } from '@mastra/playground-ui/icons/WorkflowIcon';
import { useState } from 'react';
import { useRecentWorkflowIds } from '../hooks/use-recent-workflow-ids';

export function RecentWorkflows({
  workflowId,
  workflows,
}: {
  workflowId: string;
  workflows: Record<string, GetWorkflowResponse>;
}) {
  const ids = useRecentWorkflowIds(workflowId);
  const [expanded, setExpanded] = useState(false);
  const accessibleIds = ids.filter(id => workflows[id]);
  const visibleIds = expanded ? accessibleIds : accessibleIds.slice(0, 3);
  return (
    <nav aria-label="Recent workflows">
      <Txt as="h2" variant="meta" tone="muted" className="px-3 pb-2">
        Recent workflows
      </Txt>
      <Sidebar.NavList>
        {visibleIds.map(id => (
          <Sidebar.NavLink
            key={id}
            state="default"
            link={{
              name: workflows[id].name ?? id,
              url: `/workflows/${encodeURIComponent(id)}/graph`,
              icon: <WorkflowIcon />,
            }}
            isActive={id === workflowId}
          />
        ))}
      </Sidebar.NavList>
      {accessibleIds.length > 3 && (
        <Button variant="ghost" size="sm" aria-expanded={expanded} onClick={() => setExpanded(value => !value)}>
          {expanded ? 'Show less' : 'Show more'}
        </Button>
      )}
    </nav>
  );
}
