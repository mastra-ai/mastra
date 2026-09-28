import { Popover, PopoverContent, PopoverTrigger } from '@mastra/playground-ui/components/Popover';
import { ScrollArea } from '@mastra/playground-ui/components/ScrollArea';
import { Txt } from '@mastra/playground-ui/components/Txt';
import type { ReactNode } from 'react';

interface RunActionPopoverProps {
  label: string;
  icon: ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}

// Keep the wide popup anchored to `start` and slide it into view instead of flipping sides.
const COLLISION_AVOIDANCE = { align: 'shift' } as const;

/** Shared shell so every run-action popover has the same trigger, layout and behavior. */
export function RunActionPopover({ label, icon, open, onOpenChange, children }: RunActionPopoverProps) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger variant="default" size="icon-md" type="button" tooltip={label} aria-label={label}>
        {icon}
      </PopoverTrigger>
      <PopoverContent
        align="start"
        collisionAvoidance={COLLISION_AVOIDANCE}
        className="w-[min(480px,calc(100vw-2rem))] p-0"
      >
        {/* The popover is portaled, but React events still bubble through it: keep inner
            form submissions from reaching an enclosing form (e.g. the workflow trigger). */}
        <div onSubmit={event => event.stopPropagation()}>
          <ScrollArea className="w-full" maxHeight="min(600px, calc(100dvh - 8rem))">
            <div className="space-y-4 p-4">
              <Txt as="h3" variant="body" tone="muted">
                {label}
              </Txt>
              {children}
            </div>
          </ScrollArea>
        </div>
      </PopoverContent>
    </Popover>
  );
}
