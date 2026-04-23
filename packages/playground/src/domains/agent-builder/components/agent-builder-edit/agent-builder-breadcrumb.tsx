import { Breadcrumb, Crumb, Skeleton } from '@mastra/playground-ui';
import { useFormContext, useWatch } from 'react-hook-form';
import { Link } from 'react-router';
import type { AgentBuilderEditFormValues } from '../../schemas';

export interface AgentBuilderBreadcrumbProps {
  className?: string;
  isLoading?: boolean;
}

export const AgentBuilderBreadcrumb = ({ className, isLoading = false }: AgentBuilderBreadcrumbProps) => {
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
          {isLoading ? (
            <Skeleton className="inline-block h-4 w-24 align-middle" data-testid="agent-builder-breadcrumb-skeleton" />
          ) : (
            displayName
          )}
        </Crumb>
      </Breadcrumb>
    </div>
  );
};
