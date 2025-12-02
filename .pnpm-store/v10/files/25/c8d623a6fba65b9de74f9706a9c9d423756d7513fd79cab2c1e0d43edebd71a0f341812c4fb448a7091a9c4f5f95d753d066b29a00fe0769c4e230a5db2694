import { z } from "zod";
export declare const moduleEnvironment: z.ZodUnion<[z.ZodLiteral<"isolate">, z.ZodLiteral<"node">]>;
export type ModuleEnvironment = z.infer<typeof moduleEnvironment>;
export declare const moduleConfig: z.ZodObject<{
    path: z.ZodString;
    source: z.ZodString;
    sourceMap: z.ZodOptional<z.ZodString>;
    environment: z.ZodUnion<[z.ZodLiteral<"isolate">, z.ZodLiteral<"node">]>;
}, "passthrough", z.ZodTypeAny, {
    path: string;
    source: string;
    environment: "node" | "isolate";
    sourceMap?: string | undefined;
}, {
    path: string;
    source: string;
    environment: "node" | "isolate";
    sourceMap?: string | undefined;
}>;
export type ModuleConfig = z.infer<typeof moduleConfig>;
export declare const nodeDependency: z.ZodObject<{
    name: z.ZodString;
    version: z.ZodString;
}, "passthrough", z.ZodTypeAny, {
    name: string;
    version: string;
}, {
    name: string;
    version: string;
}>;
export type NodeDependency = z.infer<typeof nodeDependency>;
export declare const udfConfig: z.ZodObject<{
    serverVersion: z.ZodString;
    importPhaseRngSeed: z.ZodAny;
    importPhaseUnixTimestamp: z.ZodAny;
}, "passthrough", z.ZodTypeAny, {
    serverVersion: string;
    importPhaseRngSeed?: any;
    importPhaseUnixTimestamp?: any;
}, {
    serverVersion: string;
    importPhaseRngSeed?: any;
    importPhaseUnixTimestamp?: any;
}>;
export type UdfConfig = z.infer<typeof udfConfig>;
export declare const sourcePackage: z.ZodAny;
export type SourcePackage = z.infer<typeof sourcePackage>;
export declare const visibility: z.ZodUnion<[z.ZodObject<{
    kind: z.ZodLiteral<"public">;
}, "passthrough", z.ZodTypeAny, {
    kind: "public";
}, {
    kind: "public";
}>, z.ZodObject<{
    kind: z.ZodLiteral<"internal">;
}, "passthrough", z.ZodTypeAny, {
    kind: "internal";
}, {
    kind: "internal";
}>]>;
export type Visibility = z.infer<typeof visibility>;
export declare const analyzedFunction: z.ZodObject<{
    name: z.ZodString;
    pos: z.ZodAny;
    udfType: z.ZodUnion<[z.ZodLiteral<"Query">, z.ZodLiteral<"Mutation">, z.ZodLiteral<"Action">]>;
    visibility: z.ZodNullable<z.ZodUnion<[z.ZodObject<{
        kind: z.ZodLiteral<"public">;
    }, "passthrough", z.ZodTypeAny, {
        kind: "public";
    }, {
        kind: "public";
    }>, z.ZodObject<{
        kind: z.ZodLiteral<"internal">;
    }, "passthrough", z.ZodTypeAny, {
        kind: "internal";
    }, {
        kind: "internal";
    }>]>>;
    args: z.ZodNullable<z.ZodString>;
    returns: z.ZodNullable<z.ZodString>;
}, "passthrough", z.ZodTypeAny, {
    name: string;
    args: string | null;
    returns: string | null;
    udfType: "Mutation" | "Action" | "Query";
    visibility: {
        kind: "public";
    } | {
        kind: "internal";
    } | null;
    pos?: any;
}, {
    name: string;
    args: string | null;
    returns: string | null;
    udfType: "Mutation" | "Action" | "Query";
    visibility: {
        kind: "public";
    } | {
        kind: "internal";
    } | null;
    pos?: any;
}>;
export type AnalyzedFunction = z.infer<typeof analyzedFunction>;
export declare const analyzedModule: z.ZodObject<{
    functions: z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        pos: z.ZodAny;
        udfType: z.ZodUnion<[z.ZodLiteral<"Query">, z.ZodLiteral<"Mutation">, z.ZodLiteral<"Action">]>;
        visibility: z.ZodNullable<z.ZodUnion<[z.ZodObject<{
            kind: z.ZodLiteral<"public">;
        }, "passthrough", z.ZodTypeAny, {
            kind: "public";
        }, {
            kind: "public";
        }>, z.ZodObject<{
            kind: z.ZodLiteral<"internal">;
        }, "passthrough", z.ZodTypeAny, {
            kind: "internal";
        }, {
            kind: "internal";
        }>]>>;
        args: z.ZodNullable<z.ZodString>;
        returns: z.ZodNullable<z.ZodString>;
    }, "passthrough", z.ZodTypeAny, {
        name: string;
        args: string | null;
        returns: string | null;
        udfType: "Mutation" | "Action" | "Query";
        visibility: {
            kind: "public";
        } | {
            kind: "internal";
        } | null;
        pos?: any;
    }, {
        name: string;
        args: string | null;
        returns: string | null;
        udfType: "Mutation" | "Action" | "Query";
        visibility: {
            kind: "public";
        } | {
            kind: "internal";
        } | null;
        pos?: any;
    }>, "many">;
    httpRoutes: z.ZodAny;
    cronSpecs: z.ZodAny;
    sourceMapped: z.ZodAny;
}, "passthrough", z.ZodTypeAny, {
    functions: {
        name: string;
        args: string | null;
        returns: string | null;
        udfType: "Mutation" | "Action" | "Query";
        visibility: {
            kind: "public";
        } | {
            kind: "internal";
        } | null;
        pos?: any;
    }[];
    httpRoutes?: any;
    cronSpecs?: any;
    sourceMapped?: any;
}, {
    functions: {
        name: string;
        args: string | null;
        returns: string | null;
        udfType: "Mutation" | "Action" | "Query";
        visibility: {
            kind: "public";
        } | {
            kind: "internal";
        } | null;
        pos?: any;
    }[];
    httpRoutes?: any;
    cronSpecs?: any;
    sourceMapped?: any;
}>;
export type AnalyzedModule = z.infer<typeof analyzedModule>;
//# sourceMappingURL=modules.d.ts.map