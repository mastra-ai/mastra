import type { ReactNode } from 'react';
import { ScrollArea, ScrollAreaViewport } from '../../../ds/components/ScrollArea';
import { Txt } from '../../../ds/components/Txt';
import { frameSurfaceStyle } from '../../../ds/primitives/raised-surface';
import { cn } from '../../../utils/cn';

export function AgentConfigSurface({ children }: { children: ReactNode }) {
  return (
    <div
      data-testid="agent-overview-panel"
      className={cn('grid h-full min-h-0 grid-rows-[auto_1fr] overflow-hidden rounded-studio-frame', frameSurfaceStyle)}
    >
      <div className="flex h-10 min-h-10 items-center border-b border-border px-4">
        <Txt as="h2" variant="subheading" tone="ink">
          Config
        </Txt>
      </div>
      <ScrollArea className="min-h-0" mask={{ top: false }}>
        <ScrollAreaViewport className="h-full">{children}</ScrollAreaViewport>
      </ScrollArea>
    </div>
  );
}
