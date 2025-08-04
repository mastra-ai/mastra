import {
  CopilotRuntime,
  ExperimentalEmptyAdapter,
  copilotRuntimeNextJSAppRouterEndpoint,
} from "@copilotkit/runtime";
import { NextRequest, NextResponse } from "next/server";
import { MastraClient } from "@mastra/client-js";

const baseUrl = process.env.MASTRA_AGENT_URL || "http://localhost:4111";

const client = new MastraClient({
  baseUrl,
});

export const POST = async (req: NextRequest) => {
  try {
    console.log("CopilotKit API: Starting request processing");

    // Health check for Mastra agent
    try {
      const healthCheck = await fetch(`${baseUrl}/health`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });

      if (!healthCheck.ok) {
        console.warn("CopilotKit API: Mastra agent health check failed");
      }
    } catch (healthError) {
      console.warn(
        "CopilotKit API: Unable to perform health check:",
        healthError,
      );
    }

    const runtime = new CopilotRuntime({
      agents: await client.getAGUI({ resourceId: "docsAgent" }),
    });

    const { handleRequest } = copilotRuntimeNextJSAppRouterEndpoint({
      runtime,
      serviceAdapter: new ExperimentalEmptyAdapter(),
      endpoint: "/api/copilotkit",
    });

    const response = await handleRequest(req);
    console.log("CopilotKit API: Request processed successfully");
    return response;
  } catch (error) {
    console.error("CopilotKit API: Error processing request:", error);

    return NextResponse.json(
      {
        error: "Internal server error",
        message: "Failed to process chat request. Please try again.",
      },
      { status: 500 },
    );
  }
};
