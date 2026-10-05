/**
 * Shared plot geometry for the metrics charts.
 *
 * Recharts reserves a 30px band under the plot for x-axis labels by default; our labels are
 * 10px, so most of that band was empty and the card's bottom padding looked about three times
 * its top. `X_AXIS_HEIGHT` fits the band to the label, and the bottom margin is 0 so the card's
 * own padding is the only space below. The right margin leaves half a label of room, so the
 * last tick (kept by `preserveStartEnd`) is not clipped at the edge.
 */
export const CHART_MARGIN = { top: 5, right: 16, bottom: 0, left: 0 };

export const X_AXIS_HEIGHT = 20;
