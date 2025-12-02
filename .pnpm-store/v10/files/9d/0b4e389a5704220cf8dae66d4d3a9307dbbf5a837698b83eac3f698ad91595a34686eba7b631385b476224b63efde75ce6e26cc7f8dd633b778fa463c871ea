import { Context } from "../../../bundler/context.js";
/**
 * Ensure the current deployment has the three expected WorkOS environment
 * variables defined with values corresponding to a valid WorkOS deployment.
 *
 * This may involve provisioning a WorkOS deployment or even (in interactive
 * terminals only) prompting to provision a new WorkOS team to be associated
 * with this Convex team.
 */
export declare function ensureWorkosEnvironmentProvisioned(ctx: Context, deploymentName: string, deployment: {
    deploymentUrl: string;
    adminKey: string;
    deploymentNotice: string;
}, options: {
    offerToAssociateWorkOSTeam: boolean;
    autoProvisionIfWorkOSTeamAssociated: boolean;
    autoConfigureAuthkitConfig: boolean;
}): Promise<"ready" | "choseNotToAssociatedTeam">;
export declare function tryToCreateAssociatedWorkosTeam(ctx: Context, deploymentName: string, teamId: number): Promise<"ready" | "choseNotToAssociatedTeam">;
//# sourceMappingURL=workos.d.ts.map