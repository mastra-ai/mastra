import { Breadcrumb, Crumb } from '@mastra/playground-ui';
import { useFormContext, useWatch } from 'react-hook-form';
import { Link } from 'react-router';
import type { AgentBuilderEditFormValues } from '../../schemas';

export interface AgentBuilderBreadcrumbProps {
  className?: string;
}

export const AgentBuilderBreadcrumb = ({ className }: AgentBuilderBreadcrumbProps) => {
  const { control } = useFormContext<AgentBuilderEditFormValues>();
  const name = useWatch({ control, name: 'name' });
  const displayName = name && name.trim() ? name : 'Untitled';

  return (
    <div className={className} data-testid="agent-builder-breadcrumb">
      <Breadcrumb label="Agent builder">
        <Crumb as={Link} to="/agent-builder/agents">
          Agents
        </Crumb>
        <Crumb as="span" isCurrent>
          {displayName}
        </Crumb>
      </Breadcrumb>
    </div>
  );
};
