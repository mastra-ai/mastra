import { ToolSchema } from "@modelcontextprotocol/sdk/types";
import { Tool } from "@modelcontextprotocol/sdk/types";
import { RequestContext } from "../requestContext.js";
import { ZodTypeAny, z } from "zod";
import zodToJsonSchema from "zod-to-json-schema";
import { TablesTool } from "./tables.js";
import { DataTool } from "./data.js";
import { StatusTool } from "./status.js";
import { FunctionSpecTool } from "./functionSpec.js";
import { RunTool } from "./run.js";
import { EnvListTool, EnvGetTool, EnvSetTool, EnvRemoveTool } from "./env.js";
import { RunOneoffQueryTool } from "./runOneoffQuery.js";
import { LogsTool } from "./logs.js";

export type ConvexTool<Input extends ZodTypeAny, Output extends ZodTypeAny> = {
  name: string;
  description: string;
  inputSchema: Input;
  outputSchema: Output;
  handler: (
    ctx: RequestContext,
    input: z.infer<Input>,
  ) => Promise<z.infer<Output>>;
};

type ToolInput = z.infer<(typeof ToolSchema)["shape"]["inputSchema"]>;

export function mcpTool(tool: ConvexTool<ZodTypeAny, ZodTypeAny>): Tool {
  return {
    name: tool.name,
    description: tool.description,
    inputSchema: zodToJsonSchema(tool.inputSchema) as ToolInput,
  };
}

export const convexTools: ConvexTool<any, any>[] = [
  StatusTool,
  DataTool,
  TablesTool,
  FunctionSpecTool,
  RunTool,
  EnvListTool,
  EnvGetTool,
  EnvSetTool,
  EnvRemoveTool,
  RunOneoffQueryTool,
  LogsTool,
];
