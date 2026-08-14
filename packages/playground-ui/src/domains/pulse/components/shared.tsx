import type { FlowStatus } from '@mastra/core/storage';
import { StatusBadge } from '@/ds/components/StatusBadge';
import type { StatusBadgeProps } from '@/ds/components/StatusBadge';

/** DS StatusBadge treatment per derived flow status:
 *  running → info (blue) with a pulsing dot, completed → success (green),
 *  failed → error (red), aborted → warning (orange), stale → neutral (gray). */
const STATUS_BADGE_VARIANTS: Record<FlowStatus, { variant: StatusBadgeProps['variant']; pulse: boolean }> = {
  running: { variant: 'info', pulse: true },
  completed: { variant: 'success', pulse: false },
  failed: { variant: 'error', pulse: false },
  aborted: { variant: 'warning', pulse: false },
  stale: { variant: 'neutral', pulse: false },
};

export function PulseStatusBadge({ status }: { status: FlowStatus }) {
  const { variant, pulse } = STATUS_BADGE_VARIANTS[status] ?? STATUS_BADGE_VARIANTS.stale;
  return (
    <StatusBadge variant={variant} size="sm" withDot pulse={pulse}>
      {status}
    </StatusBadge>
  );
}
