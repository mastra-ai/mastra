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
          <WorkflowEntity workflow={workflow} agentId={agentId} />
        </li>
      ))}
    </ul>
  );
}

interface WorkflowEntityProps {
  workflow: { id: string; description: string };
  agentId: string;
}

const WorkflowEntity = ({ workflow, agentId }: WorkflowEntityProps) => {
  const linkRef = useRef<HTMLAnchorElement>(null);
  return (
    <Entity onClick={() => linkRef.current?.click()}>
      <EntityIcon>
        <WorkflowIcon className="group-hover/entity:text-accent3" />
      </EntityIcon>
      <EntityContent>
        <EntityName>
          <Link ref={linkRef} to={`/workflows/${workflow.id}/graph`}>
            {workflow.id}
          </Link>
        </EntityName>
        <EntityDescription>{workflow.description}</EntityDescription>
      </EntityContent>
    </Entity>
  );
};
