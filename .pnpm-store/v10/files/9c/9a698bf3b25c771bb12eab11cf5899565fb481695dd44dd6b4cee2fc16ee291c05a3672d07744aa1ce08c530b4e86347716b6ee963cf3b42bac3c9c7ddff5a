import { Context } from "../../bundler/context.js";
import { ProjectConfig } from "./config.js";
import { CodegenOptions } from "./codegen.js";
import { DeploymentSelection } from "./deploymentSelection.js";
import { LargeIndexDeletionCheck } from "./indexes.js";
import { LogManager } from "./logs.js";
export type PushOptions = {
    adminKey: string;
    verbose: boolean;
    dryRun: boolean;
    typecheck: "enable" | "try" | "disable";
    typecheckComponents: boolean;
    debug: boolean;
    debugBundlePath?: string | undefined;
    debugNodeApis: boolean;
    codegen: boolean;
    url: string;
    deploymentName: string | null;
    writePushRequest?: string | undefined;
    liveComponentSources: boolean;
    logManager?: LogManager | undefined;
    largeIndexDeletionCheck: LargeIndexDeletionCheck;
};
export declare function runCodegen(ctx: Context, deploymentSelection: DeploymentSelection, options: CodegenOptions): Promise<undefined>;
export declare function runPush(ctx: Context, options: PushOptions): Promise<void>;
export declare function runComponentsPush(ctx: Context, options: PushOptions, configPath: string, projectConfig: ProjectConfig): Promise<void>;
//# sourceMappingURL=components.d.ts.map