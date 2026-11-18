/**
 * A disabled or view-only row keeps its label color: only the control shows that it's disabled. Shared with the
 * deprecated `Section` rows.
 */
export function settingsRowLabelClassName(tone: 'default' | 'destructive' = 'default') {
  return tone === 'destructive'
    ? 'text-destructive-foreground data-disabled:text-destructive-foreground'
    : 'data-disabled:text-foreground';
}
