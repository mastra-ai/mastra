import { z } from "zod";
import { ConvexTool } from "./index.js";
declare const envListInputSchema: z.ZodObject<{
    deploymentSelector: z.ZodString;
}, "strip", z.ZodTypeAny, {
    deploymentSelector: string;
}, {
    deploymentSelector: string;
}>;
declare const envListOutputSchema: z.ZodObject<{
    variables: z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        value: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        value: string;
        name: string;
    }, {
        value: string;
        name: string;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    variables: {
        value: string;
        name: string;
    }[];
}, {
    variables: {
        value: string;
        name: string;
    }[];
}>;
export declare const EnvListTool: ConvexTool<typeof envListInputSchema, typeof envListOutputSchema>;
declare const envGetInputSchema: z.ZodObject<{
    deploymentSelector: z.ZodString;
    name: z.ZodString;
}, "strip", z.ZodTypeAny, {
    name: string;
    deploymentSelector: string;
}, {
    name: string;
    deploymentSelector: string;
}>;
declare const envGetOutputSchema: z.ZodObject<{
    value: z.ZodUnion<[z.ZodString, z.ZodNull]>;
}, "strip", z.ZodTypeAny, {
    value: string | null;
}, {
    value: string | null;
}>;
export declare const EnvGetTool: ConvexTool<typeof envGetInputSchema, typeof envGetOutputSchema>;
declare const envSetInputSchema: z.ZodObject<{
    deploymentSelector: z.ZodString;
    name: z.ZodString;
    value: z.ZodString;
}, "strip", z.ZodTypeAny, {
    value: string;
    name: string;
    deploymentSelector: string;
}, {
    value: string;
    name: string;
    deploymentSelector: string;
}>;
declare const envSetOutputSchema: z.ZodObject<{
    success: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    success: boolean;
}, {
    success: boolean;
}>;
export declare const EnvSetTool: ConvexTool<typeof envSetInputSchema, typeof envSetOutputSchema>;
declare const envRemoveInputSchema: z.ZodObject<{
    deploymentSelector: z.ZodString;
    name: z.ZodString;
}, "strip", z.ZodTypeAny, {
    name: string;
    deploymentSelector: string;
}, {
    name: string;
    deploymentSelector: string;
}>;
declare const envRemoveOutputSchema: z.ZodObject<{
    success: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    success: boolean;
}, {
    success: boolean;
}>;
export declare const EnvRemoveTool: ConvexTool<typeof envRemoveInputSchema, typeof envRemoveOutputSchema>;
export {};
//# sourceMappingURL=env.d.ts.map