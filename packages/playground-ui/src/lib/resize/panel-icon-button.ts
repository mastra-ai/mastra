import { cn } from '@/lib/utils';

// Ghost icon button shared by the collapsed-panel hint (desktop) and the
// panel drawer trigger (mobile), so both edges read as the same affordance.
export const panelIconButtonClass = cn(
  'flex size-8 cursor-pointer items-center justify-center rounded-full',
  'border border-transparent bg-transparent text-neutral5 hover:bg-neutral6/5 hover:text-neutral6 active:bg-neutral6/10',
  'transition-colors duration-150 ease-out-custom motion-reduce:transition-none',
  'focus-visible:border-accent1 focus-visible:outline-hidden',
);
