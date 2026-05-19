import { cn } from '@mastra/playground-ui';
import { useFormContext, useWatch } from 'react-hook-form';
import type { AgentBuilderEditFormValues } from '../../../schemas';

export interface AgentProfileDetailsProps {
  disabled?: boolean;
  className?: string;
}

export const AgentProfileDetails = ({ disabled = false, className }: AgentProfileDetailsProps) => {
  const { setValue, control } = useFormContext<AgentBuilderEditFormValues>();
  const draftName = useWatch({ control, name: 'name' }) ?? '';
  const draftDescription = useWatch({ control, name: 'description' }) ?? '';

  const handleDraftNameChange = (value: string) => {
    if (disabled) return;
    setValue('name', value, { shouldDirty: true });
  };
  const handleDraftDescriptionChange = (value: string) => {
    if (disabled) return;
    setValue('description', value, { shouldDirty: true });
  };

  return (
    <div className={cn('flex w-full flex-col items-start gap-0.5', className)}>
      <input
        type="text"
        value={draftName}
        onChange={e => handleDraftNameChange(e.target.value)}
        placeholder="Untitled agent"
        aria-label="Agent name"
        disabled={disabled}
        data-testid="agent-configure-name"
        className="w-full max-w-sm rounded-lg bg-transparent px-3 py-1.5 text-ui-lg font-semibold text-neutral6 placeholder:text-neutral2 hover:bg-surface4 focus:bg-surface4 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
        style={{ viewTransitionName: 'agent-name' }}
      />
      <textarea
        value={draftDescription}
        onChange={e => handleDraftDescriptionChange(e.target.value)}
        placeholder="What is this agent for?"
        aria-label="Description"
        disabled={disabled}
        data-testid="agent-configure-description"
        rows={2}
        className="w-full resize-none rounded-lg bg-transparent px-3 py-2 text-ui-md text-neutral6 placeholder:text-neutral2 hover:bg-surface4 focus:bg-surface4 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
        style={{ viewTransitionName: 'agent-description' }}
      />
    </div>
  );
};
