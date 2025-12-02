import { Tool } from "@modelcontextprotocol/sdk/types";
import { RequestContext } from "../requestContext.js";
import { ZodTypeAny, z } from "zod";
export type ConvexTool<Input extends ZodTypeAny, Output extends ZodTypeAny> = {
    name: string;
    description: string;
    inputSchema: Input;
    outputSchema: Output;
    handler: (ctx: RequestContext, input: z.infer<Input>) => Promise<z.infer<Output>>;
};
export declare function mcpTool(tool: ConvexTool<ZodTypeAny, ZodTypeAny>): Tool;
export declare const convexTools: ConvexTool<any, any>[];
//# sourceMappingURL=index.d.ts.map