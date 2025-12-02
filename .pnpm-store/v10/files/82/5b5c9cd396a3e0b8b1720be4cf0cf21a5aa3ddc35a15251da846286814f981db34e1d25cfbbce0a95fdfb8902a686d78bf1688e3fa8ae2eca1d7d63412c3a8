import { z } from "zod";
import { ConvexTool } from "./index.js";
declare const inputSchema: z.ZodObject<{
    deploymentSelector: z.ZodString;
    tableName: z.ZodString;
    order: z.ZodEnum<["asc", "desc"]>;
    cursor: z.ZodOptional<z.ZodString>;
    limit: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    tableName: string;
    order: "asc" | "desc";
    deploymentSelector: string;
    cursor?: string | undefined;
    limit?: number | undefined;
}, {
    tableName: string;
    order: "asc" | "desc";
    deploymentSelector: string;
    cursor?: string | undefined;
    limit?: number | undefined;
}>;
declare const outputSchema: z.ZodObject<{
    page: z.ZodArray<z.ZodAny, "many">;
    isDone: z.ZodBoolean;
    continueCursor: z.ZodString;
}, "strip", z.ZodTypeAny, {
    page: any[];
    continueCursor: string;
    isDone: boolean;
}, {
    page: any[];
    continueCursor: string;
    isDone: boolean;
}>;
export declare const DataTool: ConvexTool<typeof inputSchema, typeof outputSchema>;
export {};
//# sourceMappingURL=data.d.ts.map