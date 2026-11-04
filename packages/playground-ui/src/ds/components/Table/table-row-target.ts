import type { TableVariant } from './table-context';

const stretchedTargetStyles = [
  "outline-none after:absolute after:inset-0 after:content-['']",
  'focus-visible:after:outline-1 focus-visible:after:-outline-offset-1 focus-visible:after:outline-border-focus focus-visible:after:outline-solid',
];

export function tableRowTargetStyles(variant: TableVariant) {
  if (variant === 'inset') return stretchedTargetStyles;
  return [];
}
