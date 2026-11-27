import { Txt } from '@/ds/components/Txt';
import { IconCircleDashed } from '@/ds/icons/central/IconCircleDashed';

/** A new rule being made for the board, shown in place until it is saved. */
export function NewRuleRow({
  phase,
}: {
  /** The name of the phase it files into; undefined until one is picked or when the phase is unknown. */
  phase: string | undefined;
}) {
  return (
    <li className="flex h-5.5 items-center gap-1.5 rounded-md border border-dashed border-border-strong px-1.5">
      <IconCircleDashed className="size-icon-xs shrink-0 text-muted-foreground" aria-hidden />
      <Txt as="span" variant="caption" tone="ink" className="flex-1">
        New rule
      </Txt>
      <Txt as="span" variant="caption" tone="muted">
        {phase ?? 'Pick a phase'}
      </Txt>
    </li>
  );
}
