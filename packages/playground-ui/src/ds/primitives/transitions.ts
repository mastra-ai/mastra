// Motion policy for interactive state (hover / press / focus)
//
// State changes are instant: a control's background, text, border and icon
// switch the moment the pointer arrives or leaves, with no transition. Hover
// fires more than any other interaction (sweeping a cursor across a nav
// crosses ten rows a second), and any fade leaves the surface trailing the
// pointer. Nothing follows the pointer between items either: each row paints
// its own hover.
//
// Animate what moves or arrives instead: overlays entering, panels collapsing,
// a switch thumb travelling, a chevron turning. Those happen once per intent,
// not ten times a second. https://craft.gustavofior.com/hover-restraint

export const heightTransition = 'transition-[height] duration-normal ease-out-custom motion-reduce:transition-none';

export const transitions = {
  // For color changes (background, text, border)
  colors: 'transition-colors duration-normal ease-out-custom',
  // For transform changes (scale, translate, rotate)
  transform: 'transition-transform duration-normal ease-out-custom',
  // For all property changes
  all: 'transition-all duration-normal ease-out-custom',
  // For opacity changes
  opacity: 'transition-opacity duration-normal ease-out-custom',
  // For shadow changes
  shadow: 'transition-shadow duration-normal ease-out-custom',
  // For slower transitions (sidebar collapse, etc.)
  allSlow: 'transition-all duration-slow ease-out-custom',
} as const;

// Interactive hover effects
export const hoverEffects = {
  // Subtle scale effect for buttons and cards
  scale: 'hover:scale-[1.02] active:scale-[0.98]',
  // Even more subtle scale for active state only
  scaleSubtle: 'active:scale-[0.98]',
  // Brightness increase
  brightness: 'hover:brightness-110',
  // Background lift
  lift: 'hover:bg-foreground/10',
} as const;

// An outline, not a ring: `ring-*` rewrites box-shadow and would erase a raised surface's rim and elevation.
const focusLine = 'focus-visible:outline-1 focus-visible:outline-solid focus-visible:outline-border-focus';

export const focusRing = `${focusLine} focus-visible:outline-offset-0`;

export const focusRingInset = `${focusLine} focus-visible:-outline-offset-1`;

export const focusRingOffset = `${focusLine} focus-visible:outline-offset-2`;

export type TransitionPreset = keyof typeof transitions;
export type HoverEffect = keyof typeof hoverEffects;
