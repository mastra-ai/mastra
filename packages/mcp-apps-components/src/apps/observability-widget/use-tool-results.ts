import { emptyAnswer, requestKey, toDashboardResult } from '@mastra/playground-ui/domains/dashboards';
import type { DashboardAnswer, DashboardRequest } from '@mastra/playground-ui/domains/dashboards';
import type { App } from '@modelcontextprotocol/ext-apps';
import { useQueries } from '@tanstack/react-query';
import { z } from 'zod';
import { QUERY_OBSERVABILITY_TOOL } from './tool';

const toolOutput = z.object({ data: z.unknown() });

/**
 * Asks the server's `queryObservability` tool for one request's answer: the action is the request's
 * method, the args are sent as planned. An unsatisfiable request answers empty without a call.
 */
async function ask(app: App, request: DashboardRequest): Promise<DashboardAnswer> {
  if (request.unsatisfiable) return emptyAnswer(request.method);
  const result = await app.callServerTool({
    name: QUERY_OBSERVABILITY_TOOL,
    arguments: { action: request.method, args: request.args },
  });
  const text = result.content.find(block => block.type === 'text')?.text;
  if (result.isError) throw new Error(text ?? `${QUERY_OBSERVABILITY_TOOL} failed.`);
  const output = toolOutput.safeParse(result.structuredContent);
  if (!output.success) throw new Error(`${QUERY_OBSERVABILITY_TOOL} returned no data.`);
  // The tool returns the action's answer as the Mastra server sent it.
  return { method: request.method, data: output.data.data } as DashboardAnswer;
}

/**
 * Sends the requests through the tool, as plain results lined up with `requests` (an `undefined`
 * request keeps its slot). The window is frozen when the app opens, so an answer never goes stale.
 */
export function useToolResults(app: App, requests: (DashboardRequest | undefined)[]) {
  const sent = requests.filter(request => request !== undefined);
  const queries = useQueries({
    queries: sent.map(request => ({
      queryKey: requestKey(request),
      queryFn: () => ask(app, request),
      staleTime: Infinity,
    })),
  });
  let next = 0;
  return {
    results: requests.map(request => (request ? toDashboardResult(queries[next++]!) : undefined)),
    retry: () => queries.forEach(query => query.isError && void query.refetch()),
  };
}
