import { Button } from '@mastra/playground-ui/components/Button';
import { Card } from '@mastra/playground-ui/components/Card';
import { CollapsibleBox, useCollapsibleBox } from '@mastra/playground-ui/components/CollapsibleBox';
import { DataPanel } from '@mastra/playground-ui/components/DataPanel';
import { cn } from '@mastra/playground-ui/utils/cn';
import { Minimize2 } from 'lucide-react';
import type { ReactNode } from 'react';

/** Spacing between the sections of a comparison cell, shared by every cell so rows line up. */
export const sectionStackClass = 'grid content-start gap-5';

export interface ComparisonSectionProps {
  title: string;
  /** Rendered on the right of the heading, e.g. a copy button. */
  actions?: ReactNode;
  /** Colors the heading, used to signal a failed run. */
  tone?: 'default' | 'negative';
  /** Clips long content with a fade until expanded. Off for short, always-visible blocks like metric lists. */
  collapsible?: boolean;
  /** Wraps the content in a card (a destructive box when `tone` is negative), with the clipping inside it so the rounded frame stays intact. */
  framed?: boolean;
  /** Controls the expansion from outside, so sibling sections can expand together. */
  expanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  children: ReactNode;
}

/**
 * Block of a comparison cell: a small heading above the content, which is clipped
 * with a fade when long, like the span input/output panels.
 */
export function ComparisonSection({
  title,
  actions,
  tone = 'default',
  collapsible = true,
  framed = false,
  expanded,
  onExpandedChange,
  children,
}: ComparisonSectionProps) {
  const ownBox = useCollapsibleBox({ collapsedHeight: 160 });
  // Clipping is still measured per box; only the expanded flag comes from outside when controlled.
  const box =
    expanded === undefined || !onExpandedChange
      ? ownBox
      : {
          ...ownBox,
          isExpanded: expanded,
          setExpanded: onExpandedChange,
          toggleExpanded: () => onExpandedChange(!expanded),
        };
  const content = collapsible ? (
    <CollapsibleBox state={box} expandLabel="Expand">
      {children}
    </CollapsibleBox>
  ) : (
    children
  );

  return (
    <section className="grid min-w-0 gap-2">
      <div className="flex h-7 items-center justify-between gap-2">
        <DataPanel.SectionHeading className={cn(tone === 'negative' && 'text-destructive-foreground')}>
          {title}
        </DataPanel.SectionHeading>
        <div className="ml-auto flex items-center gap-1">{actions}</div>
      </div>
      <div role="region" aria-label={title} className="min-w-0">
        {!framed ? (
          content
        ) : tone === 'negative' ? (
          <div className="min-w-0 overflow-hidden rounded-lg border border-destructive-edge bg-destructive-subtle">
            {content}
          </div>
        ) : (
          <Card className="min-w-0 overflow-hidden">{content}</Card>
        )}
        {collapsible && box.isExpanded && box.isClipped && (
          <div className="flex justify-center pt-1">
            <Button size="sm" variant="ghost" icon={<Minimize2 />} onClick={() => box.setExpanded(false)}>
              Collapse
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}
