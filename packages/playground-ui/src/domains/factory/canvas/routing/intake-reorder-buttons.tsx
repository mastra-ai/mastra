import { Button } from '@/ds/components/Button';
import { IconArrowDown } from '@/ds/icons/central/IconArrowDown';
import { IconArrowUp } from '@/ds/icons/central/IconArrowUp';

/** Moves a board one place up or down the intake order. */
export function IntakeReorderButtons({
  earlier,
  later,
  onMove,
}: {
  earlier: boolean;
  later: boolean;
  onMove: (by: -1 | 1) => void;
}) {
  return (
    <span className="flex items-center gap-2">
      <Button size="icon-sm" variant="ghost" tooltip="Check earlier" disabled={!earlier} onClick={() => onMove(-1)}>
        <IconArrowUp />
      </Button>
      <Button size="icon-sm" variant="ghost" tooltip="Check later" disabled={!later} onClick={() => onMove(1)}>
        <IconArrowDown />
      </Button>
    </span>
  );
}
