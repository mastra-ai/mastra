import { z } from "zod";
import { ConvexTool } from "./index.js";
declare const inputSchema: z.ZodObject<{
    deploymentSelector: z.ZodString;
}, "strip", z.ZodTypeAny, {
    deploymentSelector: string;
}, {
    deploymentSelector: string;
}>;
declare const outputSchema: z.ZodObject<{
    tables: z.ZodRecord<z.ZodString, z.ZodObject<{
        schema: z.ZodOptional<z.ZodAny>;
        inferredSchema: z.ZodOptional<z.ZodAny>;
    }, "strip", z.ZodTypeAny, {
        schema?: any;
        inferredSchema?: any;
    }, {
        schema?: any;
        inferredSchema?: any;
    }>>;
}, "strip", z.ZodTypeAny, {
    tables: Record<string, {
        schema?: any;
        inferredSchema?: any;
    }>;
}, {
    tables: Record<string, {
        schema?: any;
        inferredSchema?: any;
    }>;
}>;
export declare const TablesTool: ConvexTool<typeof inputSchema, typeof outputSchema>;
export {};
//# sourceMappingURL=tables.d.ts.map