import { Entity, EntityContent, EntityDescription, EntityIcon, EntityName, WorkflowIcon } from '@mastra/playground-ui';

import { useRef } from 'react';
import { Link } from 'react-router';

export interface WorkflowListProps {
  workflows: Array<{ id: string; description: string }>;
  agentId: string;
}

export function WorkflowList({ workflows, agentId }: WorkflowListProps) {
  return (
    <ul className="space-y-2">
      {workflows.map(workflow => (
        <li key={workflow.id}>
          <WorkflowEntity workflowId={workflow.id} description={workflow.description} agentId={agentId} />
        </li>
      ))}
    </ul>
  );
}

interface WorkflowEntityProps {
  workflowId: string;
  description: string;
  agentId: string;
}

const WorkflowEntity = ({ workflowId, description, agentId }: WorkflowEntityProps) => {
  const linkRef = useRef<HTMLAnchorElement>(null);

  return (
    <Entity onClick={() => linkRef.current?.click()} className="flex items-center gap-2">
      <EntityIcon>
        <WorkflowIcon className="group-hover/entity:text-accent3" />
      </EntityIcon>
      <EntityContent>
        <EntityName>
          <Link ref={linkRef} to={`/workflows/${workflowId}/graph?agentId=${agentId}`}>
            {workflowId}
          </Link>
        </EntityName>
        <EntityDescription className="flex items-center justify-between gap-2 w-full">{description}</EntityDescription>
      </EntityContent>
    </Entity>
  );
};
