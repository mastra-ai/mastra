import { Context } from "../../../bundler/context.js";
/**
 * Verified emails for a user that aren't known to be an admin email for
 * another WorkOS integration.
 */
export declare function getCandidateEmailsForWorkIntegration(ctx: Context): Promise<{
    availableEmails: string[];
}>;
export declare function getDeploymentCanProvisionWorkOSEnvironments(ctx: Context, deploymentName: string): Promise<{
    teamId: number;
    hasAssociatedWorkosTeam: boolean;
    disabled?: boolean;
}>;
export declare function createEnvironmentAndAPIKey(ctx: Context, deploymentName: string): Promise<{
    success: true;
    data: {
        environmentId: string;
        environmentName: string;
        clientId: string;
        apiKey: string;
        newlyProvisioned: boolean;
    };
} | {
    success: false;
    error: "team_not_provisioned";
    message: string;
}>;
export declare function createAssociatedWorkosTeam(ctx: Context, teamId: number, email: string): Promise<{
    result: "success";
    workosTeamId: string;
    workosTeamName: string;
} | {
    result: "emailAlreadyUsed";
    message: string;
}>;
//# sourceMappingURL=platformApi.d.ts.map