import { LocalTelemetry } from "../observability/telemetry.ts";
import type { Mastra } from "@mastra/core/mastra";
import { Memory } from "@mastra/memory";
import { LibSQLStore } from "@mastra/libsql";
import type { MastraModelConfig } from "@mastra/core/llm";
import type { SourceSettings, SourceRegistration } from "../../data-sources/source.ts";
import { openDataSource } from "../../data-sources/registry.ts";
import { defaultSourceId, sources } from "../../data-sources/sources.ts";
import { DataExplorer } from "../analysis/explorer.ts";
import { components } from "../components/catalog.ts";

import type { ComponentDeclaration } from "../components/catalog.ts";

import { WorkspaceStore } from "./store.ts";
import { WorkspaceEngine } from "./engine.ts";

export async function createWorkspace(options: {
  sourceId?: string;
  registrations?: readonly SourceRegistration[];
  settings?: SourceSettings;
  workspacePath: string;
  memoryPath: string;
  telemetryPath?: string;
  model?: MastraModelConfig;
  catalog?: readonly ComponentDeclaration[];
  mastra?: Mastra;
}) {
  const source = await openDataSource(
    options.registrations ?? sources,
    options.sourceId ?? defaultSourceId,
    options.settings,
  );
  const storage = new LibSQLStore({ id: "local-conversations", url: `file:${options.memoryPath}` });
  const telemetry = options.telemetryPath ? new LocalTelemetry(options.telemetryPath) : undefined;
  try {
    await storage.init();
    const memory = new Memory({
      storage,
      options: {
        lastMessages: 20,
        semanticRecall: false,
        workingMemory: { enabled: false },
        generateTitle: false,
      },
    });
    const explorer = new DataExplorer(
      source,
      options.model ?? {
        providerId: "openai",
        modelId: process.env.ANALYSIS_MODEL ?? "gpt-4.1-mini",
      },
      {
        catalog: options.catalog ?? components,
        ...(options.mastra ? { mastra: options.mastra } : {}),
        memory,
        ...(telemetry ? { telemetry } : {}),
      },
    );
    return {
      engine: new WorkspaceEngine(
        explorer,
        new WorkspaceStore(options.workspacePath),
        options.catalog ?? components,
      ),
      storage,
      memory,
      telemetry,
    };
  } catch (error) {
    telemetry?.close();
    await source.close();
    await storage.close();
    throw error;
  }
}
