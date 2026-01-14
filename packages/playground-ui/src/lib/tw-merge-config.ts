import { extendTailwindMerge } from 'tailwind-merge';
import * as Tokens from '../ds/tokens';

const colorKeys = Object.keys({ ...Tokens.Colors, ...Tokens.BorderColors });
const spacingKeys = Object.keys(Tokens.Spacings);
const fontSizeKeys = Object.keys(Tokens.FontSizes);
const lineHeightKeys = Object.keys(Tokens.LineHeights);
const borderRadiusKeys = Object.keys(Tokens.BorderRadius);
const borderWidthKeys = Object.keys(Tokens.BorderWidth);
const sizeKeys = Object.keys(Tokens.Sizes);

export const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      color: colorKeys,
      spacing: spacingKeys,
      radius: borderRadiusKeys,
      leading: lineHeightKeys,
    },
    classGroups: {
      'font-size': [{ text: fontSizeKeys }],
      'border-w': [{ border: borderWidthKeys }],
      h: [{ h: sizeKeys }],
      w: [{ w: sizeKeys }],
      'max-h': [{ 'max-h': sizeKeys }],
      'max-w': [{ 'max-w': sizeKeys }],
    },
  },
});
