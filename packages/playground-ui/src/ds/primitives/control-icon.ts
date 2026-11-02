import { cn } from '@/lib/utils';

// The one rule for the icons inside an interactive control (a Button, a field, a chip segment,
// a menu row): `--control-icon-rest` at rest, `--control-icon-hover` while hovered, back to rest
// when disabled. A control only ever chooses the two colours (theme.css sets the defaults),
// never its own hover rule, so every control answers hover the same way by construction.
// An icon on a neutral surface steps back with a colour token rather than opacity: opacity dims
// against whatever sits behind the control, so the same glyph would clear contrast on one
// surface and fail on another.
export const controlIconState = cn(
  '[--control-icon:var(--control-icon-rest)] [&_svg]:text-(color:--control-icon)',
  'not-disabled:hover:[--control-icon:var(--control-icon-hover)] aria-disabled:[--control-icon:var(--control-icon-rest)]',
  // An icon-only Button's glyph is its label, so it brightens like a label does.
  'data-[shape=icon]:[--control-icon-hover:var(--foreground)]',
);

/** The same for a bare-glyph control that is not a Button (a chip's ×). */
export const controlIconOnly = '[--control-icon-hover:var(--foreground)]';
