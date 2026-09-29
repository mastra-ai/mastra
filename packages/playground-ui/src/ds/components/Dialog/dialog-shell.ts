import { dialogSurfaceStyle } from '@/ds/primitives/raised-surface';

export type DialogSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';

export const dialogOverlayClassName = 'dialog-backdrop-motion fixed inset-0 z-50 bg-scrim backdrop-blur-xs';

export const dialogPopupClassName = [
  'dialog-popup-motion fixed top-1/2 left-1/2 z-50 flex w-[calc(100%-2rem)] -translate-1/2 flex-col rounded-xl py-3 outline-hidden',
  '[&>form]:flex [&>form]:min-h-0 [&>form]:flex-1 [&>form]:flex-col [&>form]:gap-0',
  dialogSurfaceStyle,
].join(' ');

export const dialogContentSizeClasses: Record<DialogSize, string> = {
  sm: 'max-h-[calc(100dvh-4rem)] max-w-sm',
  md: 'max-h-[calc(100dvh-4rem)] max-w-lg',
  lg: 'max-h-[calc(100dvh-4rem)] max-w-2xl',
  xl: 'max-h-[calc(100dvh-4rem)] max-w-4xl',
  full: 'h-[calc(100dvh-2rem)]',
};
