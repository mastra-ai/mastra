import { TooltipContent } from '@mastra/playground-ui/components/Tooltip';
import { cn } from '@mastra/playground-ui/utils/cn';
import type { ReactNode } from 'react';

import type { EdgeFade } from './edgeFade';

export function TrackChipBody({
  fade,
  surfaceClassName,
  surface,
  children,
}: {
  fade: EdgeFade;
  surfaceClassName: string;
  surface?: ReactNode;
  children: ReactNode;
}) {
  return (
    <>
      <span
        aria-hidden
        className={cn('absolute inset-0 -z-10 rounded-[inherit]', surfaceClassName)}
        style={{ maskImage: fade.surfaceMaskImage }}
      >
        {surface}
      </span>
      <span
        className="flex min-w-0 flex-1 items-center gap-1.5"
        style={{ marginLeft: fade.labelOffsetStartPx, marginRight: fade.labelOffsetEndPx }}
      >
        {children}
      </span>
    </>
  );
}

export function DetailLinesTooltipContent({ lines }: { lines: string[] }) {
  return (
    <TooltipContent side="bottom" className="max-w-80">
      <span className="flex flex-col">
        {lines.map(line => (
          <span key={line} className="wrap-anywhere">
            {line}
          </span>
        ))}
      </span>
    </TooltipContent>
  );
}
