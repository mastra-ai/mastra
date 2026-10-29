import { ArrowLeftRightIcon, CircleCheckIcon, CircleDashedIcon, CircleXIcon, TriangleAlertIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import type { SpanOutcome, SpanOutcomeTone } from './span-outcome.utils';
import { Notice } from '@/ds/components/Notice';
import type { NoticeVariant } from '@/ds/components/Notice';
import { cn } from '@/lib/utils';

const TONES: Record<SpanOutcomeTone, { variant: NoticeVariant; icon: ReactNode; iconClass: string }> = {
  neutral: { variant: 'note', icon: <CircleDashedIcon />, iconClass: 'text-muted-foreground' },
  success: { variant: 'success', icon: <CircleCheckIcon />, iconClass: 'text-success-indicator' },
  change: { variant: 'info', icon: <ArrowLeftRightIcon />, iconClass: 'text-info-indicator' },
  warning: { variant: 'warning', icon: <TriangleAlertIcon />, iconClass: 'text-warning-foreground' },
  error: { variant: 'destructive', icon: <CircleXIcon />, iconClass: 'text-destructive-indicator' },
};

export interface SpanOutcomeSummaryProps {
  outcome: SpanOutcome;
  /** Quote the detail line; leave off when a section below already shows it. */
  showDetail?: boolean;
  /**
   * Renders the proof inside the notice, under the full width. It gets the headline to use as its heading,
   * so the proof's own actions sit on the headline row.
   */
  renderProof?: (headline: ReactNode) => ReactNode;
  className?: string;
}

/** A notice at the top of the panel body saying what the span did; the sections below hold the proof. */
export function SpanOutcomeSummary({ outcome, showDetail = false, renderProof, className }: SpanOutcomeSummaryProps) {
  const { variant, icon, iconClass } = TONES[outcome.tone];
  const detail = showDetail ? outcome.detail : undefined;

  if (renderProof) {
    const headline = (
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <span
          aria-hidden
          className={cn('flex size-5 shrink-0 items-center justify-center [&>svg]:size-icon-sm', iconClass)}
        >
          {icon}
        </span>
        <h3 className="min-w-0 text-subheading wrap-anywhere">{outcome.headline}</h3>
      </div>
    );
    // The notice's own icon column would indent the proof; the headline carries the icon instead.
    return (
      <div data-slot="span-outcome" data-tone={outcome.tone} className={className}>
        <Notice
          variant={variant}
          className="[&>[data-slot=notice-content]]:col-span-full [&>[data-slot=notice-icon]]:hidden"
        >
          {renderProof(headline)}
        </Notice>
      </div>
    );
  }

  return (
    <div data-slot="span-outcome" data-tone={outcome.tone} className={className}>
      <Notice variant={variant} icon={icon} title={<h3>{outcome.headline}</h3>}>
        {detail && <p className="line-clamp-2 break-words opacity-80">{detail}</p>}
      </Notice>
    </div>
  );
}
