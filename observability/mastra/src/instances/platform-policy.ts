import type { ObservabilityExporter } from '@mastra/core/observability';
import { DefaultExporter } from '../exporters/default';
import { MastraStorageExporter } from '../exporters/mastra-storage';

const MASTRA_BUILT_IN_STORAGE_EXPORTER_NAMES = new Set([
  'mastra-storage-exporter',
  'mastra-default-observability-exporter',
]);

export function isMastraPlatformDeployment(): boolean {
  return Boolean(process.env.MASTRA_DEPLOYMENT_ID);
}

export function isMastraBuiltInStorageExporter(exporter: ObservabilityExporter): boolean {
  return (
    exporter instanceof MastraStorageExporter ||
    exporter instanceof DefaultExporter ||
    MASTRA_BUILT_IN_STORAGE_EXPORTER_NAMES.has(exporter.name)
  );
}
