function colorVar(name: string): string {
  return `rgb(var(--color-${name}) / <alpha-value>)`;
}

function colorVarWithAlpha(name: string): string {
  return `rgb(var(--color-${name}) / var(--color-${name}-alpha))`;
}

export const Colors = {
  surface1: colorVar('surface1'),
  surface2: colorVar('surface2'),
  surface3: colorVar('surface3'),
  surface4: colorVar('surface4'),
  surface5: colorVar('surface5'),
  accent1: colorVar('accent1'),
  accent2: colorVar('accent2'),
  accent3: colorVar('accent3'),
  accent5: colorVar('accent5'),
  accent6: colorVar('accent6'),
  accent1Dark: colorVar('accent1Dark'),
  accent2Dark: colorVar('accent2Dark'),
  accent3Dark: colorVar('accent3Dark'),
  accent5Dark: colorVar('accent5Dark'),
  accent6Dark: colorVar('accent6Dark'),
  accent1Darker: colorVar('accent1Darker'),
  accent2Darker: colorVar('accent2Darker'),
  accent3Darker: colorVar('accent3Darker'),
  accent5Darker: colorVar('accent5Darker'),
  accent6Darker: colorVar('accent6Darker'),
  neutral1: colorVar('neutral1'),
  neutral2: colorVar('neutral2'),
  neutral3: colorVar('neutral3'),
  neutral4: colorVar('neutral4'),
  neutral5: colorVar('neutral5'),
  neutral6: colorVar('neutral6'),
  error: colorVar('error'),
  overlay: colorVarWithAlpha('overlay'),
};

export const BorderColors = {
  border1: colorVarWithAlpha('border1'),
  border2: colorVarWithAlpha('border2'),
};
