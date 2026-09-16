import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@mastra/playground-ui/components/Collapsible';
import { cn } from '@mastra/playground-ui/utils/cn';
import { ChevronRightIcon } from 'lucide-react';
import type { ReactNode } from 'react';

export interface ComparisonSectionProps {
  title: string;
  /** Rendered on the right of the heading, e.g. a copy button. */
  actions?: ReactNode;
  /** Colors the heading, used to signal a failed run. */
  tone?: 'default' | 'negative';
  defaultOpen?: boolean;
  children: ReactNode;
}

/**
 * Single collapsible treatment shared by every block of a comparison cell, so
 * output, scores, errors and metadata read as one consistent column and can be
 * folded away when a row gets noisy.
 */
export function ComparisonSection({
  title,
  actions,
  tone = 'default',
  defaultOpen = true,
  children,
}: ComparisonSectionProps) {
  return (
    <Collapsible defaultOpen={defaultOpen} className="grid gap-2">
      <div className="flex min-h-6 items-center justify-between gap-2">
        <CollapsibleTrigger
          className={cn(
            'text-ui-md flex items-center gap-1.5 font-semibold [&>svg]:size-4',
            tone === 'negative' ? 'text-negative1' : 'text-neutral5',
          )}
        >
          <ChevronRightIcon />
          {title}
        </CollapsibleTrigger>
        {actions}
      </div>
      <CollapsibleContent role="region" aria-label={title}>
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}
