import { BorderRadius } from '@/ds/tokens';
import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

// questioning my existence
// https://github.com/dcastil/tailwind-merge/discussions/393
const borderWidthNames = [
  'border-w',
  'border-w-t',
  'border-w-r',
  'border-w-b',
  'border-w-l',
  'border-w-x',
  'border-w-y',
];
const borderWidthClassGroups = Object.fromEntries(
  borderWidthNames.map(name => [name, [{ [name.replace('border-w', 'border')]: Object.keys(BorderRadius) }]]),
);

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      ...borderWidthClassGroups,
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
