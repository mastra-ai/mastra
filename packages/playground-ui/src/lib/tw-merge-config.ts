import { extendTailwindMerge } from 'tailwind-merge';
import * as Tokens from '../ds/tokens';

const colorKeys = Object.keys({ ...Tokens.Colors, ...Tokens.BorderColors });
const fontSizeKeys = Object.keys(Tokens.FontSizes);
const lineHeightKeys = Object.keys(Tokens.LineHeights);
const borderRadiusKeys = Object.keys(Tokens.BorderRadius);
const sizeKeys = Object.keys(Tokens.Sizes);
const shadowKeys = Object.keys(Tokens.Shadows);
const durationKeys = Object.keys(Tokens.Durations);

export const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      color: colorKeys,
      // Numeric rungs come off one multiplier, which tailwind-merge already
      // understands; the named rungs (`form-md`, `avatar-lg`) are the spacing
      // scale, so registering them here covers every utility that reads it —
      // h/w/size/min-*/max-* as well as p/m/gap.
      spacing: sizeKeys,
      radius: borderRadiusKeys,
      leading: lineHeightKeys,
      shadow: shadowKeys,
    },
    classGroups: {
      'font-size': [{ text: fontSizeKeys }],
      // Named durations are `@utility` rules, so tailwind-merge cannot infer them and
      // would otherwise let `duration-fast` and `duration-slow` both survive a merge.
      duration: [{ duration: durationKeys }],
    },
  },
});
