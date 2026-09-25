// Motion policy for interactive state (hover / press / open / focus)
//
// A control's BACKGROUND switches instantly; only its COLOUR fades, over
// 150ms. Hover fires more than any other interaction — sweeping a cursor
// across a nav crosses ten rows a second — and fading the fill leaves the
// surface trailing the pointer, while the colour crossfade is what stops the
// label from snapping. This is measured from Linear, whose rows carry exactly
// `transition: color 0.15s` and no background transition.
//
// Animate what moves or arrives instead: overlays entering, panels collapsing,
// a switch thumb travelling. Those happen once per intent, not ten times a
// second. https://craft.gustavofior.com/hover-restraint
export const controlStateColorTransition =
  'transition-[color] duration-fast ease-out-custom motion-reduce:transition-none';

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

// Focus ring styles
export const focusRing = {
  // Standard focus ring with glow
  default: 'focus:outline-hidden focus:ring-1 focus:ring-accent1 focus:shadow-focus-ring',
  // Focus ring without glow
  simple: 'focus:outline-hidden focus:ring-1 focus:ring-accent1',
  // Focus visible only (keyboard navigation)
  visible:
    'focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-accent1 focus-visible:shadow-focus-ring',
} as const;

export type TransitionPreset = keyof typeof transitions;
export type HoverEffect = keyof typeof hoverEffects;
export type FocusRingStyle = keyof typeof focusRing;
