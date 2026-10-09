// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createPlatformProxy } from '../../runtime/platform-proxy.js';
import type { ProviderToolsOptions } from '../../toolset.js';
import { applyToolFilter } from '../../toolset.js';
import { archiveConversionEventTool } from './tools/archive-conversion-event.js';
import { batchRunReportsTool } from './tools/batch-run-reports.js';
import { createConversionEventTool } from './tools/create-conversion-event.js';
import { createDataStreamTool } from './tools/create-data-stream.js';
import { createPropertyTool } from './tools/create-property.js';
import { getMetadataTool } from './tools/get-metadata.js';
import { runPivotReportTool } from './tools/run-pivot-report.js';
import { runRealtimeReportTool } from './tools/run-realtime-report.js';
import { runReportTool } from './tools/run-report.js';
import { updateDataStreamTool } from './tools/update-data-stream.js';
import { updatePropertyTool } from './tools/update-property.js';

export function createGoogleAnalyticsTools(options?: ProviderToolsOptions) {
  const platformProxy = createPlatformProxy({ connectionId: options?.connectionId, client: options?.client });
  const tools = {
    google_analytics_archive_conversion_event: archiveConversionEventTool(platformProxy),
    google_analytics_batch_run_reports: batchRunReportsTool(platformProxy),
    google_analytics_create_conversion_event: createConversionEventTool(platformProxy),
    google_analytics_create_data_stream: createDataStreamTool(platformProxy),
    google_analytics_create_property: createPropertyTool(platformProxy),
    google_analytics_get_metadata: getMetadataTool(platformProxy),
    google_analytics_run_pivot_report: runPivotReportTool(platformProxy),
    google_analytics_run_realtime_report: runRealtimeReportTool(platformProxy),
    google_analytics_run_report: runReportTool(platformProxy),
    google_analytics_update_data_stream: updateDataStreamTool(platformProxy),
    google_analytics_update_property: updatePropertyTool(platformProxy),
  };
  return applyToolFilter(tools, { allowTools: options?.allowTools, disallowTools: options?.disallowTools });
}
