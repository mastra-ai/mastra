import { resolve } from "node:path";
import type { MastraModelConfig } from "@mastra/core/llm";
import { defaultSourceId, sources } from "../../data-sources/sources.ts";
import { selectSource } from "../../data-sources/registry.ts";
import { components, validateCatalog } from "../components/catalog.ts";

export const sourceId = process.env.SOURCE_ID ?? defaultSourceId;
selectSource(sources, sourceId);

export const dataDirectory = resolve(
  process.env.TEMPLATE_DIRECTORY ?? process.cwd(),
  process.env.DATA_DIRECTORY ?? ".data",
);

export const model: MastraModelConfig = {
  providerId: "openai",
  modelId: process.env.ANALYSIS_MODEL ?? "gpt-4.1-mini",
  ...(process.env.ANALYSIS_BASE_URL
    ? { url: process.env.ANALYSIS_BASE_URL, api: "chat" as const }
    : {}),
};

/** Enable a deployment's chosen entries from the shared component catalog. */
function enabledComponents() {
  const selected = process.env.UI_COMPONENT_IDS?.split(",").map((id) => id.trim());
  if (
    selected &&
    (!selected.length ||
      new Set(selected).size !== selected.length ||
      selected.some((id) => !components.some((entry) => entry.id === id)))
  )
    throw new Error(
      "UI_COMPONENT_IDS must name unique registered components. Clear it to restore the default catalog and retry.",
    );
  return validateCatalog(
    selected
      ? components.map((entry) => ({ ...entry, enabled: selected.includes(entry.id) }))
      : components,
  );
}
export const catalog = enabledComponents();

export const workspaceOptions = {
  sourceId,
  catalog,
  model,
  settings: { path: resolve(dataDirectory, "sales.sqlite") },
  workspacePath: resolve(dataDirectory, "workspace.sqlite"),
  memoryPath: resolve(dataDirectory, "memory.sqlite"),
  telemetryPath: resolve(dataDirectory, "telemetry.sqlite"),
};
