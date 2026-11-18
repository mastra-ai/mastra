import { Txt } from '@/ds/components/Txt';

/** One line under the filter bar once the server refused a live-update poll, so the list stopped updating. */
export function LiveUpdatesPausedNote() {
  return (
    <Txt variant="body-sm" tone="muted" role="status">
      Live updates paused. Change the filters or reload to try again.
    </Txt>
  );
}
