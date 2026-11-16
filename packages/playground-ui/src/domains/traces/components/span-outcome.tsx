import type { ReactNode } from 'react';
import type { SpanOutcome, SpanOutcomeTone } from './span-outcome.utils';
import { Notice } from '@/ds/components/Notice';
import type { NoticeVariant } from '@/ds/components/Notice';
import { IconArrowLeftRight } from '@/ds/icons/central/IconArrowLeftRight';
import { IconCircleCheck } from '@/ds/icons/central/IconCircleCheck';
import { IconCircleDashed } from '@/ds/icons/central/IconCircleDashed';
import { IconCircleX } from '@/ds/icons/central/IconCircleX';
import { IconExclamationTriangle } from '@/ds/icons/central/IconExclamationTriangle';

const TONES: Record<SpanOutcomeTone, { variant: NoticeVariant; icon: ReactNode }> = {
  neutral: { variant: 'note', icon: <IconCircleDashed /> },
  success: { variant: 'success', icon: <IconCircleCheck /> },
  change: { variant: 'info', icon: <IconArrowLeftRight /> },
  warning: { variant: 'warning', icon: <IconExclamationTriangle /> },
  error: { variant: 'destructive', icon: <IconCircleX /> },
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
