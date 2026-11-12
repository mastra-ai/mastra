import { Badge } from '@/ds/components/Badge';

/** Marks a call whose work goes on after it returned: a background process or a deferred task. */
export function BackgroundTag() {
  return (
    <Badge size="xs" variant="info" emphasis="subtle" indicator="pulse">
      Background
    </Badge>
  );
}
