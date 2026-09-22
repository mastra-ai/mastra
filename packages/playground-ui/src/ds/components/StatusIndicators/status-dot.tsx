import { useEffect, useRef, useState } from 'react';
import { statusDotClass, type StatusPresentation, type StatusPresentationFn } from './status-dot-styles';
import { Popover, PopoverContent, PopoverTrigger } from '@/ds/components/Popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ds/components/Tooltip';

const HOVER_POPOVER_LEAVE_MS = 120;

function StatusDotPopoverInner<T>({
  status,
  presentation,
}: {
  status: T | null;
  presentation: StatusPresentationFn<T>;
}) {
  const [open, setOpen] = useState(false);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const resolved = presentation(status);

  useEffect(
    () => () => {
      if (leaveTimer.current !== undefined) clearTimeout(leaveTimer.current);
    },
    [],
  );

  function onHoverOpen() {
    if (leaveTimer.current !== undefined) {
      clearTimeout(leaveTimer.current);
      leaveTimer.current = undefined;
    }
    setOpen(true);
  }

  function onHoverScheduleClose() {
    if (leaveTimer.current !== undefined) clearTimeout(leaveTimer.current);
    leaveTimer.current = setTimeout(() => setOpen(false), HOVER_POPOVER_LEAVE_MS);
  }

  return (
    <span className="pointer-events-auto inline-flex" onMouseEnter={onHoverOpen} onMouseLeave={onHoverScheduleClose}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <button
              type="button"
              aria-label={resolved.label}
              className={statusDotClass(
                resolved,
                'outline-hidden focus-visible:ring-ring focus-visible:ring-offset-background focus-visible:ring-2 focus-visible:ring-offset-2',
              )}
            />
          }
        />
        <PopoverContent
          side="top"
          align="start"
          sideOffset={6}
          className="text-meta text-foreground w-auto max-w-xs px-2.5 py-1.5"
          onMouseEnter={onHoverOpen}
          onMouseLeave={onHoverScheduleClose}
        >
          <p className="text-foreground text-column">{resolved.label}</p>
          <p className="text-muted-foreground mt-1 text-pretty">{resolved.description}</p>
        </PopoverContent>
      </Popover>
    </span>
  );
}

export function StatusDot<T>({
  status,
  presentation,
  variant = 'popover',
  decorative = false,
  resolved,
}: {
  status: T | null;
  presentation: StatusPresentationFn<T>;
  variant?: 'popover' | 'static';
  decorative?: boolean;
  resolved?: StatusPresentation;
}) {
  if (decorative) {
    const presented = resolved ?? presentation(status);
    return <span className={statusDotClass(presented)} aria-hidden />;
  }

  if (variant === 'popover') {
    return <StatusDotPopoverInner status={status} presentation={presentation} />;
  }

  const presented = resolved ?? presentation(status);

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            aria-label={presented.label}
            className={statusDotClass(
              presented,
              'outline-hidden focus-visible:ring-ring focus-visible:ring-offset-background cursor-default focus-visible:ring-2 focus-visible:ring-offset-2',
            )}
          />
        }
      />
      <TooltipContent side="top" className="max-w-xs text-pretty">
        {presented.description}
      </TooltipContent>
    </Tooltip>
  );
}
