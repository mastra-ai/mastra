// Text roles, mirroring the `--text-*` tokens in theme.css for consumers that
// cannot read CSS (canvas, SVG, docs tables) and for `lib/tw-merge-config.ts`,
// which turns these keys into the `font-size` conflict group so one role class
// cleanly replaces another in `cn()`.
//
// A role is a complete text style: the size here travels with the weight, line
// height and tracking declared beside it in theme.css. Components pick a role;
// they never assemble one.
export const FontSizes = {
  display: '1.375rem', // 22px / 500 — onboarding hero
  title: '1.125rem', // 18px / 500 — page title
  heading: '1rem', // 16px / 500 — page and panel headings
  subheading: '0.875rem', // 14px / 500 — sections and cards
  body: '0.875rem', // 14px / 400 — prose and descriptions
  label: '0.8125rem', // 13px / 500 — control labels, nav items, buttons
  'body-sm': '0.8125rem', // 13px / 400 — table cells, menus, field values
  column: '0.75rem', // 12px / 500 — column headers, small strong labels
  caption: '0.75rem', // 12px / 400 — secondary copy
  meta: '0.625rem', // 10px / 500 — badges, keycaps, micro labels
};

export const LineHeights = {
  display: '127%',
  title: '133%',
  heading: '150%',
  subheading: '143%',
  body: '143%',
  label: '150%',
  'body-sm': '150%',
  column: '150%',
  caption: '150%',
  meta: '160%',
};

export const FontWeights = {
  display: 500,
  title: 500,
  heading: 500,
  subheading: 500,
  body: 400,
  label: 500,
  'body-sm': 400,
  column: 500,
  caption: 400,
  meta: 500,
};

/** SVG/canvas text can't read CSS tokens; these mirror `meta` (10px) and `caption` (12px). */
export const CHART_TICK_FONT_SIZE = 10;
export const CHART_LABEL_FONT_SIZE = 12;
