import { formElementBorder } from './form-element';

// Base styles for dropdown content (Select, Popover)
export const dropdownContentBase = `rounded-md ${formElementBorder} bg-surface3 text-neutral5 shadow-md`;

// Animation classes for dropdown open/close transitions
export const dropdownAnimations = [
  'data-[state=open]:animate-in data-[state=closed]:animate-out',
  'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
  'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
  'data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2',
  'data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
].join(' ');

// Combined base + animations for full dropdown content styling
export const dropdownContent = `${dropdownContentBase} ${dropdownAnimations}`;
