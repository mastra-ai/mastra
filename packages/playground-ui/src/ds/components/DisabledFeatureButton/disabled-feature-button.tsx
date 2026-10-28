import { ExternalLink } from 'lucide-react';
import type { ReactNode } from 'react';

import { Button } from '@/ds/components/Button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ds/components/Tooltip';
import { controlStateColorTransition } from '@/ds/primitives/transitions';
import { cn } from '@/lib/utils';

export type DisabledFeatureButtonProps = {
  icon: ReactNode;
  label: string;
  tooltipContent: ReactNode;
  docsHref: `https://${string}`;
};

/**
 * Icon-only, disabled control for a feature that is not available yet.
 * The focusable wrapper carries the accessible name and disabled state so the
 * tooltip stays reachable by keyboard while the visual button remains inert.
 */
export function DisabledFeatureButton({ icon, label, tooltipContent, docsHref }: DisabledFeatureButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span role="button" tabIndex={0} aria-disabled="true" aria-label={label} className="inline-flex">
            <Button variant="ghost" size="icon-md" disabled aria-hidden="true" tabIndex={-1}>
              {icon}
            </Button>
          </span>
        }
      />
      <TooltipContent side="bottom" className="max-w-[calc(100dvw-1rem)]">
        <span>
          {tooltipContent}{' '}
          <a
            href={docsHref}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              'inline-flex items-center gap-1 text-inherit underline hover:text-foreground',
              controlStateColorTransition,
            )}
          >
            Learn more
            <ExternalLink className="size-3" />
          </a>
        </span>
      </TooltipContent>
    </Tooltip>
  );
}
