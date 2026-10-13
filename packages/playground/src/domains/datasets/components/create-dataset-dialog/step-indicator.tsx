import { Txt } from '@mastra/playground-ui/components/Txt';
import { cn } from '@mastra/playground-ui/utils/cn';

export interface StepIndicatorProps {
  current: number;
  total: number;
}

export function StepIndicator({ current, total }: StepIndicatorProps) {
  return (
    <div className="flex items-center gap-3 px-5 pt-4 pr-12">
      <div aria-hidden className="flex gap-1">
        {Array.from({ length: total }, (_, index) => (
          <span
            key={index}
            className={cn(
              'h-1 w-6 rounded-full transition-colors duration-normal ease-out-custom motion-reduce:transition-none',
              index < current ? 'bg-foreground' : 'bg-border',
            )}
          />
        ))}
      </div>
      <Txt as="span" variant="caption" tone="muted">
        Step {current} of {total}
      </Txt>
    </div>
  );
}
