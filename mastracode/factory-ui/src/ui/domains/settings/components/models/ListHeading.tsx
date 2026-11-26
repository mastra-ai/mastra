import { Txt } from '@mastra/playground-ui/components/Txt';
import type { ReactNode } from 'react';

interface ListHeadingProps {
  label: string;
  description?: string;
  children?: ReactNode;
}

export function ListHeading({ label, description, children }: ListHeadingProps) {
  return (
    <div className="flex min-h-8 items-center justify-between gap-2">
      <div className="flex min-w-0 flex-col">
        <Txt as="span" variant="caption" tone="muted">
          {label}
        </Txt>
        {description && (
          <Txt as="span" variant="meta" tone="muted">
            {description}
          </Txt>
        )}
      </div>
      {children}
    </div>
  );
}
