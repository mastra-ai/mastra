import { Button } from '@mastra/playground-ui/components/Button';
import { IconPlusMedium } from '@mastra/playground-ui/icons/central/IconPlusMedium';
import { focusRing } from '@mastra/playground-ui/primitives/transitions';
import { cn } from '@mastra/playground-ui/utils/cn';
import type { BoardStageId } from '../stages';

export interface BoardStageCreate {
  expanded: boolean;
  triggerRef: (element: HTMLButtonElement | null) => void;
  onOpen: () => void;
}

const REVEAL =
  'text-muted-foreground hover:text-foreground flex shrink-0 cursor-pointer items-center justify-center rounded-sm opacity-0 transition-[opacity,color] duration-200 ease-out motion-reduce:transition-none group-data-hovered/column:opacity-100 focus-visible:opacity-100 aria-expanded:opacity-100 pointer-coarse:opacity-100';

/**
 * Opens a stage's composer. `icon` is a plain button for list group headers. `row` is a full-width strip atop a board column's
 * cards, a plus between hairlines fading out to the edges, in the space the header gave up; `column` is a plus under a collapsed column's label. Both show only while the
 * pointer is on the column.
 */
export function BoardStageCreateButton({
  stage,
  shape,
  expanded,
  triggerRef,
  onOpen,
}: BoardStageCreate & {
  stage: { id: BoardStageId; label: string };
  shape: 'icon' | 'row' | 'column';
}) {
  const label = `Create work item in ${stage.label}`;
  const shared = {
    ref: triggerRef,
    type: 'button',
    'aria-label': label,
    title: label,
    'aria-expanded': expanded,
    'aria-controls': `new-work-item-${stage.id}`,
    onClick: onOpen,
  } as const;

  if (shape === 'icon') {
    return (
      <Button {...shared} variant="ghost" size="icon-sm">
        <IconPlusMedium aria-hidden />
      </Button>
    );
  }

  if (shape === 'column') {
    return (
      <button {...shared} className={cn(focusRing, REVEAL, 'size-6')}>
        <IconPlusMedium aria-hidden className="size-icon-sm" />
      </button>
    );
  }

  return (
    <button {...shared} className={cn(focusRing, REVEAL, 'size-full gap-2 px-2')}>
      <span aria-hidden className="to-border-strong h-px flex-1 bg-linear-to-r from-transparent" />
      <IconPlusMedium aria-hidden className="size-icon-sm shrink-0" />
      <span aria-hidden className="to-border-strong h-px flex-1 bg-linear-to-l from-transparent" />
    </button>
  );
}
