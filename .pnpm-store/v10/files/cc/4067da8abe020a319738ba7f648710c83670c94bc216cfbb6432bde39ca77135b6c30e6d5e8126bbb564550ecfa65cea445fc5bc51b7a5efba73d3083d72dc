import { Context } from "../../bundler/context.js";
import { z } from "zod";
import { DeploymentSelection, ProjectSelection } from "./deploymentSelection.js";
export type DeploymentName = string;
export type CloudDeploymentType = "prod" | "dev" | "preview";
export type AccountRequiredDeploymentType = CloudDeploymentType | "local";
export type DeploymentType = AccountRequiredDeploymentType | "anonymous";
export type Project = {
    id: number;
    name: string;
    slug: string;
    isDemo: boolean;
};
type AdminKey = string;
export declare function createProject(ctx: Context, { teamSlug: selectedTeamSlug, projectName, deploymentTypeToProvision, }: {
    teamSlug: string;
    projectName: string;
    deploymentTypeToProvision: "prod" | "dev";
}): Promise<{
    projectSlug: string;
    teamSlug: string;
    projectsRemaining: number;
}>;
export declare const deploymentSelectionWithinProjectSchema: z.ZodDiscriminatedUnion<"kind", [z.ZodObject<{
    kind: z.ZodLiteral<"previewName">;
    previewName: z.ZodString;
}, "strip", z.ZodTypeAny, {
    kind: "previewName";
    previewName: string;
}, {
    kind: "previewName";
    previewName: string;
}>, z.ZodObject<{
    kind: z.ZodLiteral<"deploymentName">;
    deploymentName: z.ZodString;
}, "strip", z.ZodTypeAny, {
    kind: "deploymentName";
    deploymentName: string;
}, {
    kind: "deploymentName";
    deploymentName: string;
}>, z.ZodObject<{
    kind: z.ZodLiteral<"prod">;
}, "strip", z.ZodTypeAny, {
    kind: "prod";
}, {
    kind: "prod";
}>, z.ZodObject<{
    kind: z.ZodLiteral<"implicitProd">;
}, "strip", z.ZodTypeAny, {
    kind: "implicitProd";
}, {
    kind: "implicitProd";
}>, z.ZodObject<{
    kind: z.ZodLiteral<"ownDev">;
}, "strip", z.ZodTypeAny, {
    kind: "ownDev";
}, {
    kind: "ownDev";
}>]>;
export type DeploymentSelectionWithinProject = z.infer<typeof deploymentSelectionWithinProjectSchema>;
type DeploymentSelectionOptionsWithinProject = {
    prod?: boolean | undefined;
    implicitProd?: boolean;
    previewName?: string | undefined;
    deploymentName?: string | undefined;
};
export type DeploymentSelectionOptions = DeploymentSelectionOptionsWithinProject & {
    url?: string | undefined;
    adminKey?: string | undefined;
    envFile?: string | undefined;
};
export declare function deploymentSelectionWithinProjectFromOptions(options: DeploymentSelectionOptions): DeploymentSelectionWithinProject;
export declare function validateDeploymentSelectionForExistingDeployment(ctx: Context, deploymentSelection: DeploymentSelectionWithinProject, source: "selfHosted" | "deployKey" | "cliArgs"): Promise<undefined>;
export declare function checkAccessToSelectedProject(ctx: Context, projectSelection: ProjectSelection): Promise<{
    kind: "hasAccess";
    teamSlug: string;
    projectSlug: string;
} | {
    kind: "noAccess";
} | {
    kind: "unknown";
}>;
export declare function getTeamAndProjectSlugForDeployment(ctx: Context, selector: {
    deploymentName: string;
}): Promise<{
    teamSlug: string;
    projectSlug: string;
} | null>;
export declare function fetchDeploymentCredentialsProvisioningDevOrProdMaybeThrows(ctx: Context, projectSelection: {
    kind: "teamAndProjectSlugs";
    teamSlug: string;
    projectSlug: string;
} | {
    kind: "projectDeployKey";
    projectDeployKey: string;
}, deploymentType: "prod" | "dev"): Promise<{
    deploymentName: string;
    deploymentUrl: string;
    adminKey: AdminKey;
}>;
export type DetailedDeploymentCredentials = {
    adminKey: string;
    url: string;
    deploymentFields: {
        deploymentName: string;
        deploymentType: DeploymentType;
        projectSlug: string | null;
        teamSlug: string | null;
    } | null;
};
export declare function loadSelectedDeploymentCredentials(ctx: Context, deploymentSelection: DeploymentSelection, selectionWithinProject: DeploymentSelectionWithinProject, { ensureLocalRunning }?: {
    ensureLocalRunning: boolean;
}): Promise<DetailedDeploymentCredentials>;
export declare function fetchTeamAndProject(ctx: Context, deploymentName: string): Promise<{
    team: string;
    project: string;
    teamId: number;
    projectId: number;
}>;
export declare function fetchTeamAndProjectForKey(ctx: Context, deployKey: string): Promise<{
    team: string;
    project: string;
    teamId: number;
    projectId: number;
}>;
export declare function getTeamsForUser(ctx: Context): Promise<{
    id: number;
    name: string;
    slug: string;
}[]>;
export {};
//# sourceMappingURL=api.d.ts.map