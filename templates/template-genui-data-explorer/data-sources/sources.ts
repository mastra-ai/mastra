import { SalesSource } from "./sales/source.ts";
import { resolve } from "node:path";
import type { SourceRegistration, SourceSettings } from "./source.ts";

export function salesPath(settings: SourceSettings): string {
  if (
    Object.keys(settings).some((key) => key !== "path") ||
    (settings.path !== undefined && (typeof settings.path !== "string" || !settings.path))
  )
    throw new Error("Sales settings accept only a nonempty database path.");
  return resolve(typeof settings.path === "string" ? settings.path : ".data/sales.sqlite");
}
export const defaultSourceId = "sales";
export const sources: readonly SourceRegistration[] = [
  {
    id: "sales",
    open: async (settings) => {
      return new SalesSource(salesPath(settings));
    },
  },
];
