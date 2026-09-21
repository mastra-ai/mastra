import { extendTailwindMerge } from 'tailwind-merge';
import * as Tokens from '../ds/tokens';

const colorKeys = Object.keys({ ...Tokens.Colors, ...Tokens.BorderColors });
const spacingKeys = Object.keys(Tokens.Spacings);
const fontSizeKeys = Object.keys(Tokens.FontSizes);
const lineHeightKeys = Object.keys(Tokens.LineHeights);
const borderRadiusKeys = Object.keys(Tokens.BorderRadius);
const sizeKeys = Object.keys(Tokens.Sizes);
const shadowKeys = Object.keys(Tokens.Shadows).concat(Object.keys(Tokens.Glows));
const durationKeys = Object.keys(Tokens.Durations);

export const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      color: colorKeys,
      spacing: spacingKeys,
      radius: borderRadiusKeys,
      leading: lineHeightKeys,
      shadow: shadowKeys,
    },
    classGroups: {
      'font-size': [{ text: fontSizeKeys }],
      // Named durations are `@utility` rules, so tailwind-merge cannot infer them and
      // would otherwise let `duration-fast` and `duration-slow` both survive a merge.
      duration: [{ duration: durationKeys }],
      h: [{ h: sizeKeys }],
      w: [{ w: sizeKeys }],
      size: [{ size: sizeKeys }],
      'min-h': [{ 'min-h': sizeKeys }],
      'min-w': [{ 'min-w': sizeKeys }],
      'max-h': [{ 'max-h': sizeKeys }],
      'max-w': [{ 'max-w': sizeKeys }],
    },
  },
});
