import { Context } from "../../bundler/context.js";
import { EvaluatePushResponse, StartPushRequest, StartPushResponse } from "./deployApi/startPush.js";
import { AppDefinitionConfig, ComponentDefinitionConfig } from "./deployApi/definitionConfig.js";
import { FinishPushDiff } from "./deployApi/finishPush.js";
import { Reporter, Span } from "./tracing.js";
/** Push configuration2 to the given remote origin. */
export declare function startPush(ctx: Context, span: Span, request: StartPushRequest, options: {
    url: string;
    deploymentName: string | null;
}): Promise<StartPushResponse>;
export declare function evaluatePush(ctx: Context, span: Span, request: StartPushRequest, options: {
    url: string;
    deploymentName: string | null;
}): Promise<EvaluatePushResponse>;
export declare function waitForSchema(ctx: Context, span: Span, startPush: StartPushResponse, options: {
    adminKey: string;
    url: string;
    dryRun: boolean;
    deploymentName: string | null;
}): Promise<undefined>;
export declare function finishPush(ctx: Context, span: Span, startPush: StartPushResponse, options: {
    adminKey: string;
    url: string;
    dryRun: boolean;
    verbose?: boolean;
    deploymentName: string | null;
}): Promise<FinishPushDiff>;
export type ComponentDefinitionConfigWithoutImpls = Omit<ComponentDefinitionConfig, "schema" | "functions">;
export type AppDefinitionConfigWithoutImpls = Omit<AppDefinitionConfig, "schema" | "functions" | "auth">;
export declare function reportPushCompleted(ctx: Context, adminKey: string, url: string, reporter: Reporter): Promise<void>;
export declare function deployToDeployment(ctx: Context, credentials: {
    url: string;
    adminKey: string;
    deploymentName: string | null;
}, options: {
    verbose?: boolean | undefined;
    dryRun?: boolean | undefined;
    yes?: boolean | undefined;
    typecheck: "enable" | "try" | "disable";
    typecheckComponents: boolean;
    codegen: "enable" | "disable";
    cmd?: string | undefined;
    cmdUrlEnvVarName?: string | undefined;
    debugBundlePath?: string | undefined;
    debug?: boolean | undefined;
    writePushRequest?: string | undefined;
    liveComponentSources?: boolean | undefined;
    allowDeletingLargeIndexes: boolean;
}): Promise<void>;
export declare function runCommand(ctx: Context, options: {
    cmdUrlEnvVarName?: string | undefined;
    cmd?: string | undefined;
    dryRun?: boolean | undefined;
    url: string;
    adminKey: string;
}): Promise<void>;
export declare function fetchDeploymentCanonicalCloudUrl(ctx: Context, options: {
    deploymentUrl: string;
    adminKey: string;
}): Promise<string>;
//# sourceMappingURL=deploy2.d.ts.map