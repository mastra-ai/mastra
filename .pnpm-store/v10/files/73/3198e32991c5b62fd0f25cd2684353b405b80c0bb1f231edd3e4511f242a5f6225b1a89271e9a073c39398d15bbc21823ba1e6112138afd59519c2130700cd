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
var mcp_exports = {};
__export(mcp_exports, {
  mcp: () => mcp
});
module.exports = __toCommonJS(mcp_exports);
var import_extra_typings = require("@commander-js/extra-typings");
var import_context = require("../bundler/context.js");
var import_server = require("@modelcontextprotocol/sdk/server/index.js");
var import_stdio = require("@modelcontextprotocol/sdk/server/stdio.js");
var import_command = require("./lib/command.js");
var import_login = require("./lib/login.js");
var import_types = require("@modelcontextprotocol/sdk/types.js");
var import_requestContext = require("./lib/mcp/requestContext.js");
var import_tools = require("./lib/mcp/tools/index.js");
var import_mutex = require("./lib/utils/mutex.js");
var import_deploymentSelection = require("./lib/deploymentSelection.js");
const allToolNames = import_tools.convexTools.map((t) => t.name).sort();
const mcp = new import_extra_typings.Command("mcp").summary("Manage the Model Context Protocol server for Convex [BETA]").description(
  "Commands to initialize and run a Model Context Protocol server for Convex that can be used with AI tools.\nThis server exposes your Convex codebase to AI tools in a structured way."
).allowExcessArguments(false);
mcp.command("start").summary("Start the MCP server").description(
  "Start the Model Context Protocol server for Convex that can be used with AI tools."
).option(
  "--project-dir <project-dir>",
  "Run the MCP server for a single project. By default, the MCP server can run for multiple projects, and each tool call specifies its project directory."
).option(
  "--disable-tools <tool-names>",
  `Comma separated list of tool names to disable (options: ${allToolNames.join(", ")})`
).option(
  "--dangerously-enable-production-deployments",
  "DANGEROUSLY allow the MCP server to access production deployments. Defaults to false.",
  false
).addOption(
  new import_extra_typings.Option("--disable-production-deployments").conflicts("--dangerously-enable-production-deployments").hideHelp()
).addDeploymentSelectionOptions((0, import_command.actionDescription)("Run the MCP server on")).action(async (options) => {
  const ctx = await (0, import_context.oneoffContext)(options);
  try {
    const server = makeServer(options);
    const transport = new import_stdio.StdioServerTransport();
    await server.connect(transport);
    await new Promise(() => {
    });
  } catch (error) {
    await ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      errForSentry: `Failed to start MCP server: ${error}`,
      printedMessage: `Failed to start MCP server: ${error}`
    });
  }
});
function makeServer(options) {
  const disabledToolNames = /* @__PURE__ */ new Set();
  for (const toolName of options.disableTools?.split(",") ?? []) {
    const name = toolName.trim();
    if (!allToolNames.includes(name)) {
      throw new Error(
        `Disabled tool ${name} not found (valid tools: ${allToolNames.join(", ")})`
      );
    }
    disabledToolNames.add(name);
  }
  const enabledToolsByName = {};
  for (const tool of import_tools.convexTools) {
    if (!disabledToolNames.has(tool.name)) {
      enabledToolsByName[tool.name] = tool;
    }
  }
  const mutex = new import_mutex.Mutex();
  const server = new import_server.Server(
    {
      name: "Convex MCP Server",
      version: "0.0.1"
    },
    {
      capabilities: {
        tools: {}
      }
    }
  );
  server.setRequestHandler(
    import_types.CallToolRequestSchema,
    async (request) => {
      const ctx = new import_requestContext.RequestContext(options);
      await (0, import_deploymentSelection.initializeBigBrainAuth)(ctx, options);
      try {
        const authorized = await (0, import_login.checkAuthorization)(ctx, false);
        if (!authorized) {
          await ctx.crash({
            exitCode: 1,
            errorType: "fatal",
            printedMessage: "Not Authorized: Run `npx convex dev` to login to your Convex project."
          });
        }
        if (!request.params.arguments) {
          await ctx.crash({
            exitCode: 1,
            errorType: "fatal",
            printedMessage: "No arguments provided"
          });
        }
        const convexTool = enabledToolsByName[request.params.name];
        if (!convexTool) {
          await ctx.crash({
            exitCode: 1,
            errorType: "fatal",
            printedMessage: `Tool ${request.params.name} not found`
          });
        }
        const input = convexTool.inputSchema.parse(request.params.arguments);
        const result = await mutex.runExclusive(async () => {
          return await convexTool.handler(ctx, input);
        });
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result)
            }
          ]
        };
      } catch (error) {
        let message;
        if (error instanceof import_requestContext.RequestCrash) {
          message = error.printedMessage;
        } else if (error instanceof Error) {
          message = error.message;
        } else {
          message = String(error);
        }
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ error: message })
            }
          ],
          isError: true
        };
      }
    }
  );
  server.setRequestHandler(import_types.ListToolsRequestSchema, async () => {
    return {
      tools: Object.values(enabledToolsByName).map(import_tools.mcpTool)
    };
  });
  return server;
}
//# sourceMappingURL=mcp.js.map
