/**
 * A quiet control that resolves to ink when pointed at — the two-tone rule
 * every row, nav item and icon button follows. Colour is the only thing a
 * hover animates (see `controlStateColorTransition`).
 *
 * Size and weight are not here: they arrive as one `text-<role>` class from
 * the roles in theme/typography.css, so a component never assembles a text style.
 */
export const quietTextHover = 'text-muted-foreground hover:text-foreground';

/** Same rule, driven by the hover of an enclosing `group`. */
export const quietTextHoverInGroup = 'text-muted-foreground group-hover:text-foreground';
