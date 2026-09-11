import type { ObservabilityExporter } from '@mastra/core/observability';
import { DefaultExporter } from '../exporters/default';
import { MastraStorageExporter } from '../exporters/mastra-storage';

export function isMastraPlatformDeployment(): boolean {
  return Boolean(process.env.MASTRA_DEPLOYMENT_ID);
}

export function isMastraBuiltInStorageExporter(exporter: ObservabilityExporter): boolean {
  return exporter instanceof MastraStorageExporter || exporter instanceof DefaultExporter;
}
