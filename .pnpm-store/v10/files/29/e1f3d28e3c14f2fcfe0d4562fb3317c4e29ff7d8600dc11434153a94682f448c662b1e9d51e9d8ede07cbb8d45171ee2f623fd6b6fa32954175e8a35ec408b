import { z } from "zod";
import { ConvexTool } from "./index.js";
import { loadSelectedDeploymentCredentials } from "../../api.js";
import { getDeploymentSelection } from "../../deploymentSelection.js";
import { deploymentFetch } from "../../utils/utils.js";
import { FunctionExecution } from "../../apiTypes.js";
import { formatLogsAsText } from "../../logs.js";

const inputSchema = z.object({
  deploymentSelector: z
    .string()
    .describe("Deployment selector (from the status tool) to read logs from."),
  cursor: z
    .number()
    .optional()
    .describe(
      "Optional cursor (in ms) to start reading from. Use 0 to read from the beginning.",
    ),
  entriesLimit: z
    .number()
    .int()
    .positive()
    .max(1000)
    .optional()
    .describe(
      "Maximum number of log entries to return (from the end). If omitted, returns all available in this chunk.",
    ),
  tokensLimit: z
    .number()
    .int()
    .positive()
    .default(20000)
    .optional()
    .describe(
      "Approximate maximum number of tokens to return (applied to the JSON payload). Defaults to 20000.",
    ),
  jsonl: z
    .boolean()
    .default(false)
    .optional()
    .describe(
      "If true, return raw log entries as JSONL. If false (default), return formatted text logs.",
    ),
});

const outputSchema = z.object({
  entries: z.string(),
  newCursor: z.number(),
});

const logsResponseSchema = z.object({
  entries: z.array(z.any()),
  newCursor: z.number(),
});

const description = `
Fetch a chunk of recent log entries from your Convex deployment.

Returns a batch of UDF execution log entries and a new cursor you can use to
request the next batch. This tool does not tail; it performs a single fetch.
`.trim();

export const LogsTool: ConvexTool<typeof inputSchema, typeof outputSchema> = {
  name: "logs",
  description,
  inputSchema,
  outputSchema,
  handler: async (ctx, args) => {
    const { projectDir, deployment } = await ctx.decodeDeploymentSelector(
      args.deploymentSelector,
    );
    process.chdir(projectDir);
    const deploymentSelection = await getDeploymentSelection(ctx, ctx.options);
    const credentials = await loadSelectedDeploymentCredentials(
      ctx,
      deploymentSelection,
      deployment,
    );

    const fetch = deploymentFetch(ctx, {
      deploymentUrl: credentials.url,
      adminKey: credentials.adminKey,
    });

    const cursor = args.cursor ?? 0;
    const response = await fetch(`/api/stream_function_logs?cursor=${cursor}`, {
      method: "GET",
    });

    if (!response.ok) {
      return await ctx.crash({
        exitCode: 1,
        errorType: "fatal",
        printedMessage: `HTTP error ${response.status}: ${await response.text()}`,
      });
    }

    const { entries, newCursor } = await response
      .json()
      .then(logsResponseSchema.parse);

    const limitedEntries = limitLogs({
      entries,
      tokensLimit: args.tokensLimit ?? 20000,
      entriesLimit: args.entriesLimit ?? entries.length,
    });

    if (args.jsonl) {
      return {
        entries: limitedEntries
          .map((entry) => JSON.stringify(entry))
          .join("\n"),
        newCursor,
      };
    }

    return {
      entries: formatLogsAsText(limitedEntries),
      newCursor,
    };
  },
};

export function limitLogs({
  entries,
  tokensLimit,
  entriesLimit,
}: {
  entries: FunctionExecution[];
  tokensLimit: number;
  entriesLimit: number;
}): FunctionExecution[] {
  // 1) Apply entries limit first so we cut off neatly at entry boundaries (latest entries kept)
  const limitedByEntries = entries.slice(entries.length - entriesLimit);

  // 2) Apply token limit by iterating over log lines from newest to oldest and
  //    only include lines while within token budget. We cut off at the nearest log line.
  const limitedByTokens = limitEntriesByTokenBudget({
    entries: limitedByEntries,
    tokensLimit,
  });

  return limitedByTokens;
}

function limitEntriesByTokenBudget({
  entries,
  tokensLimit,
}: {
  entries: FunctionExecution[];
  tokensLimit: number;
}): FunctionExecution[] {
  const result: FunctionExecution[] = [];
  let tokens = 0;
  for (const entry of entries) {
    const entryString = JSON.stringify(entry);
    const entryTokens = estimateTokenCount(entryString);
    tokens += entryTokens;
    if (tokens > tokensLimit) break;
    result.push(entry);
  }
  return result;
}

function estimateTokenCount(entryString: string): number {
  return entryString.length * 0.33;
}
