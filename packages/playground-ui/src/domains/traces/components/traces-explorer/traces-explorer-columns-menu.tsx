import { ColumnsMenu } from '../columns-menu';
import { useTracesColumns, useTracesConfig } from './traces-explorer-context';

export function TracesExplorerColumnsMenu() {
  const columns = useTracesColumns();
  const { withQueryTrace, discoveryTimeRange, metricsSupport } = useTracesConfig();

  return (
    <ColumnsMenu
      scope="traces"
      value={columns.preferences}
      onChange={columns.setPreferences}
      discoveryTimeRange={discoveryTimeRange}
      metricsSupport={metricsSupport}
      queryEnabled={withQueryTrace}
    />
  );
}
