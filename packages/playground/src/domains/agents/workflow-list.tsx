import { Entity, EntityContent, EntityDescription, EntityIcon, EntityName, WorkflowIcon } from '@mastra/playground-ui';
import { useRef } from 'react';
import { Link } from 'react-router';

export interface WorkflowListProps {
  workflows: Array<{ id: string; description: string }>;
}

export function WorkflowList({ workflows }: WorkflowListProps) {
  return (
    <ul className="space-y-2">
      {workflows.map(workflow => (
        <li key={workflow.id}>
          <WorkflowEntity workflow={workflow} />
        </li>
      ))}
    </ul>
  );
}

interface WorkflowEntityProps {
  workflow: { id: string; description: string };
}

const WorkflowEntity = ({ workflow }: WorkflowEntityProps) => {
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
