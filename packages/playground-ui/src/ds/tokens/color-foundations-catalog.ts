import { BorderColors, Colors } from './colors';

const rawColorTokens = [
  ...Array.from({ length: 3 }, (_, index) => `background-${index + 1}`),
  ...Array.from({ length: 10 }, (_, index) => `gray-${index + 1}`),
  ...Array.from({ length: 10 }, (_, index) => `gray-alpha-${index + 1}`),
];

const surfaceColorTokens = [
  'field-on-surface',
  'field-rim',
  'field-rim-focus',
  'field-rim-on-surface',
  'inset-highlight',
  'inset-rim',
  'surface-rim',
];

const variableNameFromReference = (reference: string) => reference.slice('var(--'.length, -1);

export const colorFoundationTokens = [
  ...Object.values(Colors).map(variableNameFromReference),
  ...Object.values(BorderColors).map(variableNameFromReference),
  ...rawColorTokens,
  ...surfaceColorTokens,
].toSorted((left, right) => left.localeCompare(right, undefined, { numeric: true }));
