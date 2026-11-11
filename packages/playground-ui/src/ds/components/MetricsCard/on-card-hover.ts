/**
 * Classes for a `MetricsCard.Action` (or another control in the card's actions) that waits for the
 * card's hover, keyboard focus or open menu. The card is a `group/metrics-card`. At rest the control
 * is transparent and out of the row's flow, so it takes no room, yet it stays in the tab order:
 * tabbing to it reveals it. It fades in only as it shows, so it doesn't drift while fading out.
 */
export const onCardHover =
  'pointer-events-none absolute opacity-0 ' +
  'group-hover/metrics-card:pointer-events-auto group-hover/metrics-card:static group-hover/metrics-card:opacity-100 motion-safe:group-hover/metrics-card:transition-opacity ' +
  'group-focus-within/metrics-card:pointer-events-auto group-focus-within/metrics-card:static group-focus-within/metrics-card:opacity-100 motion-safe:group-focus-within/metrics-card:transition-opacity ' +
  'group-has-data-popup-open/metrics-card:pointer-events-auto group-has-data-popup-open/metrics-card:static group-has-data-popup-open/metrics-card:opacity-100';
