import { z } from "zod";
import { ConvexTool } from "./index.js";
declare const inputSchema: z.ZodObject<{
    deploymentSelector: z.ZodString;
    functionName: z.ZodString;
    args: z.ZodString;
}, "strip", z.ZodTypeAny, {
    args: string;
    functionName: string;
    deploymentSelector: string;
}, {
    args: string;
    functionName: string;
    deploymentSelector: string;
}>;
declare const outputSchema: z.ZodObject<{
    result: z.ZodAny;
    logLines: z.ZodArray<z.ZodString, "many">;
}, "strip", z.ZodTypeAny, {
    logLines: string[];
    result?: any;
}, {
    logLines: string[];
    result?: any;
}>;
export declare const RunTool: ConvexTool<typeof inputSchema, typeof outputSchema>;
export {};
//# sourceMappingURL=run.d.ts.map