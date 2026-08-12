import { getStatusIcon } from './shared';
import type { ProcessStep } from './shared';
import { transitions } from '@/ds/primitives/transitions';
import { cn } from '@/lib/utils';

type ProcessStepListItemVariant = 'default' | 'plain';

export type ProcessStepListItemProps = {
  stepId: string;
  step: ProcessStep;
  isActive: boolean;
  position: number;
  variant?: ProcessStepListItemVariant;
};

function formatStepTitle(stepId: string): string {
  return stepId.charAt(0).toUpperCase() + stepId.slice(1).replace(/-/g, ' ');
}

export function ProcessStepListItem({
  stepId,
  step,
  isActive,
  position,
  variant = 'default',
}: ProcessStepListItemProps) {
  return (
    <div
      className={cn(
        'grid grid-cols-[1fr_auto] gap-6 rounded-lg px-4 py-3 motion-reduce:transition-none',
        transitions.colors,
        {
          'border border-transparent': variant === 'default',
          'border-dashed border-neutral2 bg-surface3': isActive && variant === 'default',
        },
      )}
    >
      <div className="grid min-w-0 grid-cols-[auto_1fr] gap-2">
        <span
          className={cn('flex min-w-6 justify-end text-ui-md', transitions.colors, {
            'text-neutral5': isActive || step.status === 'success',
            'text-neutral3': !isActive && step.status !== 'success',
          })}
        >
          {position}.
        </span>
        <div className="min-w-0">
          <h4
            className={cn('text-ui-md', transitions.colors, {
              'text-neutral5': isActive || step.status === 'success',
              'text-neutral3': !isActive && step.status !== 'success',
            })}
          >
            {formatStepTitle(stepId)}
          </h4>
          {step.description && (
            <p className={cn('-mt-0.5 text-ui-md text-neutral2', { truncate: variant === 'plain' })}>
              {step.description}
            </p>
          )}
        </div>
      </div>
      <div
        className={cn(
          'flex size-7 items-center justify-center self-center rounded-full motion-reduce:transition-none',
          transitions.colors,
          transitions.transform,
          transitions.shadow,
          {
            'border border-dashed border-neutral2': step.status === 'pending',
            '[&>svg]:size-4': step.status !== 'running',
            '[&>svg]:text-notice-success-fg': step.status === 'success',
            '[&>svg]:text-notice-destructive-fg': step.status === 'failed',
            'bg-accent1Dark shadow-glow-accent1': step.status === 'success',
            'bg-accent2Dark shadow-glow-accent2': step.status === 'failed',
            'scale-110': step.status === 'success' || step.status === 'failed',
          },
        )}
      >
        {getStatusIcon(step.status)}
      </div>
    </div>
  );
}
