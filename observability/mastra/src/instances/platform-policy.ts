import type { ObservabilityExporter } from '@mastra/core/observability';
import { DefaultExporter } from '../exporters/default';
import { MastraStorageExporter } from '../exporters/mastra-storage';

export function shouldSupersedeStorageExporters(): boolean {
  return Boolean(process.env.MASTRA_PLATFORM_ACCESS_TOKEN);
}

export function isBuiltInStorageExporter(exporter: ObservabilityExporter): boolean {
  return exporter instanceof MastraStorageExporter || exporter instanceof DefaultExporter;
}
