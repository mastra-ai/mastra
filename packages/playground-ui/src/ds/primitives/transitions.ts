import { controlFocusStyle } from './form-element';

export const transitions = {
  colors: 'transition-colors duration-normal ease-out-custom',

  transform: 'transition-transform duration-normal ease-out-custom',

  all: 'transition-all duration-normal ease-out-custom',

  opacity: 'transition-opacity duration-normal ease-out-custom',

  shadow: 'transition-shadow duration-normal ease-out-custom',

  allSlow: 'transition-all duration-slow ease-out-custom',
} as const;

export const hoverEffects = {
  scale: 'hover:scale-[1.02] active:scale-[0.98]',

  scaleSubtle: 'active:scale-[0.98]',

  brightness: 'hover:brightness-110',

  lift: 'hover:bg-surface4',
} as const;

export const focusRing = {
  default: 'focus:outline-hidden focus:ring-1 focus:ring-accent1 focus:shadow-focus-ring',

  simple: 'focus:outline-hidden focus:ring-1 focus:ring-accent1',

  visible: controlFocusStyle,
} as const;

export type TransitionPreset = keyof typeof transitions;
export type HoverEffect = keyof typeof hoverEffects;
export type FocusRingStyle = keyof typeof focusRing;
