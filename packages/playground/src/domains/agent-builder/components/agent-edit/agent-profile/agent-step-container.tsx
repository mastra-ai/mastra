import { cn } from '@mastra/playground-ui';
import type { ReactNode } from 'react';
import { useFormState } from 'react-hook-form';
import { useAgentColor } from '@/domains/agent-builder/contexts/agent-color-context';

export interface AgentStepContainerProps {
  children: React.ReactNode;
  cta: ReactNode;
  title?: ReactNode;
  description?: ReactNode;
}

export const AgentStepContainer = ({ children, cta, title, description }: AgentStepContainerProps) => {
  const agentColor = useAgentColor();
  const formState = useFormState();
  const bannerStyle = agentColor
    ? {
        backgroundImage: `linear-gradient(to bottom right, ${agentColor.background}, ${agentColor.foreground})`,
      }
    : undefined;

  const isDirty = formState.dirtyFields.name;

  return (
    <div className="relative w-full h-full border border-border1 rounded-3xl overflow-hidden overflow-y-auto p-4">
      <div
        aria-hidden
        className="absolute inset-0 transition-all duration-500 ease-out pointer-events-none"
        style={{ ...bannerStyle, opacity: isDirty ? 1 : 0 }}
      />
      <div
        className={cn(
          'relative h-full overflow-y-auto bg-surface3 rounded-2xl grid ',
          title ? 'grid-rows-[auto_1fr_auto]' : 'grid-rows-[1fr_auto]',
        )}
      >
        {title && (
          <div className="px-6 pt-6 pb-4">
            <h2 className="text-3xl font-semibold text-neutral6 pb-1">{title}</h2>
            {description && <p className="text-neutral3">{description}</p>}
          </div>
        )}
        <div className="h-full overflow-y-auto">{children}</div>
        <div className="flex justify-center items-center shrink-0 pb-6">{cta}</div>
      </div>
    </div>
  );
};
