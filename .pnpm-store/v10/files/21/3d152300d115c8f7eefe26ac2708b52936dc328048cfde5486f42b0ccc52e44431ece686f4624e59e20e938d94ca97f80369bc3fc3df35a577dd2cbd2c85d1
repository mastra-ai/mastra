import { Context } from "../../../bundler/context.js";
import { LocalDeploymentKind } from "./filePaths.js";
import { LocalDeploymentConfig } from "./filePaths.js";
import { DeploymentDetails } from "./localDeployment.js";
export declare function handleAnonymousDeployment(ctx: Context, options: {
    ports?: {
        cloud: number;
        site: number;
    } | undefined;
    backendVersion?: string | undefined;
    dashboardVersion?: string | undefined;
    forceUpgrade: boolean;
    deploymentName: string | null;
    chosenConfiguration: "new" | "existing" | "ask" | null;
}): Promise<DeploymentDetails>;
export declare function loadAnonymousDeployment(ctx: Context, deploymentName: string): Promise<LocalDeploymentConfig>;
export declare function listExistingAnonymousDeployments(ctx: Context): Promise<Array<{
    deploymentName: string;
    config: LocalDeploymentConfig;
}>>;
/**
 * This takes an "anonymous" deployment and makes it a "local" deployment
 * that is associated with a project in the given team.
 */
export declare function handleLinkToProject(ctx: Context, args: {
    deploymentName: string;
    teamSlug: string;
    projectSlug: string | null;
}): Promise<{
    deploymentName: string;
    deploymentUrl: string;
    projectSlug: string;
}>;
export declare function moveDeployment(ctx: Context, oldDeployment: {
    deploymentKind: LocalDeploymentKind;
    deploymentName: string;
}, newDeployment: {
    deploymentKind: LocalDeploymentKind;
    deploymentName: string;
}): Promise<void>;
//# sourceMappingURL=anonymous.d.ts.map