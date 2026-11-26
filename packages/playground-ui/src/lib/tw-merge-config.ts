import { extendTailwindMerge, validators } from 'tailwind-merge';
import * as Tokens from '../ds/tokens';

const colorKeys = Object.keys({ ...Tokens.Colors, ...Tokens.BorderColors });
const borderRadiusKeys = Object.keys(Tokens.BorderRadius);
const sizeKeys = Object.keys(Tokens.Sizes);
const shadowKeys = Object.keys(Tokens.Shadows);
const { isArbitraryValue } = validators;

export const twMerge = extendTailwindMerge<'scrollbar-inset'>({
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
      // Same for the radius-keyed `scrollbar-inset-*` utility: the later step wins.
      'scrollbar-inset': [{ 'scrollbar-inset': [...borderRadiusKeys, isArbitraryValue] }],
    },
  },
});
