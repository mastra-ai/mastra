/** The frame's corners: the inset's `rounded-xl` plus the frame's 4px padding, shared by the section rows. */
export const ONBOARDING_FRAME_RADIUS = 'rounded-[calc(var(--radius-xl)+--spacing(1))]';

/**
 * Below 900px the primary action is pinned to a bottom bar. `position: fixed` resolves against the
 * viewport only while no ancestor carries a `transform` or `filter`, so section transitions fade opacity only.
 */
export const ONBOARDING_PINNED_PRIMARY =
  'max-[899px]:fixed max-[899px]:inset-x-0 max-[899px]:bottom-0 max-[899px]:z-20 max-[899px]:bg-linear-to-b max-[899px]:from-transparent max-[899px]:to-background max-[899px]:to-40% max-[899px]:px-4 max-[899px]:pt-8 max-[899px]:pb-[max(1rem,env(safe-area-inset-bottom))] max-[899px]:[&>button]:h-12 max-[899px]:[&>button]:w-full';
