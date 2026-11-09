import type { SourceRegistration, SourceSettings } from "../data-sources/source.ts";
import { selectSource } from "../data-sources/registry.ts";

export interface OperationalSource extends SourceRegistration {
  prepare?(settings: SourceSettings): Promise<void>;
}

import { sources as runtimeSources, salesPath } from "../data-sources/sources.ts";
export { defaultSourceId } from "../data-sources/sources.ts";

// Operational preparation extends the same explicit runtime registrations.
export const sources: readonly OperationalSource[] = runtimeSources.map((source) => ({
  ...source,
  ...(source.id === "sales"
    ? {
        prepare: async (settings: SourceSettings) => {
          const { initializeSales } = await import("./initialize.ts");
          await initializeSales(salesPath(settings));
        },
      }
    : {}),
}));

export async function prepareSource(
  registrations: readonly OperationalSource[],
  id: string,
  settings: SourceSettings = {},
): Promise<void> {
  await selectSource(registrations, id).prepare?.(settings);
}
