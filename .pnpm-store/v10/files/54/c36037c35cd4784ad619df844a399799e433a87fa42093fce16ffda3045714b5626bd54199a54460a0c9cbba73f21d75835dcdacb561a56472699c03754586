import { z } from "zod";
import { ComponentDefinitionPath, ComponentPath } from "./paths.js";
import { Identifier } from "./types.js";
export declare const resource: z.ZodUnion<[z.ZodObject<{
    type: z.ZodLiteral<"value">;
    value: z.ZodString;
}, "passthrough", z.ZodTypeAny, {
    type: "value";
    value: string;
}, {
    type: "value";
    value: string;
}>, z.ZodObject<{
    type: z.ZodLiteral<"function">;
    path: z.ZodObject<{
        component: z.ZodString;
        udfPath: z.ZodString;
    }, "passthrough", z.ZodTypeAny, {
        udfPath: string;
        component: string;
    }, {
        udfPath: string;
        component: string;
    }>;
}, "passthrough", z.ZodTypeAny, {
    type: "function";
    path: {
        udfPath: string;
        component: string;
    };
}, {
    type: "function";
    path: {
        udfPath: string;
        component: string;
    };
}>]>;
export type Resource = z.infer<typeof resource>;
export type CheckedExport = {
    type: "branch";
    children: Record<Identifier, CheckedExport>;
} | {
    type: "leaf";
    resource: Resource;
};
export declare const checkedExport: z.ZodType<CheckedExport>;
export declare const httpActionRoute: z.ZodObject<{
    method: z.ZodString;
    path: z.ZodString;
}, "passthrough", z.ZodTypeAny, {
    method: string;
    path: string;
}, {
    method: string;
    path: string;
}>;
export declare const checkedHttpRoutes: z.ZodObject<{
    httpModuleRoutes: z.ZodNullable<z.ZodArray<z.ZodObject<{
        method: z.ZodString;
        path: z.ZodString;
    }, "passthrough", z.ZodTypeAny, {
        method: string;
        path: string;
    }, {
        method: string;
        path: string;
    }>, "many">>;
    mounts: z.ZodArray<z.ZodString, "many">;
}, "passthrough", z.ZodTypeAny, {
    httpModuleRoutes: {
        method: string;
        path: string;
    }[] | null;
    mounts: string[];
}, {
    httpModuleRoutes: {
        method: string;
        path: string;
    }[] | null;
    mounts: string[];
}>;
export type CheckedHttpRoutes = z.infer<typeof checkedHttpRoutes>;
export type CheckedComponent = {
    definitionPath: ComponentDefinitionPath;
    componentPath: ComponentPath;
    args: Record<Identifier, Resource>;
    childComponents: Record<Identifier, CheckedComponent>;
};
export declare const checkedComponent: z.ZodType<CheckedComponent>;
//# sourceMappingURL=checkedComponent.d.ts.map