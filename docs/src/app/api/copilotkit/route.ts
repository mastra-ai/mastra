import {
  CopilotRuntime,
  ExperimentalEmptyAdapter,
  copilotRuntimeNextJSAppRouterEndpoint,
} from "@copilotkit/runtime";

import { MastraDocsAgent } from "@/chatbot/custom-agents/mastra-agent";
import { NextRequest } from "next/server";

const docsAgent = new MastraDocsAgent({
  agentId: "docsAgent",
});

const runtime = new CopilotRuntime({
  agents: {
    //@ts-expect-error - mismatched typs error
    docsAgent,
  },
});

export const POST = async (req: NextRequest) => {
  const { handleRequest } = copilotRuntimeNextJSAppRouterEndpoint({
    runtime,
    serviceAdapter: new ExperimentalEmptyAdapter(),
    endpoint: "/api/copilotkit",
  });

  return handleRequest(req);
};
