import { Mastra } from "@mastra/core/mastra";
import { workspaceOptions } from "./configuration.ts";
import { traceStorage, observability, closeOnShutdown } from "./lifecycle.ts";
import { createWorkspace } from "../workspace/create.ts";
import { nativeServer } from "./server.ts";

export const mastra = new Mastra({ storage: traceStorage, observability, logger: false });
const workspace = await createWorkspace({ mastra, ...workspaceOptions });
mastra.setServer(
  nativeServer(workspace.engine, {
    agentPort: Number(process.env.AGENT_PORT ?? 4111),
    webPort: Number(process.env.WEB_PORT ?? 3000),
  }),
);
closeOnShutdown(workspace);
