import { extendTailwindMerge } from 'tailwind-merge';
import * as Tokens from '../ds/tokens';

const colorKeys = Object.keys({ ...Tokens.Colors, ...Tokens.BorderColors });
const spacingKeys = Object.keys(Tokens.Spacings);
const lineHeightKeys = Object.keys(Tokens.LineHeights);
const borderRadiusKeys = Object.keys(Tokens.BorderRadius);

export const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      color: colorKeys,
      spacing: spacingKeys,
      radius: borderRadiusKeys,
      leading: lineHeightKeys,
    },
  },
});
