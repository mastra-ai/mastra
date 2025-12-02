import { Context } from "../../../bundler/context.js";
import { OnDeploymentActivityFunc } from "../deployment.js";
export type DeploymentDetails = {
    deploymentName: string;
    deploymentUrl: string;
    adminKey: string;
    onActivity: OnDeploymentActivityFunc;
};
export declare function handleLocalDeployment(ctx: Context, options: {
    teamSlug: string;
    projectSlug: string;
    ports?: {
        cloud: number;
        site: number;
    } | undefined;
    backendVersion?: string | undefined;
    forceUpgrade: boolean;
}): Promise<DeploymentDetails>;
export declare function loadLocalDeploymentCredentials(ctx: Context, deploymentName: string): Promise<{
    deploymentName: string;
    deploymentUrl: string;
    adminKey: string;
}>;
//# sourceMappingURL=localDeployment.d.ts.map