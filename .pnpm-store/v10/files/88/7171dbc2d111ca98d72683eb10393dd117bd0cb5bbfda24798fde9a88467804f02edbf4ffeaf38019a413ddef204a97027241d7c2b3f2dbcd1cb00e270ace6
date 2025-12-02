import { Context } from "../../bundler/context.js";
import { DeploymentType } from "./api.js";
export declare function stripDeploymentTypePrefix(deployment: string): string;
export declare function getDeploymentTypeFromConfiguredDeployment(raw: string): "local" | "preview" | "prod" | "dev" | null;
export declare function isAnonymousDeployment(deploymentName: string): boolean;
export declare function removeAnonymousPrefix(deploymentName: string): string;
export declare function writeDeploymentEnvVar(ctx: Context, deploymentType: DeploymentType, deployment: {
    team: string | null;
    project: string | null;
    deploymentName: string;
}, existingValue: string | null): Promise<{
    wroteToGitIgnore: boolean;
    changedDeploymentEnvVar: boolean;
}>;
export declare function eraseDeploymentEnvVar(ctx: Context): Promise<boolean>;
export declare function changesToEnvVarFile(existingFile: string | null, deploymentType: DeploymentType, { team, project, deploymentName, }: {
    team: string | null;
    project: string | null;
    deploymentName: string;
}): string | null;
export declare function changesToGitIgnore(existingFile: string | null): string | null;
export declare function deploymentNameFromAdminKeyOrCrash(ctx: Context, adminKey: string): Promise<string>;
export declare function isPreviewDeployKey(adminKey: string): boolean;
export declare function isProjectKey(adminKey: string): boolean;
export declare function isDeploymentKey(adminKey: string): boolean;
export declare function deploymentTypeFromAdminKey(adminKey: string): DeploymentType;
export declare function getTeamAndProjectFromPreviewAdminKey(ctx: Context, adminKey: string): Promise<{
    teamSlug: string;
    projectSlug: string;
}>;
export type OnDeploymentActivityFunc = (isOffline: boolean, wasOffline: boolean) => Promise<void>;
export type CleanupDeploymentFunc = () => Promise<void>;
export type DeploymentDetails = {
    deploymentName: string;
    deploymentUrl: string;
    adminKey: string;
    onActivity: OnDeploymentActivityFunc | null;
};
//# sourceMappingURL=deployment.d.ts.map