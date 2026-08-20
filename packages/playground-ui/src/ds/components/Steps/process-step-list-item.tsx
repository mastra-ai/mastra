import { getStatusIcon } from './shared';
import type { ProcessStep } from './shared';
import { transitions } from '@/ds/primitives/transitions';
import { cn } from '@/lib/utils';

type ProcessStepListItemVariant = 'default' | 'plain';

/** Same ring geometry and stroke as `<Spinner size="sm" />`, so pending and running read as one shape. */
function PendingRing() {
  return (
    <svg viewBox="0 0 24 24" className="text-neutral2" aria-hidden>
      <circle
        cx="12"
        cy="12"
        r="8.5"
        pathLength="48"
        fill="none"
        stroke="currentcolor"
        strokeWidth="2.8"
        strokeLinecap="round"
        strokeDasharray="3 3"
      />
    </svg>
  );
}

function StepStatusMarker({ status, variant }: { status: string; variant: ProcessStepListItemVariant }) {
  if (variant === 'plain') {
    return (
      <span
        className={cn('flex size-4 items-center justify-center self-center [&>svg]:size-4', transitions.colors, {
          '[&>svg]:text-positive1': status === 'success',
          '[&>svg]:text-negative1': status === 'failed',
        })}
      >
        {status === 'pending' ? <PendingRing /> : getStatusIcon(status)}
      </span>
    );
  }

  return (
    <span
      className={cn(
        'flex size-7 items-center justify-center self-center rounded-full motion-reduce:transition-none',
        transitions.colors,
        transitions.transform,
        transitions.shadow,
        {
          '[&>svg]:text-notice-success-fg': status === 'success',
          '[&>svg]:text-notice-destructive-fg': status === 'failed',
          'border border-dashed border-neutral2': status === 'pending',
          '[&>svg]:size-4': status !== 'running',
          'bg-accent1Dark shadow-glow-accent1': status === 'success',
          'bg-accent2Dark shadow-glow-accent2': status === 'failed',
          'scale-110': status === 'success' || status === 'failed',
        },
      )}
    >
      {getStatusIcon(status)}
    </span>
  );
}

export type ProcessStepListItemProps = {
  /** @deprecated Ignored — the heading comes from `step.title`. */
  stepId?: string;
  step: ProcessStep;
  isActive: boolean;
  position: number;
  variant?: ProcessStepListItemVariant;
};

export function ProcessStepListItem({ step, isActive, position, variant = 'default' }: ProcessStepListItemProps) {
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
            {step.title}
          </h4>
          {step.description && (
            <p className={cn('-mt-0.5 text-ui-md text-neutral2', { truncate: variant === 'plain' })}>
              {step.description}
            </p>
          )}
        </div>
      </div>
      <StepStatusMarker status={step.status} variant={variant} />
    </div>
  );
}
