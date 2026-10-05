import { extendTailwindMerge, validators } from 'tailwind-merge';
import * as Tokens from '../ds/tokens';

const { isArbitraryLength, isNumber } = validators;

const colorKeys = Object.keys({ ...Tokens.Colors, ...Tokens.BorderColors });
const borderRadiusKeys = Object.keys(Tokens.BorderRadius);
const sizeKeys = Object.keys(Tokens.Sizes);
const shadowKeys = Object.keys(Tokens.Shadows);

type ConcentricClassGroup = 'concentric-frame' | 'concentric-inset';

export const twMerge = extendTailwindMerge<ConcentricClassGroup>({
  extend: {
    theme: {
      color: colorKeys,
      // Numeric rungs come off one multiplier, which tailwind-merge already
      // understands; the named rungs (`control-md`, `avatar-lg`) are the spacing
      // scale, so registering them here covers every utility that reads it —
      // h/w/size/min-*/max-* as well as p/m/gap.
      spacing: sizeKeys,
      radius: borderRadiusKeys,
      shadow: shadowKeys,
    },
    classGroups: {
      'font-size': [{ text: [...Tokens.TextRoles] }],
      // Named durations are `@utility` rules, so tailwind-merge cannot infer them and
      // would otherwise let `duration-fast` and `duration-slow` both survive a merge.
      duration: [{ duration: [...Tokens.Durations] }],
      rounded: [{ rounded: ['concentric'] }],
      'concentric-frame': [{ 'concentric-frame': [...borderRadiusKeys, isArbitraryLength] }],
      'concentric-inset': [{ 'concentric-inset': [isNumber] }],
    },
    conflictingClassGroups: {
      'concentric-frame': [
        'rounded',
        'rounded-s',
        'rounded-e',
        'rounded-t',
        'rounded-r',
        'rounded-b',
        'rounded-l',
        'rounded-ss',
        'rounded-se',
        'rounded-ee',
        'rounded-es',
        'rounded-tl',
        'rounded-tr',
        'rounded-br',
        'rounded-bl',
      ],
      'concentric-inset': ['p', 'px', 'py', 'ps', 'pe', 'pbs', 'pbe', 'pt', 'pr', 'pb', 'pl'],
    },
  },
});
