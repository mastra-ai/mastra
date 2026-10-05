import { defaultSourceId, sources } from "../../data-sources/sources.ts";
import { selectSource } from "../../data-sources/registry.ts";
import { components, validateCatalog } from "../ui/catalog.ts";

/** Optional deployment selections reuse the same typed registration surfaces as extensions. */
export function runtimeConfiguration() {
  const sourceId = process.env.SOURCE_ID ?? defaultSourceId;
  selectSource(sources, sourceId);
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
  const catalog = validateCatalog(
    selected
      ? components.map((entry) => ({ ...entry, enabled: selected.includes(entry.id) }))
      : components,
  );
  return { sourceId, catalog };
}
