import { Button } from '@mastra/playground-ui/components/Button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@mastra/playground-ui/components/Tooltip';
import type { ReactNode } from 'react';

/** A full navigation row stays inert while its explanation remains keyboard accessible. */
export function UnavailableNavigationItem({
  icon,
  label,
  explanation,
  docsHref,
}: {
  icon: ReactNode;
  label: string;
  explanation: string;
  docsHref: `https://${string}`;
}) {
  return (
    <li>
      <Tooltip>
        <TooltipTrigger
          render={
            <span
              role="button"
              tabIndex={0}
              aria-disabled="true"
              aria-label={label}
              className="flex w-full rounded-xl bg-muted opacity-50 ring-1 ring-border ring-inset focus-visible:outline-1 focus-visible:outline-border-focus"
            >
              <Button
                disabled
                aria-hidden="true"
                tabIndex={-1}
                variant="ghost"
                icon={icon}
                className="w-full justify-start rounded-xl bg-fill-subtle px-3"
              >
                {label}
              </Button>
            </span>
          }
        />
        <TooltipContent side="right">
          {explanation}{' '}
          <a href={docsHref} target="_blank" rel="noopener noreferrer" className="underline">
            Learn more
          </a>
        </TooltipContent>
      </Tooltip>
    </li>
  );
}
