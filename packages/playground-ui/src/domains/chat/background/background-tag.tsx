import { Badge } from '@/ds/components/Badge';

/**
 * Marks a call whose work goes on after it returned: a background process or a deferred task. It
 * pulses only while the work is known to run.
 */
export function BackgroundTag({ live = true }: { live?: boolean }) {
  return (
    <Badge size="xs" variant="info" emphasis="subtle" indicator={live ? 'pulse' : undefined}>
      Background
    </Badge>
  );
}
