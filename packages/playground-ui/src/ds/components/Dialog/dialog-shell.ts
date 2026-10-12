import { dialogSurfaceStyle } from '@/ds/primitives/raised-surface';

export type DialogSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';

export const DIALOG_DRAWER_BREAKPOINT_PX = 640;

const formFillsShellClassName = '[&>form]:flex [&>form]:min-h-0 [&>form]:flex-1 [&>form]:flex-col [&>form]:gap-0';

export const dialogPopupClassName = [
  'dialog-popup-motion fixed top-1/2 left-1/2 z-50 flex w-[calc(100%-2rem)] -translate-1/2 flex-col rounded-xl py-3 outline-hidden',
  formFillsShellClassName,
  dialogSurfaceStyle,
].join(' ');

export const dialogContentSizeClasses: Record<DialogSize, string> = {
  sm: 'max-h-[calc(100dvh-4rem)] max-w-sm',
  md: 'max-h-[calc(100dvh-4rem)] max-w-lg',
  lg: 'max-h-[calc(100dvh-4rem)] max-w-2xl',
  xl: 'max-h-[calc(100dvh-4rem)] max-w-4xl',
  full: 'h-[calc(100dvh-2rem)]',
};

// 3rem = the drawer's swipe bleed (`-mb-12` / drawer.css `--bleed`), hidden below the screen edge.
export const dialogDrawerPopupClassName = ['max-h-[calc(85dvh+3rem)] pb-3', formFillsShellClassName].join(' ');

// An element, not padding, so call-site padding classes cannot pull content into the hidden bleed.
export const dialogDrawerBleedSpacerClassName = 'h-[calc(3rem+env(safe-area-inset-bottom))] shrink-0';

export const dialogDrawerFullHeightClassName = 'h-[calc(85dvh+3rem)]';
