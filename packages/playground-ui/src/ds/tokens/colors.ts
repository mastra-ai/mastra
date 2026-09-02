import { FoundationColors, LegacyColors, SemanticColors } from './color-variables';

export const Colors = {
  ...FoundationColors,
  ...SemanticColors,
  ...LegacyColors,

  // Semantic state colors
  error: LegacyColors.error,

  // Overlay colors
  overlay: SemanticColors.overlay,
};

export const BorderColors = {
  border1: LegacyColors.border1,
  border2: LegacyColors.border2,
};
