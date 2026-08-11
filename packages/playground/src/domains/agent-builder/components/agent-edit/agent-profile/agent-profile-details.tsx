import { cn } from '@mastra/playground-ui/utils/cn';
import { useFormContext, useWatch } from 'react-hook-form';
import type { AgentBuilderEditFormValues } from '../../../schemas';

export interface AgentProfileDetailsProps {
  disabled?: boolean;
  className?: string;
  mode?: 'default' | 'highlighted';
}

const HIGHLIGHTED_CLASSNAME =
  'px-24 justify-center items-center text-center [&_input]:text-center [&_textarea]:text-center';

export const AgentProfileDetails = ({ disabled = false, className, mode = 'default' }: AgentProfileDetailsProps) => {
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

  const isHighlighted = mode === 'highlighted';

  return (
    <div
      className={cn(
        'flex w-full flex-col items-start gap-0.5 max-w-[44ch]',
        isHighlighted && HIGHLIGHTED_CLASSNAME,
        className,
      )}
    >
      <input
        type="text"
        value={draftName}
        onChange={e => handleDraftNameChange(e.target.value)}
        placeholder="Untitled agent"
        aria-label="Agent name"
        disabled={disabled}
        data-testid="agent-configure-name"
        className="text-ui-lg text-neutral6 placeholder:text-neutral2 hover:bg-surface4 focus:bg-surface4 w-full max-w-sm rounded-lg px-3 py-1.5 font-semibold focus:outline-none disabled:cursor-not-allowed"
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
        className="text-ui-md text-neutral6 placeholder:text-neutral2 hover:bg-surface4 focus:bg-surface4 field-sizing-content w-full resize-none rounded-lg px-3 py-2 focus:outline-none disabled:cursor-not-allowed"
        style={{ viewTransitionName: 'agent-description' }}
      />
    </div>
  );
};
