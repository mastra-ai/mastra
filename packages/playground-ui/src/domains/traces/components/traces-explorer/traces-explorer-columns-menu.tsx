import { TraceColumnsMenu } from '../trace-columns-menu';
import { useTraceUsageColumns, useTracesColumns, useTracesConfig } from './traces-explorer-context';

export function TracesExplorerColumnsMenu() {
  const columns = useTracesColumns();
  const { availableMetadataKeys, withQueryTrace } = useTracesConfig();
  const { usageDisabledReason } = useTraceUsageColumns();

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
