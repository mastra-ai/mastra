import { Txt } from '@mastra/playground-ui/components/Txt';
import { IconPlusMedium } from '@mastra/playground-ui/icons/central/IconPlusMedium';
import { focusRing } from '@mastra/playground-ui/primitives/transitions';
import { cn } from '@mastra/playground-ui/utils/cn';

/** Starts a new rule for the board. */
export function AddRuleRow({ onAdd }: { onAdd: () => void }) {
  // A DS Button is a pill sized for toolbars; this sits in a rule row's height and shape.
  return (
    <li>
      <button
        type="button"
        onClick={onAdd}
        className={cn(
          'text-foreground hover:bg-fill-hover flex h-5.5 items-center gap-1.5 rounded-md pr-1.5',
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
