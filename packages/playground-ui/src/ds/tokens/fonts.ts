export const TextRoles = [
  'display',
  'title',
  'heading',
  'subheading',
  'body',
  'label',
  'card-title',
  'card-title-tight',
  'card-title-strong',
  'body-sm',
  'column',
  'caption',
  'meta',
] as const;

export type TextRole = (typeof TextRoles)[number];

/** SVG/canvas text can't read CSS tokens; these mirror `meta` (10px) and `caption` (12px). */
export const CHART_TICK_FONT_SIZE = 10;
export const CHART_LABEL_FONT_SIZE = 12;
