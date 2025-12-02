import { Context } from "../../../bundler/context.js";
import { LocalDeploymentKind } from "./filePaths.js";
export declare function runLocalBackend(ctx: Context, args: {
    ports: {
        cloud: number;
        site: number;
    };
    deploymentKind: LocalDeploymentKind;
    deploymentName: string;
    binaryPath: string;
    instanceSecret: string;
    isLatestVersion: boolean;
}): Promise<{
    cleanupHandle: string;
}>;
/** Crash if correct local backend is not currently listening on the expected port. */
export declare function assertLocalBackendRunning(ctx: Context, args: {
    url: string;
    deploymentName: string;
}): Promise<void>;
/** Wait for up to maxTimeSecs for the correct local backend to be running on the expected port. */
export declare function ensureBackendRunning(ctx: Context, args: {
    cloudPort: number;
    deploymentName: string;
    maxTimeSecs: number;
}): Promise<void>;
export declare function ensureBackendStopped(ctx: Context, args: {
    ports: {
        cloud: number;
        site?: number;
    };
    maxTimeSecs: number;
    deploymentName: string;
    allowOtherDeployments: boolean;
}): Promise<undefined>;
export declare function localDeploymentUrl(cloudPort: number): string;
export declare function selfHostedEventTag(deploymentKind: LocalDeploymentKind): string;
//# sourceMappingURL=run.d.ts.map