export const Animations = {
  // Durations
  durationFast: '100ms',
  durationNormal: '200ms',
  durationSlow: '300ms',

  // Easings
  easeOut: 'cubic-bezier(0.33, 1, 0.68, 1)',
  easeInOut: 'cubic-bezier(0.65, 0, 0.35, 1)',
  easeSpring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
};

// Common transition presets for Tailwind
export const TransitionPresets = {
  colors: 'transition-colors duration-200 ease-out',
  transform: 'transition-transform duration-200 ease-out',
  all: 'transition-all duration-200 ease-out',
  opacity: 'transition-opacity duration-200 ease-out',
  shadow: 'transition-shadow duration-200 ease-out',
};

// Hover effects
export const HoverEffects = {
  scale: 'hover:scale-[1.02] active:scale-[0.98]',
  scaleSubtle: 'active:scale-[0.98]',
  brightness: 'hover:brightness-110',
};
