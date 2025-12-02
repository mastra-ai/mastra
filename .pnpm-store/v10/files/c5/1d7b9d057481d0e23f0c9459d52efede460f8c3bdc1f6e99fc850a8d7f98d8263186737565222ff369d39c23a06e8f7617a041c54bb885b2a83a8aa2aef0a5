import { Context } from "../../../bundler/context.js";
export declare function bigBrainStart(ctx: Context, data: {
    port: number;
    projectSlug: string;
    teamSlug: string;
    instanceName: string | null;
}): Promise<{
    deploymentName: string;
    adminKey: string;
}>;
export declare function bigBrainPause(ctx: Context, data: {
    projectSlug: string;
    teamSlug: string;
}): Promise<void>;
export declare function bigBrainRecordActivity(ctx: Context, data: {
    instanceName: string;
}): Promise<any>;
export declare function bigBrainEnableFeatureMetadata(ctx: Context): Promise<{
    totalProjects: {
        kind: "none" | "one" | "multiple";
    };
}>;
export declare function bigBrainGenerateAdminKeyForAnonymousDeployment(ctx: Context, data: {
    instanceName: string;
    instanceSecret: string;
}): Promise<any>;
/** Whether a project already has a cloud dev deployment for this user. */
export declare function projectHasExistingCloudDev(ctx: Context, { projectSlug, teamSlug, }: {
    projectSlug: string;
    teamSlug: string;
}): Promise<boolean>;
//# sourceMappingURL=bigBrain.d.ts.map