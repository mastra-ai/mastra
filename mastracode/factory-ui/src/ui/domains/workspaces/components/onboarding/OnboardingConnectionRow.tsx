import { Txt } from '@mastra/playground-ui/components/Txt';
import { Check } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@mastra/playground-ui/utils/cn';

/** One integration in a section's inset list; its fixed minimum height matches the loading skeleton. */
export function OnboardingConnectionRow({
  icon,
  name,
  description,
  connected = false,
  action,
  tone = 'muted',
}: {
  icon: ReactNode;
  name: string;
  description: string;
  connected?: boolean;
  action?: ReactNode;
  /** Reconnect lines read as warnings, load failures as errors. */
  tone?: 'muted' | 'warning' | 'error';
}) {
  return (
    <div className="group/onboarding-connection flex min-h-15 min-w-0 items-center gap-3 rounded-lg px-3 py-2.5">
      <span
        className="text-muted-foreground flex size-4 shrink-0 items-center justify-center motion-safe:transition-transform motion-safe:duration-200 motion-safe:group-hover/onboarding-connection:scale-110 [&>svg]:size-4"
        aria-hidden="true"
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <Txt as="h3" variant="caption" className="flex items-center gap-2">
          {name}
          {connected && <Check className="text-success-indicator size-4" role="img" aria-label="Connected" />}
        </Txt>
        <Txt
          variant="meta"
          tone={tone === 'muted' ? 'muted' : undefined}
          className={cn(
            'mt-1',
            tone === 'warning' && 'text-warning-foreground',
            tone === 'error' && 'text-destructive-foreground',
          )}
        >
          {description}
        </Txt>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
