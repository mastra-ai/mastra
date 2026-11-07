// On small screens a Base UI popup pins to the bottom edge as a sheet; from `sm` up it stays anchored to its trigger.
// Base UI positions the popup with inline styles, so the positioner overrides need `!`.
export const mobileSheetPositionerClass =
  'max-sm:fixed! max-sm:inset-x-0! max-sm:top-auto! max-sm:bottom-0! max-sm:left-0! max-sm:transform-none!';

export const mobileSheetPopupClass =
  'max-sm:w-full max-sm:max-w-none max-sm:rounded-b-none max-sm:pb-[env(safe-area-inset-bottom)] max-sm:data-[open]:zoom-in-100 max-sm:data-[open]:slide-in-from-bottom-8 max-sm:data-[closed]:zoom-out-100 max-sm:data-[closed]:slide-out-to-bottom-8';
