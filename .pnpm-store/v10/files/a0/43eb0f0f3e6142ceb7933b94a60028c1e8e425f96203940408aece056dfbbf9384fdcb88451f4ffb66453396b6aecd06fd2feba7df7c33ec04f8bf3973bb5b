import { Context } from "../../bundler/context.js";
import { AccountRequiredDeploymentType, DeploymentType } from "./api.js";
/**
 * The auth header can be a few different things:
 * * An access token (corresponds to device authorization, usually stored in `~/.convex/config.json`)
 * * A preview deploy key (set via the `CONVEX_DEPLOY_KEY` environment variable)
 * * A project key (set via the `CONVEX_DEPLOY_KEY` environment variable)
 * * A deployment key if a deployment key (set via `CONVEX_DEPLOY_KEY` environment variable)
 *
 * Project keys take precedence over the the access token.
 * Deployment keys take precedence over the the access token.
 * This makes using one of these keys while logged in or logged out work the same.
 *
 * We check for the `CONVEX_DEPLOY_KEY` in the `--env-file` if it's provided.
 * Otherwise, we check in the `.env` and `.env.local` files.
 *
 * If we later prompt for log in, we need to call `ctx.setBigBrainAuthHeader` to
 * update the value.
 *
 * @param ctx
 * @param envFile
 * @returns
 */
export declare function initializeBigBrainAuth(ctx: Context, initialArgs: {
    url?: string | undefined;
    adminKey?: string | undefined;
    envFile?: string | undefined;
}): Promise<void>;
export declare function updateBigBrainAuthAfterLogin(ctx: Context, accessToken: string): Promise<void>;
export declare function clearBigBrainAuth(ctx: Context): Promise<void>;
/**
 * Our CLI has logic to select which deployment to act on.
 *
 * We first check whether we're targeting a deployment within a project, or if we
 * know exactly which deployment to act on (e.g. in the case of self-hosting).
 *
 * We also special case preview deploys since the presence of a preview deploy key
 * triggers different behavior in `npx convex deploy`.
 *
 * Most commands will immediately compute the deployment selection, and then combine
 * that with any relevant CLI flags to figure out which deployment to talk to.
 *
 * Different commands do different things (e.g. `dev` will allow you to create a new project,
 * `deploy` has different behavior for preview deploys)
 *
 * This should be kept in sync with `initializeBigBrainAuth` since environment variables
 * like `CONVEX_DEPLOY_KEY` are used for both deployment selection and auth.
 */
export type DeploymentSelection = {
    kind: "existingDeployment";
    deploymentToActOn: {
        url: string;
        adminKey: string;
        deploymentFields: {
            deploymentName: string;
            deploymentType: DeploymentType;
            projectSlug: string;
            teamSlug: string;
        } | null;
        source: "selfHosted" | "deployKey" | "cliArgs";
    };
} | {
    kind: "deploymentWithinProject";
    targetProject: ProjectSelection;
} | {
    kind: "preview";
    previewDeployKey: string;
} | {
    kind: "chooseProject";
} | {
    kind: "anonymous";
    deploymentName: string | null;
};
export type ProjectSelection = {
    kind: "teamAndProjectSlugs";
    teamSlug: string;
    projectSlug: string;
} | {
    kind: "deploymentName";
    deploymentName: string;
    deploymentType: AccountRequiredDeploymentType | null;
} | {
    kind: "projectDeployKey";
    projectDeployKey: string;
};
export declare function getDeploymentSelection(ctx: Context, cliArgs: {
    url?: string | undefined;
    adminKey?: string | undefined;
    envFile?: string | undefined;
}): Promise<DeploymentSelection>;
/**
 * Used for things like `npx convex docs` where we want to best effort extract a deployment name
 * but don't do the full deployment selection logic.
 */
export declare const deploymentNameFromSelection: (selection: DeploymentSelection) => string | null;
export declare const deploymentNameAndTypeFromSelection: (selection: DeploymentSelection) => {
    name: string | null;
    type: string | null;
} | null;
export declare const shouldAllowAnonymousDevelopment: () => boolean;
//# sourceMappingURL=deploymentSelection.d.ts.map