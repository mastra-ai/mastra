import type { ReactNode } from 'react';

import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/ds/components/HoverCard';
import type { createHoverCardHandle } from '@/ds/components/HoverCard';
import { Txt } from '@/ds/components/Txt';
import { IconArrowInbox } from '@/ds/icons/central/IconArrowInbox';
import { IconFlag2 } from '@/ds/icons/central/IconFlag2';
import { IconPlayCircle } from '@/ds/icons/central/IconPlayCircle';
import { IconRobot } from '@/ds/icons/central/IconRobot';
import { focusRing } from '@/ds/primitives/transitions';
import type { LinkComponent } from '@/ds/types/link-component';
import { cn } from '@/utils/cn';

export type PhaseSetupHandle = ReturnType<typeof createHoverCardHandle<string>>;

export interface PhaseSetupProps {
  handle: PhaseSetupHandle;
  phaseId: string;
  /** The phase's settings. */
  href: string;
  /** Read by screen readers in place of the icons. */
  summary: string;
  arriving: number;
  agent: boolean;
  autoStart: boolean;
  exitTool: boolean;
  LinkComponent: LinkComponent;
}

/**
 * A phase's setup in its column header: the rules bringing cards in, with their count, and an icon each for its agent,
 * its starting on its own, and its exit tool. Hover or focus reads the whole phase in the board's one
 * `PhaseSetupHoverCard`; a click opens its settings. Renders nothing when the phase has none of those.
 */
export function PhaseSetup({
  handle,
  phaseId,
  href,
  summary,
  arriving,
  agent,
  autoStart,
  exitTool,
  LinkComponent,
}: PhaseSetupProps) {
  if (!agent && !exitTool && !arriving) return null;
  return (
    <HoverCardTrigger
      handle={handle}
      payload={phaseId}
      delay={0}
      closeDelay={150}
      render={<LinkComponent href={href} aria-label={summary} />}
      className={cn(
        focusRing,
        'flex h-6 items-center gap-1 rounded-md px-1 text-muted-foreground transition-colors hover:text-foreground',
        'group-data-collapsed/column:h-auto group-data-collapsed/column:flex-col group-data-collapsed/column:py-1',
      )}
    >
      {!!arriving && (
        <span className="flex items-center gap-0.5 group-data-collapsed/column:flex-col">
          <IconArrowInbox className="size-icon-sm" aria-hidden />
          <Txt as="span" variant="meta" aria-hidden className="tabular-nums">
            {arriving}
          </Txt>
        </span>
      )}
      {agent && <IconRobot className="size-icon-sm" aria-hidden />}
      {agent && autoStart && <IconPlayCircle className="size-icon-sm text-info-indicator" aria-hidden />}
      {exitTool && <IconFlag2 className="size-icon-sm" aria-hidden />}
    </HoverCardTrigger>
  );
}

/**
 * The one card every column header's `PhaseSetup` opens, showing the hovered phase: moving to the next header swaps
 * what it shows instead of opening a second card.
 */
export function PhaseSetupHoverCard({
  handle,
  children,
}: {
  handle: PhaseSetupHandle;
  /** Renders the hovered phase's setup, e.g. a `PhaseSetupCard`; `null` closes nothing and shows nothing. */
  children: (phaseId: string) => ReactNode;
}) {
  return (
    <HoverCard handle={handle}>
      {({ payload }) => {
        const content = payload === undefined ? null : children(payload);
        if (!content) return null;
        return (
          <HoverCardContent
            side="bottom"
            align="end"
            sideOffset={6}
            collisionPadding={8}
            showArrow={false}
            className="flex w-96 max-w-[calc(100vw-2rem)] flex-col gap-3 p-4"
          >
            {content}
          </HoverCardContent>
        );
      }}
    </HoverCard>
  );
}
