import { Context } from "../bundler/context.js";
import { DeploymentType, DeploymentName, DeploymentSelectionWithinProject } from "./lib/api.js";
import { DeploymentSelection } from "./lib/deploymentSelection.js";
type DeploymentCredentials = {
    url: string;
    adminKey: string;
};
type ChosenConfiguration = "new" | "existing" | "ask" | null;
type ConfigureCmdOptions = {
    selectionWithinProject: DeploymentSelectionWithinProject;
    prod: boolean;
    localOptions: {
        ports?: {
            cloud: number;
            site: number;
        };
        backendVersion?: string | undefined;
        dashboardVersion?: string | undefined;
        forceUpgrade: boolean;
    };
    team?: string | undefined;
    project?: string | undefined;
    devDeployment?: "cloud" | "local" | undefined;
    local?: boolean | undefined;
    cloud?: boolean | undefined;
    url?: string | undefined;
    adminKey?: string | undefined;
    envFile?: string | undefined;
    overrideAuthUrl?: string | undefined;
    overrideAuthClient?: string | undefined;
    overrideAuthUsername?: string | undefined;
    overrideAuthPassword?: string | undefined;
};
/**
 * As of writing, this is used by:
 * - `npx convex dev`
 * - `npx convex codegen`
 *
 * But is not used by `npx convex deploy` or other commands.
 */
export declare function deploymentCredentialsOrConfigure(ctx: Context, deploymentSelection: DeploymentSelection, chosenConfiguration: ChosenConfiguration, cmdOptions: ConfigureCmdOptions): Promise<DeploymentCredentials & {
    deploymentFields: {
        deploymentName: DeploymentName;
        deploymentType: string;
        projectSlug: string | null;
        teamSlug: string | null;
    } | null;
}>;
export declare function _deploymentCredentialsOrConfigure(ctx: Context, deploymentSelection: DeploymentSelection, chosenConfiguration: ChosenConfiguration, cmdOptions: ConfigureCmdOptions): Promise<DeploymentCredentials & {
    deploymentFields: {
        deploymentName: DeploymentName;
        deploymentType: DeploymentType;
        projectSlug: string | null;
        teamSlug: string | null;
    } | null;
}>;
export declare function handleManuallySetUrlAndAdminKey(ctx: Context, cmdOptions: {
    url: string;
    adminKey: string;
}): Promise<{
    url: string;
    adminKey: string;
}>;
export declare function selectProject(ctx: Context, chosenConfiguration: ChosenConfiguration, cmdOptions: {
    team?: string | undefined;
    project?: string | undefined;
    devDeployment?: "cloud" | "local" | undefined;
    local?: boolean | undefined;
    cloud?: boolean | undefined;
    defaultProjectName?: string | undefined;
}): Promise<{
    teamSlug: string;
    projectSlug: string;
    devDeployment: "cloud" | "local";
}>;
export declare function updateEnvAndConfigForDeploymentSelection(ctx: Context, options: {
    url: string;
    deploymentName: string;
    teamSlug: string | null;
    projectSlug: string | null;
    deploymentType: DeploymentType;
}, existingValue: string | null): Promise<void>;
export {};
//# sourceMappingURL=configure.d.ts.map