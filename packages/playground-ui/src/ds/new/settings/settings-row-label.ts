/**
 * A disabled or view-only row keeps its label color; the control (or a view-only row's value) shows that it can't change. Shared with the
 * deprecated `Section` rows.
 */
export function settingsRowLabelClassName(tone: 'default' | 'destructive' = 'default') {
  return tone === 'destructive'
    ? 'text-destructive-foreground data-disabled:text-destructive-foreground'
    : 'data-disabled:text-foreground';
}
