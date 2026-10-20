import { useMemo } from 'react';
import { TraceColumnsMenu } from '../trace-columns-menu';
import { useTraceUsageColumns, useTracesColumns, useTracesConfig } from './traces-explorer-context';
import { useTracesDiscovery } from './use-traces-discovery';

export function TracesExplorerColumnsMenu() {
  const columns = useTracesColumns();
  const { withQueryTrace } = useTracesConfig();
  const { usageDisabledReason } = useTraceUsageColumns();
  const { fields: metadataFields } = useTracesDiscovery();

  // Metadata columns read top-level keys only, so nested paths collapse to their first segment.
  const availableMetadataKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const field of metadataFields) {
      const key = field.path.replace(/^metadata\./, '').split('.')[0];
      if (key) keys.add(key);
    }
    return [...keys].sort();
  }, [metadataFields]);

  return (
    <TraceColumnsMenu
      preferences={columns.preferences}
      availableMetadataKeys={availableMetadataKeys}
      usageDisabledReason={usageDisabledReason}
      withQueryTrace={withQueryTrace}
      onToggleColumn={columns.toggleColumn}
      onAddCustomColumn={columns.addCustomColumn}
      onRemoveCustomColumn={columns.removeCustomColumn}
      onAddMetadataColumn={columns.addMetadataColumn}
      onRemoveMetadataColumn={columns.removeMetadataColumn}
      onReset={columns.resetColumns}
    />
  );
}
