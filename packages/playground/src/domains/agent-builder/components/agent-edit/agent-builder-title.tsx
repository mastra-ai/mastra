import { CrumbSkeleton } from '@mastra/playground-ui/components/Breadcrumb';
import { useFormContext, useWatch } from 'react-hook-form';
import type { AgentBuilderEditFormValues } from '../../schemas';

export interface AgentBuilderTitleProps {
  isLoading?: boolean;
}

/** Current-crumb label for the agent builder; rendered inside a `Crumb`. */
export const AgentBuilderTitle = ({ isLoading = false }: AgentBuilderTitleProps) => {
  const { control } = useFormContext<AgentBuilderEditFormValues>();
  const name = useWatch({ control, name: 'name' });

  if (isLoading) return <CrumbSkeleton data-testid="agent-builder-title-skeleton" />;

  return <span data-testid="agent-builder-title-name">{name && name.trim() ? name : 'Untitled'}</span>;
};
