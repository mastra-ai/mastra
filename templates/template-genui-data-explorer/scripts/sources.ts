import { resolve } from "node:path";
import type { SourceRegistration, SourceSettings } from "../data-sources/source.ts";
import { selectSource } from "../data-sources/registry.ts";

export interface OperationalSource extends SourceRegistration {
  prepare?(settings: SourceSettings): Promise<void>;
}

function salesPath(settings: SourceSettings): string {
  if (
    Object.keys(settings).some((key) => key !== "path") ||
    (settings.path !== undefined && (typeof settings.path !== "string" || !settings.path))
  )
    throw new Error("Sales settings accept only a nonempty database path.");
  return resolve(typeof settings.path === "string" ? settings.path : ".data/sales.sqlite");
}

// CLI composition: replace this explicit registration and its preparation when adapting the template.
export const defaultSourceId = "sales";
export const sources: readonly OperationalSource[] = [
  {
    id: "sales",
    open: async (settings) => {
      const path = salesPath(settings);
      const { SalesSource } = await import("../data-sources/sales/source.ts");
      return new SalesSource(path);
    },
    prepare: async (settings) => {
      const path = salesPath(settings);
      const { initializeSales } = await import("./initialize.ts");
      await initializeSales(path);
    },
  },
];

export async function prepareSource(
  registrations: readonly OperationalSource[],
  id: string,
  settings: SourceSettings = {},
): Promise<void> {
  await selectSource(registrations, id).prepare?.(settings);
}
