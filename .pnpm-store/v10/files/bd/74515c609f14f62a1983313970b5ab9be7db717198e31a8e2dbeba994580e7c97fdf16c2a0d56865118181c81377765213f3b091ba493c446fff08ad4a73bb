import { BigBrainAuth, Context, ErrorType } from "../../../bundler/context.js";
import { Filesystem } from "../../../bundler/fs.js";
import { Ora } from "ora";
import { DeploymentSelectionWithinProject, DeploymentSelectionOptions } from "../api.js";
export interface McpOptions extends DeploymentSelectionOptions {
    projectDir?: string;
    disableTools?: string;
    dangerouslyEnableProductionDeployments?: boolean;
}
export declare class RequestContext implements Context {
    options: McpOptions;
    fs: Filesystem;
    deprecationMessagePrinted: boolean;
    spinner: Ora | undefined;
    _cleanupFns: Record<string, (exitCode: number, err?: any) => Promise<void>>;
    _bigBrainAuth: BigBrainAuth | null;
    constructor(options: McpOptions);
    crash(args: {
        exitCode: number;
        errorType?: ErrorType;
        errForSentry?: any;
        printedMessage: string | null;
    }): Promise<never>;
    flushAndExit(): void;
    registerCleanup(fn: (exitCode: number, err?: any) => Promise<void>): string;
    removeCleanup(handle: string): (exitCode: number, err?: any) => Promise<void>;
    bigBrainAuth(): BigBrainAuth | null;
    _updateBigBrainAuth(auth: BigBrainAuth | null): void;
    decodeDeploymentSelector(encoded: string): Promise<{
        projectDir: string;
        deployment: {
            kind: "previewName";
            previewName: string;
        } | {
            kind: "deploymentName";
            deploymentName: string;
        } | {
            kind: "prod";
        } | {
            kind: "implicitProd";
        } | {
            kind: "ownDev";
        };
    }>;
    get productionDeploymentsDisabled(): boolean;
}
export declare class RequestCrash {
    private exitCode;
    private errorType;
    printedMessage: string;
    constructor(exitCode: number, errorType: ErrorType | undefined, printedMessage: string | null);
}
export declare function encodeDeploymentSelector(projectDir: string, deployment: DeploymentSelectionWithinProject): string;
//# sourceMappingURL=requestContext.d.ts.map