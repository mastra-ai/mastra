import type { ReactNode } from 'react';
import { humanizeKey } from './columns-configurator';
import type { CustomColumnConfig } from './columns-configurator';

/**
 * Structural shape every list-view column def must satisfy. Generic over the
 * row item type `T` so consumers can plug in their own (`TracesListViewTrace`,
 * a logs row, etc.) without coupling this util to a specific data shape.
 */
export type GenericColumnDef<T> = {
  name: string;
  label: string;
  gridSize: string;
  renderCell: (item: T) => ReactNode;
};

export type BuildVisibleColumnDefsArgs<T> = {
  /** Currently selected column names (in user-chosen order). */
  visibleNames: string[];
  /** The columns shown by default when the user hasn't picked any yet. */
  defaultDefs: GenericColumnDef<T>[];
  /** Every built-in (default + optional/filter-field) column the picker may toggle on. */
  allBuiltInDefs: GenericColumnDef<T>[];
  /** User-defined custom columns persisted via {@link useCustomColumns}. */
  customColumns: CustomColumnConfig[];
  /**
   * Map of column name → CSS grid track size. Lookup order:
   *   widths[name] → widths.other → def.gridSize. Use fixed-rem widths on
   *   non-flex columns to avoid virtualizer-induced width jitter.
   */
  widths: Record<string, string>;
  /**
   * Valid `source` identifiers for the `source:key` fallback path used when a
   * persisted custom name isn't in `customColumns` (e.g. picker hasn't
   * re-registered it yet after a refresh). Pass the same identifiers used by
   * `customColumnSources` on the configurator.
   */
  customSources?: readonly string[];
  /** Renders a cell value for a custom column. Page-owned because the lookup
   *  shape (`item.metadata[key]`, `item.attributes[key]`, …) is data-type specific. */
  renderCustomCell: (item: T, source: string, key: string) => ReactNode;
};

/**
 * Resolves the ordered list of column defs to hand to a list view given the
 * user's current picker state. Built-in columns come from `allBuiltInDefs`,
 * custom columns are materialised from `customColumns`, and any persisted
 * `source:key` name without a matching custom config falls back to a generated
 * def using `renderCustomCell`.
 */
export function buildVisibleColumnDefs<T>(args: BuildVisibleColumnDefsArgs<T>): GenericColumnDef<T>[] {
  const { visibleNames, defaultDefs, allBuiltInDefs, customColumns, widths, customSources, renderCustomCell } = args;

  const customGridSize = widths.other ?? 'minmax(5rem,1fr)';
  const withWidth = (def: GenericColumnDef<T>): GenericColumnDef<T> => ({
    ...def,
    gridSize: widths[def.name] ?? widths.other ?? def.gridSize,
  });

  if (!visibleNames || visibleNames.length === 0) return defaultDefs.map(withWidth);

  const builtInByName = new Map(allBuiltInDefs.map(c => [c.name, c] as const));
  const customByName = new Map(customColumns.map(c => [c.name, c] as const));
  const defs: GenericColumnDef<T>[] = [];

  for (const name of visibleNames) {
    const builtIn = builtInByName.get(name);
    if (builtIn) {
      defs.push(withWidth(builtIn));
      continue;
    }
    const custom = customByName.get(name);
    if (custom) {
      defs.push(
        withWidth({
          name,
          label: humanizeKey(custom.key),
          gridSize: customGridSize,
          renderCell: item => renderCustomCell(item, custom.source, custom.key),
        }),
      );
      continue;
    }
    // Fallback for a persisted custom name without a matching config:
    // infer source from the `source:key` naming convention so the column still renders.
    const sepIdx = name.indexOf(':');
    if (sepIdx > 0 && customSources && customSources.length > 0) {
      const source = name.slice(0, sepIdx);
      const key = name.slice(sepIdx + 1);
      if (customSources.includes(source)) {
        defs.push(
          withWidth({
            name,
            label: humanizeKey(key),
            gridSize: customGridSize,
            renderCell: item => renderCustomCell(item, source, key),
          }),
        );
      }
    }
  }

  return defs.length > 0 ? defs : defaultDefs.map(withWidth);
}
