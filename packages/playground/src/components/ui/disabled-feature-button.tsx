import { Button } from '@mastra/playground-ui/components/Button';
import { Popover, PopoverContent, PopoverTrigger } from '@mastra/playground-ui/components/Popover';
import { controlStateColorTransition } from '@mastra/playground-ui/primitives/transitions';
import { cn } from '@mastra/playground-ui/utils/cn';
import { ExternalLink } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

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
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLSpanElement>(null);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(leaveTimer.current), []);

  function handleMouseEnter() {
    clearTimeout(leaveTimer.current);
    setOpen(true);
  }

  function handleMouseLeave() {
    leaveTimer.current = setTimeout(() => setOpen(false), 120);
  }

  return (
    <span
      ref={containerRef}
      className="inline-flex"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocusCapture={() => setOpen(true)}
      onBlurCapture={event => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          nativeButton={false}
          render={
            <span tabIndex={0} className="inline-flex">
              <Button variant="ghost" size="icon-md" disabled aria-label={label}>
                {icon}
              </Button>
            </span>
          }
        />
        <PopoverContent
          role="tooltip"
          side="bottom"
          initialFocus={false}
          finalFocus={false}
          container={containerRef.current}
          className="w-auto max-w-xs"
        >
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
        </PopoverContent>
      </Popover>
    </span>
  );
}
