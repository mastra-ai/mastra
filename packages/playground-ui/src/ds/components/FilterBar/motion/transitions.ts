import type { Transition } from 'motion/react';

export const filterTransition: Transition = {
  layout: { type: 'spring', visualDuration: 0.22, bounce: 0.04 },
  opacity: { duration: 0.1 },
  filter: { duration: 0.12 },
  default: { type: 'spring', visualDuration: 0.2, bounce: 0.04 },
};

export const filterEnter = { opacity: 0, scale: 0.96, y: 2, filter: 'blur(2px)' };
export const filterVisible = { opacity: 1, scale: 1, y: 0, filter: 'blur(0px)' };
export const filterExit = { opacity: 0, scale: 0.95, y: -2, filter: 'blur(2px)' };
