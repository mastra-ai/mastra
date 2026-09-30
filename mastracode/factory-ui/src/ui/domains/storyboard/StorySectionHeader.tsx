import { Txt } from '@mastra/playground-ui/components/Txt';
import type { ReactNode } from 'react';

import { PrototypeBadge } from './StoryChoices';

export function StorySectionHeader({
  id,
  title,
  description,
  action,
}: {
  id: string;
  title: string;
  description: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex items-center gap-2">
          <Txt as="h2" variant="column" tone="ink" id={id}>
            {title}
          </Txt>
          <PrototypeBadge />
        </div>
        <Txt as="p" variant="meta" tone="muted" className="max-w-[72ch] text-pretty">
          {description}
        </Txt>
      </div>
      {action}
    </div>
  );
}
