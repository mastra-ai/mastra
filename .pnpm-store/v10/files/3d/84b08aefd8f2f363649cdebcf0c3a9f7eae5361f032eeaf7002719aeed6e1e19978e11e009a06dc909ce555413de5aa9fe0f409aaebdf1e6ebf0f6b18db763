"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var logs_exports = {};
__export(logs_exports, {
  LogsTool: () => LogsTool,
  limitLogs: () => limitLogs
});
module.exports = __toCommonJS(logs_exports);
var import_zod = require("zod");
var import_api = require("../../api.js");
var import_deploymentSelection = require("../../deploymentSelection.js");
var import_utils = require("../../utils/utils.js");
var import_logs = require("../../logs.js");
const inputSchema = import_zod.z.object({
  deploymentSelector: import_zod.z.string().describe("Deployment selector (from the status tool) to read logs from."),
  cursor: import_zod.z.number().optional().describe(
    "Optional cursor (in ms) to start reading from. Use 0 to read from the beginning."
  ),
  entriesLimit: import_zod.z.number().int().positive().max(1e3).optional().describe(
    "Maximum number of log entries to return (from the end). If omitted, returns all available in this chunk."
  ),
  tokensLimit: import_zod.z.number().int().positive().default(2e4).optional().describe(
    "Approximate maximum number of tokens to return (applied to the JSON payload). Defaults to 20000."
  ),
  jsonl: import_zod.z.boolean().default(false).optional().describe(
    "If true, return raw log entries as JSONL. If false (default), return formatted text logs."
  )
});
const outputSchema = import_zod.z.object({
  entries: import_zod.z.string(),
  newCursor: import_zod.z.number()
});
const logsResponseSchema = import_zod.z.object({
  entries: import_zod.z.array(import_zod.z.any()),
  newCursor: import_zod.z.number()
});
const description = `
Fetch a chunk of recent log entries from your Convex deployment.

Returns a batch of UDF execution log entries and a new cursor you can use to
request the next batch. This tool does not tail; it performs a single fetch.
`.trim();
const LogsTool = {
  name: "logs",
  description,
  inputSchema,
  outputSchema,
  handler: async (ctx, args) => {
    const { projectDir, deployment } = await ctx.decodeDeploymentSelector(
      args.deploymentSelector
    );
    process.chdir(projectDir);
    const deploymentSelection = await (0, import_deploymentSelection.getDeploymentSelection)(ctx, ctx.options);
    const credentials = await (0, import_api.loadSelectedDeploymentCredentials)(
      ctx,
      deploymentSelection,
      deployment
    );
    const fetch = (0, import_utils.deploymentFetch)(ctx, {
      deploymentUrl: credentials.url,
      adminKey: credentials.adminKey
    });
    const cursor = args.cursor ?? 0;
    const response = await fetch(`/api/stream_function_logs?cursor=${cursor}`, {
      method: "GET"
    });
    if (!response.ok) {
      return await ctx.crash({
        exitCode: 1,
        errorType: "fatal",
        printedMessage: `HTTP error ${response.status}: ${await response.text()}`
      });
    }
    const { entries, newCursor } = await response.json().then(logsResponseSchema.parse);
    const limitedEntries = limitLogs({
      entries,
      tokensLimit: args.tokensLimit ?? 2e4,
      entriesLimit: args.entriesLimit ?? entries.length
    });
    if (args.jsonl) {
      return {
        entries: limitedEntries.map((entry) => JSON.stringify(entry)).join("\n"),
        newCursor
      };
    }
    return {
      entries: (0, import_logs.formatLogsAsText)(limitedEntries),
      newCursor
    };
  }
};
function limitLogs({
  entries,
  tokensLimit,
  entriesLimit
}) {
  const limitedByEntries = entries.slice(entries.length - entriesLimit);
  const limitedByTokens = limitEntriesByTokenBudget({
    entries: limitedByEntries,
    tokensLimit
  });
  return limitedByTokens;
}
function limitEntriesByTokenBudget({
  entries,
  tokensLimit
}) {
  const result = [];
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
function estimateTokenCount(entryString) {
  return entryString.length * 0.33;
}
//# sourceMappingURL=logs.js.map
