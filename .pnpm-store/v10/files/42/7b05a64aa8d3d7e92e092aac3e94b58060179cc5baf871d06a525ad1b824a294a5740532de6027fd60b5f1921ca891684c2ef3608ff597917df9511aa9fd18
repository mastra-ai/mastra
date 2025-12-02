import { UserIdentityAttributes } from "../../server/index.js";
import { Value } from "../../values/value.js";
import { Context, OneoffCtx } from "../../bundler/context.js";
export declare function runFunctionAndLog(ctx: Context, args: {
    deploymentUrl: string;
    adminKey: string;
    functionName: string;
    argsString: string;
    identityString?: string | undefined;
    componentPath?: string | undefined;
    callbacks?: {
        onSuccess?: () => void | undefined;
    } | undefined;
}): Promise<undefined>;
export declare function parseArgs(ctx: Context, argsString: string): Promise<Record<string, Value>>;
export declare function parseFunctionName(ctx: Context, functionName: string, functionDirName: string): Promise<string>;
export declare function runSystemPaginatedQuery(ctx: Context, args: {
    deploymentUrl: string;
    adminKey: string;
    functionName: string;
    componentPath: string | undefined;
    args: Record<string, Value>;
    limit?: number;
}): Promise<Record<string, Value>[]>;
export declare function runSystemQuery(ctx: Context, args: {
    deploymentUrl: string;
    adminKey: string;
    functionName: string;
    componentPath: string | undefined;
    args: Record<string, Value>;
}): Promise<Value>;
export declare function formatValue(value: Value): string;
export declare function subscribeAndLog(ctx: Context, args: {
    deploymentUrl: string;
    adminKey: string;
    functionName: string;
    argsString: string;
    identityString?: string | undefined;
    componentPath: string | undefined;
}): Promise<void>;
export declare function subscribe(_ctx: Context, args: {
    deploymentUrl: string;
    adminKey: string;
    identity?: UserIdentityAttributes | undefined;
    parsedFunctionName: string;
    parsedFunctionArgs: Record<string, Value>;
    componentPath: string | undefined;
    until: Promise<unknown>;
    callbacks?: {
        onStart?: () => void;
        onChange?: (result: Value) => void;
        onStop?: () => void;
    } | undefined;
}): Promise<void>;
export declare function runInDeployment(ctx: OneoffCtx, args: {
    deploymentUrl: string;
    adminKey: string;
    deploymentName: string | null;
    functionName: string;
    argsString: string;
    identityString?: string | undefined;
    push: boolean;
    watch: boolean;
    typecheck: "enable" | "try" | "disable";
    typecheckComponents: boolean;
    codegen: boolean;
    componentPath: string | undefined;
    liveComponentSources: boolean;
}): Promise<void>;
//# sourceMappingURL=run.d.ts.map