import { cn } from '@/lib/utils';

// Ghost icon button shared by the collapsed-panel hint (desktop) and the
// panel drawer trigger (mobile), so both edges read as the same affordance.
export const panelIconButtonClass = cn(
  'flex size-8 cursor-pointer items-center justify-center rounded-full',
  'border border-transparent bg-transparent text-gray-10 hover:bg-gray-alpha-1 hover:text-gray-10 active:bg-gray-alpha-3',
  'transition-colors duration-150 ease-out-custom motion-reduce:transition-none',
  'focus-visible:border-green-7 focus-visible:outline-hidden',
);
