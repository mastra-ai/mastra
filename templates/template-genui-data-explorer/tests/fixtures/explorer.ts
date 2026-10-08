import type { MastraModelConfig } from "@mastra/core/llm";
import { openDataSource } from "../../data-sources/registry.ts";
import type { SourceRegistration, SourceSettings } from "../../data-sources/source.ts";
import { defaultSourceId, sources } from "../../data-sources/sources.ts";
import { DataExplorer } from "../../src/analysis/explorer.ts";

/** Server configuration is the only source-selection and model-selection surface. */
export async function createExplorer(
  options: {
    sourceId?: string;
    settings?: SourceSettings;
    registrations?: readonly SourceRegistration[];
    model?: MastraModelConfig;
  } = {},
) {
  const source = await openDataSource(
    options.registrations ?? sources,
    options.sourceId ?? defaultSourceId,
    options.settings ?? {},
  );
  try {
    return new DataExplorer(
      source,
      options.model ?? {
        providerId: "openai",
        modelId: process.env.ANALYSIS_MODEL ?? "gpt-4.1-mini",
      },
    );
  } catch (error) {
    await source.close();
    throw error;
  }
}
