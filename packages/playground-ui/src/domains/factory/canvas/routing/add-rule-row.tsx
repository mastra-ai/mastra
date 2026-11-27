import { Txt } from '@/ds/components/Txt';
import { IconPlusMedium } from '@/ds/icons/central/IconPlusMedium';
import { focusRing } from '@/ds/primitives/transitions';
import { cn } from '@/utils/cn';

/** Starts a new rule for the board. */
export function AddRuleRow({ onAdd }: { onAdd: () => void }) {
  // A DS Button is a pill sized for toolbars; this sits in a rule row's height and shape.
  return (
    <li>
      <button
        type="button"
        onClick={onAdd}
        className={cn(
          'flex h-5.5 items-center gap-1.5 rounded-md pr-1.5 text-foreground hover:bg-fill-hover',
          focusRing,
        )}
      >
        <IconPlusMedium className="size-icon-xs" aria-hidden />
        <Txt as="span" variant="caption">
          Rule
        </Txt>
      </button>
    </li>
  );
}
