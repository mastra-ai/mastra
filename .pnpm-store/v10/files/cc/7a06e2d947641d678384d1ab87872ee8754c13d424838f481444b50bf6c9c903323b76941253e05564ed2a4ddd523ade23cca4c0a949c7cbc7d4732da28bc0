import { APIResource } from "../../../../resource.js";
import * as Core from "../../../../core.js";
import * as ProjectsAPI from "../projects.js";
import { DeploymentsSinglePage } from "../projects.js";
import * as HistoryAPI from "./history/history.js";
import { History } from "./history/history.js";
export declare class Deployments extends APIResource {
    history: HistoryAPI.History;
    /**
     * Start a new deployment from production. The repository and account must have
     * already been authorized on the Cloudflare Pages dashboard.
     *
     * @example
     * ```ts
     * const deployment =
     *   await client.pages.projects.deployments.create(
     *     'this-is-my-project-01',
     *     { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    create(projectName: string, params: DeploymentCreateParams, options?: Core.RequestOptions): Core.APIPromise<ProjectsAPI.Deployment>;
    /**
     * Fetch a list of project deployments.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const deployment of client.pages.projects.deployments.list(
     *   'this-is-my-project-01',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(projectName: string, params: DeploymentListParams, options?: Core.RequestOptions): Core.PagePromise<DeploymentsSinglePage, ProjectsAPI.Deployment>;
    /**
     * Delete a deployment.
     *
     * @example
     * ```ts
     * const deployment =
     *   await client.pages.projects.deployments.delete(
     *     'this-is-my-project-01',
     *     '023e105f4ecef8ad9ca31a8372d0c353',
     *     { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    delete(projectName: string, deploymentId: string, params: DeploymentDeleteParams, options?: Core.RequestOptions): Core.APIPromise<DeploymentDeleteResponse | null>;
    /**
     * Fetch information about a deployment.
     *
     * @example
     * ```ts
     * const deployment =
     *   await client.pages.projects.deployments.get(
     *     'this-is-my-project-01',
     *     '023e105f4ecef8ad9ca31a8372d0c353',
     *     { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    get(projectName: string, deploymentId: string, params: DeploymentGetParams, options?: Core.RequestOptions): Core.APIPromise<ProjectsAPI.Deployment>;
    /**
     * Retry a previous deployment.
     *
     * @example
     * ```ts
     * const deployment =
     *   await client.pages.projects.deployments.retry(
     *     'this-is-my-project-01',
     *     '023e105f4ecef8ad9ca31a8372d0c353',
     *     {
     *       account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *       body: {},
     *     },
     *   );
     * ```
     */
    retry(projectName: string, deploymentId: string, params: DeploymentRetryParams, options?: Core.RequestOptions): Core.APIPromise<ProjectsAPI.Deployment>;
    /**
     * Rollback the production deployment to a previous deployment. You can only
     * rollback to succesful builds on production.
     *
     * @example
     * ```ts
     * const deployment =
     *   await client.pages.projects.deployments.rollback(
     *     'this-is-my-project-01',
     *     '023e105f4ecef8ad9ca31a8372d0c353',
     *     {
     *       account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *       body: {},
     *     },
     *   );
     * ```
     */
    rollback(projectName: string, deploymentId: string, params: DeploymentRollbackParams, options?: Core.RequestOptions): Core.APIPromise<ProjectsAPI.Deployment>;
}
export type DeploymentDeleteResponse = unknown;
export interface DeploymentCreateParams {
    /**
     * Path param: Identifier
     */
    account_id: string;
    /**
     * Body param: The branch to build the new deployment from. The `HEAD` of the
     * branch will be used. If omitted, the production branch will be used by default.
     */
    branch?: string;
}
export interface DeploymentListParams {
    /**
     * Path param: Identifier
     */
    account_id: string;
    /**
     * Query param: What type of deployments to fetch.
     */
    env?: 'production' | 'preview';
}
export interface DeploymentDeleteParams {
    /**
     * Identifier
     */
    account_id: string;
}
export interface DeploymentGetParams {
    /**
     * Identifier
     */
    account_id: string;
}
export interface DeploymentRetryParams {
    /**
     * Path param: Identifier
     */
    account_id: string;
    /**
     * Body param:
     */
    body: unknown;
}
export interface DeploymentRollbackParams {
    /**
     * Path param: Identifier
     */
    account_id: string;
    /**
     * Body param:
     */
    body: unknown;
}
export declare namespace Deployments {
    export { type DeploymentDeleteResponse as DeploymentDeleteResponse, type DeploymentCreateParams as DeploymentCreateParams, type DeploymentListParams as DeploymentListParams, type DeploymentDeleteParams as DeploymentDeleteParams, type DeploymentGetParams as DeploymentGetParams, type DeploymentRetryParams as DeploymentRetryParams, type DeploymentRollbackParams as DeploymentRollbackParams, };
    export { History as History };
}
export { DeploymentsSinglePage };
//# sourceMappingURL=deployments.d.ts.map