import { Txt } from '@mastra/playground-ui/components/Txt';
import { Check } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@mastra/playground-ui/utils/cn';

/** A connection is a choice in a list, not a separate onboarding card. */
export function OnboardingConnectionRow({
  icon,
  name,
  description,
  connected = false,
  action,
  compact = false,
}: {
  icon: ReactNode;
  name: string;
  description: string;
  connected?: boolean;
  action?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        'group/onboarding-connection hover:bg-fill focus-within:bg-fill -mx-3 flex min-w-0 items-center gap-x-3 gap-y-3 rounded-lg px-3 transition-colors',
        compact ? 'min-h-22 py-3' : 'flex-wrap py-4',
      )}
    >
      <span
        className="text-muted-foreground flex size-4 shrink-0 items-center justify-center motion-safe:transition-transform motion-safe:duration-200 motion-safe:group-hover/onboarding-connection:scale-110 [&>svg]:size-4"
        aria-hidden="true"
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1 basis-40">
        <Txt as="h2" variant="caption" className="flex items-center gap-2">
          {name}
          {connected && <Check className="text-success-indicator size-4" aria-label="Connected" />}
        </Txt>
        <Txt variant={compact ? 'meta' : 'caption'} tone="muted" className="mt-1">
          {description}
        </Txt>
      </div>
      {action && <div className={cn('shrink-0', !compact && 'max-sm:ml-7')}>{action}</div>}
    </div>
  );
}
