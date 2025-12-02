"use strict";
import { Command, Option } from "@commander-js/extra-typings";
import { oneoffContext } from "../bundler/context.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { actionDescription } from "./lib/command.js";
import { checkAuthorization } from "./lib/login.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema
} from "@modelcontextprotocol/sdk/types.js";
import {
  RequestContext,
  RequestCrash
} from "./lib/mcp/requestContext.js";
import { mcpTool, convexTools } from "./lib/mcp/tools/index.js";
import { Mutex } from "./lib/utils/mutex.js";
import { initializeBigBrainAuth } from "./lib/deploymentSelection.js";
const allToolNames = convexTools.map((t) => t.name).sort();
export const mcp = new Command("mcp").summary("Manage the Model Context Protocol server for Convex [BETA]").description(
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
  new Option("--disable-production-deployments").conflicts("--dangerously-enable-production-deployments").hideHelp()
).addDeploymentSelectionOptions(actionDescription("Run the MCP server on")).action(async (options) => {
  const ctx = await oneoffContext(options);
  try {
    const server = makeServer(options);
    const transport = new StdioServerTransport();
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
  for (const tool of convexTools) {
    if (!disabledToolNames.has(tool.name)) {
      enabledToolsByName[tool.name] = tool;
    }
  }
  const mutex = new Mutex();
  const server = new Server(
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
    CallToolRequestSchema,
    async (request) => {
      const ctx = new RequestContext(options);
      await initializeBigBrainAuth(ctx, options);
      try {
        const authorized = await checkAuthorization(ctx, false);
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
        if (error instanceof RequestCrash) {
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
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: Object.values(enabledToolsByName).map(mcpTool)
    };
  });
  return server;
}
//# sourceMappingURL=mcp.js.map
