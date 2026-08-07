import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { useFormContext, useWatch } from 'react-hook-form';
import type { AgentBuilderEditFormValues } from '../../schemas';

export interface AgentBuilderTitleProps {
  className?: string;
  isLoading?: boolean;
}

export const AgentBuilderTitle = ({ className, isLoading = false }: AgentBuilderTitleProps) => {
  const { control } = useFormContext<AgentBuilderEditFormValues>();
  const name = useWatch({ control, name: 'name' });

  const displayName = name && name.trim() ? name : 'Untitled';

  return (
    <div className={className} data-testid="agent-builder-title">
      <div className="flex min-w-0 items-center gap-2">
        <span className="text-ui-md leading-ui-md block truncate text-white" data-testid="agent-builder-title-name">
          {isLoading ? (
            <Skeleton className="inline-block h-4 w-24 align-middle" data-testid="agent-builder-title-skeleton" />
          ) : (
            displayName
          )}
        </span>
      </div>
    </div>
  );
};
