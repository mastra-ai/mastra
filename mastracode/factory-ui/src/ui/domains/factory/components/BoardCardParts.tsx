import { Badge } from '@mastra/playground-ui/components/Badge';
import { Button } from '@mastra/playground-ui/components/Button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@mastra/playground-ui/components/Tooltip';
import { cn } from '@mastra/playground-ui/utils/cn';
import { TriangleAlert } from 'lucide-react';
import type { ReactElement } from 'react';

import { HIDDEN_CARD_LABELS, SOURCE_LABELS } from '../boardItems';
import type { FactoryDecisionSummary } from '../services/decisions';
import type { WorkItemSource } from '../services/workItems';

export function SourceTitle({ source, title }: { source: WorkItemSource; title: string }) {
  return (
    <>
      <span className="sr-only">{SOURCE_LABELS[source]}: </span>
      <span>{title}</span>
    </>
  );
}

/**
 * Card titles are clipped to one line, so the full text is only reachable on
 * hover. The tooltip anchors to the whole card rather than the title span: in
 * `WorkItemCard` the click target is an `absolute inset-0 z-10` overlay that
 * paints over the title, so a trigger on the title itself would never see a
 * pointer event.
 */
export function CardTitleTooltip({ title, children }: { title: string; children: ReactElement }) {
  return (
    // The app-wide provider uses a 0ms delay, which is fine for icon buttons but
    // makes a card-sized target fire while the pointer merely crosses the board.
    <TooltipProvider delay={400}>
      <Tooltip>
        <TooltipTrigger render={children} />
        <TooltipContent side="top" className="max-w-90">
          <span className="wrap-anywhere whitespace-pre-wrap">{title}</span>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function decisionStatusText(decision: FactoryDecisionSummary): string {
  if (decision.status === 'pending') return `Rule effect pending · ${decision.type}`;
  if (decision.status === 'leased') return `Rule effect dispatching · ${decision.type} · attempt ${decision.attempts}`;
  if (decision.status === 'retry') return `Rule effect retrying · ${decision.type} · attempt ${decision.attempts}`;
  return decision.lastError ? `Rule effect failed: ${decision.lastError}` : `Rule effect failed · ${decision.type}`;
}

/** The rule effect the card waits on; a failed one carries its retry. */
export function CardDecisionStatus({
  decision,
  retrying,
  onRetry,
}: {
  decision: FactoryDecisionSummary;
  retrying: boolean;
  onRetry: () => void;
}) {
  if (decision.status !== 'failed') {
    return (
      <span role="status" className="text-ui-xs text-icon4">
        {decisionStatusText(decision)}
      </span>
    );
  }

  return (
    <div className="flex items-center justify-between gap-2">
      <Tooltip>
        <TooltipTrigger
          render={
            <Badge
              variant="error"
              size="xs"
              icon={<TriangleAlert aria-hidden />}
              role="alert"
              aria-label={decisionStatusText(decision)}
              tabIndex={0}
              className="focus-visible:ring-accent1 relative z-20 cursor-help outline-hidden focus-visible:ring-2"
            >
              Error
            </Badge>
          }
        />
        <TooltipContent side="top" className="max-w-80">
          <span className="wrap-anywhere whitespace-pre-wrap">{decisionStatusText(decision)}</span>
        </TooltipContent>
      </Tooltip>
      <Button type="button" variant="outline" size="sm" className="relative z-20" disabled={retrying} onClick={onRetry}>
        {retrying ? 'Retrying…' : 'Retry'}
      </Button>
    </div>
  );
}

function labelDotClass(label: string): string {
  const normalized = label.toLowerCase();
  if (normalized.includes('bug') || normalized.includes('error')) return 'bg-accent2';
  if (normalized.includes('approval') || normalized.includes('priority')) return 'bg-accent6';
  if (normalized.includes('triage') || normalized.includes('ready')) return 'bg-accent1';
  if (normalized.includes('cli') || normalized.includes('linear')) return 'bg-accent3';
  if (normalized.includes('work') || normalized.includes('trio')) return 'bg-accent6';
  return 'bg-icon3';
}

export function CardLabels({ labels }: { labels: readonly string[] }) {
  const displayLabels = labels.filter(label => !HIDDEN_CARD_LABELS.has(label.toLowerCase()));
  if (displayLabels.length === 0) return null;
  const visibleLabels = displayLabels.slice(0, 3);
  const hiddenCount = displayLabels.length - visibleLabels.length;
  return (
    <div className="flex flex-wrap items-center gap-1.5" aria-label="Labels">
      {visibleLabels.map(label => (
        <span
          key={label}
          className="border-border1 text-ui-xs text-icon4 inline-flex h-6 max-w-full items-center gap-1 rounded-full border px-2"
          title={label}
        >
          <span className={cn('size-1.5 shrink-0 rounded-full', labelDotClass(label))} aria-hidden />
          <span className="truncate">{label}</span>
        </span>
      ))}
      {hiddenCount > 0 && (
        <span className="border-border1 text-ui-xs text-icon3 inline-flex h-6 items-center rounded-full border px-2">
          +{hiddenCount}
        </span>
      )}
    </div>
  );
}
