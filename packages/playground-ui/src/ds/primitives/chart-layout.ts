/**
 * Shared plot geometry for the metrics charts.
 *
 * Recharts reserves a 30px band under the plot for x-axis labels by default; our labels are
 * 11px, so most of that band was empty and the card's bottom padding looked about three times
 * its top. `X_AXIS_HEIGHT` fits the band to the label, and the bottom margin is 0 so the card's
 * own padding is the only space below. No side margins: `ChartTimeTick` keeps the outer labels
 * inside the plot, so the plot lines up with the card's content. The top margin keeps a peak's
 * rounded corner and an active dot clear of the card's top bar.
 */
export const CHART_MARGIN = { top: 8, right: 0, bottom: 0, left: 0 };

export const X_AXIS_HEIGHT = 22;

/** Axis labels of the metrics charts: 11px in the body font, muted. */
export const CHART_AXIS_FONT_SIZE = 11;
