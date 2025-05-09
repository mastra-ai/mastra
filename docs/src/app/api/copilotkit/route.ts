import {
  CopilotRuntime,
  ExperimentalEmptyAdapter,
  copilotRuntimeNextJSAppRouterEndpoint,
} from "@copilotkit/runtime";
import { NextRequest } from "next/server";
import { MastraClient } from "@mastra/client-js";

const baseUrl = process.env.MASTRA_AGENT_URL || "http://localhost:4111";

const client = new MastraClient({
  baseUrl,
});

export const POST = async (req: NextRequest) => {
  const runtime = new CopilotRuntime({
    agents: await client.getAGUI({ resourceId: "docsAgent" }),
  });

  const { handleRequest } = copilotRuntimeNextJSAppRouterEndpoint({
    runtime,
    serviceAdapter: new ExperimentalEmptyAdapter(),
    endpoint: "/api/copilotkit",
  });

  return handleRequest(req);
};
