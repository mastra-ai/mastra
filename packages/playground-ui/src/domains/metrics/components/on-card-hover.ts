/**
 * Classes for a card's own buttons (drilldowns, alert) that wait for the card's hover, focus or
 * open menu. The card is a `group/metrics-card`; hidden, the button takes no room.
 */
export const onCardHover =
  'hidden group-hover/metrics-card:inline-flex group-focus-within/metrics-card:inline-flex group-has-data-popup-open/metrics-card:inline-flex';
