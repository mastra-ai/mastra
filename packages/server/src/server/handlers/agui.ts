import { CopilotRuntime, ExperimentalEmptyAdapter, copilotRuntimeNextJSAppRouterEndpoint } from '@copilotkit/runtime';
import { getAGUI } from '@mastra/agui';
import type { Mastra } from '@mastra/core';

export async function getAGUIHandler({ req, mastra, resourceId }: { req: any; mastra: Mastra; resourceId: string }) {
  const runtime = new CopilotRuntime({
    agents: getAGUI({ mastra, resourceId }),
  });

  const { handleRequest } = copilotRuntimeNextJSAppRouterEndpoint({
    runtime,
    serviceAdapter: new ExperimentalEmptyAdapter(),
    endpoint: `/api/copilotkit?resourceId=${resourceId}`,
  });

  return handleRequest(req);
}
