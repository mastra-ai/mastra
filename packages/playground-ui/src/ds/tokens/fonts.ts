// Every `--text-*` role in `theme/typography.css`, in scale order. `lib/tw-merge-config.ts`
// turns this list into the `font-size` conflict group, so one role class cleanly replaces
// another in `cn()`; a role added to the CSS and missing here silently stops deduping.
// `theme-export.test.ts` holds the two sides in step.
//
// A role is a complete text style: the size arrives with the weight, line height and
// tracking declared beside it in the CSS. Components pick a role; they never assemble one,
// and nothing mirrors those values here — the foundations story reads them off the element.
export const TextRoles = [
  'display',
  'title',
  'heading',
  'subheading',
  'body',
  'label',
  'body-sm',
  'column',
  'caption',
  'meta',
] as const;

export type TextRole = (typeof TextRoles)[number];

/** SVG/canvas text can't read CSS tokens; these mirror `meta` (10px) and `caption` (12px). */
export const CHART_TICK_FONT_SIZE = 10;
export const CHART_LABEL_FONT_SIZE = 12;
