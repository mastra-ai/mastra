import { Button } from '@mastra/playground-ui/components/Button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@mastra/playground-ui/components/Tooltip';
import { controlStateColorTransition } from '@mastra/playground-ui/primitives/transitions';
import { cn } from '@mastra/playground-ui/utils/cn';
import { ExternalLink } from 'lucide-react';

export function DisabledFeatureButton({
  icon,
  label,
  tooltipContent,
  docsHref,
}: {
  icon: React.ReactNode;
  label: string;
  tooltipContent: React.ReactNode;
  docsHref: `https://${string}`;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span tabIndex={0} className="inline-flex">
            <Button variant="ghost" size="icon-md" disabled aria-label={label}>
              {icon}
            </Button>
          </span>
        }
      />
      <TooltipContent side="bottom">
        <div>{label}</div>
        <div>{tooltipContent}</div>
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
      </TooltipContent>
    </Tooltip>
  );
}
