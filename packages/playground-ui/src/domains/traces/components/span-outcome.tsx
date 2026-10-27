import { ArrowLeftRightIcon, CircleCheckIcon, CircleDashedIcon, CircleXIcon, TriangleAlertIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import type { SpanOutcome, SpanOutcomeTone } from './span-outcome.utils';
import { Notice } from '@/ds/components/Notice';
import type { NoticeVariant } from '@/ds/components/Notice';

const TONES: Record<SpanOutcomeTone, { variant: NoticeVariant; icon: ReactNode }> = {
  neutral: { variant: 'note', icon: <CircleDashedIcon /> },
  success: { variant: 'success', icon: <CircleCheckIcon /> },
  change: { variant: 'info', icon: <ArrowLeftRightIcon /> },
  warning: { variant: 'warning', icon: <TriangleAlertIcon /> },
  error: { variant: 'destructive', icon: <CircleXIcon /> },
};

export interface SpanOutcomeSummaryProps {
  outcome: SpanOutcome;
  /** Quote the detail line; leave off when a section below already shows it. */
  showDetail?: boolean;
  className?: string;
}

/** A notice at the top of the panel body saying what the span did; the sections below hold the proof. */
export function SpanOutcomeSummary({ outcome, showDetail = false, className }: SpanOutcomeSummaryProps) {
  const { variant, icon } = TONES[outcome.tone];
  const detail = showDetail ? outcome.detail : undefined;

  return (
    <div data-slot="span-outcome" data-tone={outcome.tone} className={className}>
      <Notice variant={variant} icon={icon} title={<h3>{outcome.headline}</h3>}>
        {detail && <p className="line-clamp-2 break-words opacity-80">{detail}</p>}
      </Notice>
    </div>
  );
}
