import { controlStateColorTransition } from '@/ds/primitives/transitions';
import { quietTextHover } from '@/ds/primitives/typography';
import { cn } from '@/lib/utils';

// Ghost icon button shared by the collapsed-panel hint (desktop) and the
// panel drawer trigger (mobile), so both edges read as the same affordance.
export const panelIconButtonClass = cn(
  'flex size-8 cursor-pointer items-center justify-center rounded-full',
  'border border-transparent bg-transparent hover:bg-neutral6/5 active:bg-neutral6/10',
  quietTextHover,
  controlStateColorTransition,
  'focus-visible:border-accent1 focus-visible:outline-hidden',
);
