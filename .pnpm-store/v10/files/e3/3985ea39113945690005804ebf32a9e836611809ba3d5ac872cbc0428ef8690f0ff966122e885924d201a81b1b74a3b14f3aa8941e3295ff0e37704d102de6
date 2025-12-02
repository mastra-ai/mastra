import { z } from "zod";
import { ConvexTool } from "./index.js";
import { FunctionExecution } from "../../apiTypes.js";
declare const inputSchema: z.ZodObject<{
    deploymentSelector: z.ZodString;
    cursor: z.ZodOptional<z.ZodNumber>;
    entriesLimit: z.ZodOptional<z.ZodNumber>;
    tokensLimit: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
    jsonl: z.ZodOptional<z.ZodDefault<z.ZodBoolean>>;
}, "strip", z.ZodTypeAny, {
    deploymentSelector: string;
    cursor?: number | undefined;
    jsonl?: boolean | undefined;
    entriesLimit?: number | undefined;
    tokensLimit?: number | undefined;
}, {
    deploymentSelector: string;
    cursor?: number | undefined;
    jsonl?: boolean | undefined;
    entriesLimit?: number | undefined;
    tokensLimit?: number | undefined;
}>;
declare const outputSchema: z.ZodObject<{
    entries: z.ZodString;
    newCursor: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    entries: string;
    newCursor: number;
}, {
    entries: string;
    newCursor: number;
}>;
export declare const LogsTool: ConvexTool<typeof inputSchema, typeof outputSchema>;
export declare function limitLogs({ entries, tokensLimit, entriesLimit, }: {
    entries: FunctionExecution[];
    tokensLimit: number;
    entriesLimit: number;
}): FunctionExecution[];
export {};
//# sourceMappingURL=logs.d.ts.map