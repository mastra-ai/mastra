import { Txt } from '@mastra/playground-ui/components/Txt';
import { IconCircleDashed } from '@mastra/playground-ui/icons/central/IconCircleDashed';

import type { InstalledBoardInfo } from '../../../../../api/types';
import { phaseName } from '../../../boardRules/ruleTargets';

/** A new rule being made for the board, shown in place until it is saved. */
export function NewRuleRow({ into, board }: { into: string | undefined; board: InstalledBoardInfo | undefined }) {
  return (
    <li className="border-border-strong flex h-5.5 items-center gap-1.5 rounded-md border border-dashed px-1.5">
      <IconCircleDashed className="text-muted-foreground size-icon-xs shrink-0" aria-hidden />
      <Txt as="span" variant="caption" tone="ink" className="flex-1">
        New rule
      </Txt>
      <Txt as="span" variant="caption" tone="muted">
        {(into && phaseName(board, into)) ?? 'Pick a phase'}
      </Txt>
    </li>
  );
}
