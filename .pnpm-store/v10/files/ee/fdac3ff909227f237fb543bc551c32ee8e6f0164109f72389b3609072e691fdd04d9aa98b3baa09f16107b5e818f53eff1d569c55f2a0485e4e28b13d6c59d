import { z } from "zod";
import { ConvexTool } from "./index.js";
declare const inputSchema: z.ZodObject<{
    deploymentSelector: z.ZodString;
    query: z.ZodString;
}, "strip", z.ZodTypeAny, {
    query: string;
    deploymentSelector: string;
}, {
    query: string;
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
export declare const RunOneoffQueryTool: ConvexTool<typeof inputSchema, typeof outputSchema>;
export {};
//# sourceMappingURL=runOneoffQuery.d.ts.map