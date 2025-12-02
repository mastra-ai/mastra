// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../../resource.mjs";
import * as Core from "../../../../core.mjs";
import { DeploymentsSinglePage } from "../projects.mjs";
import * as HistoryAPI from "./history/history.mjs";
import { History } from "./history/history.mjs";
export class Deployments extends APIResource {
    constructor() {
        super(...arguments);
        this.history = new HistoryAPI.History(this._client);
    }
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
    create(projectName, params, options) {
        const { account_id, ...body } = params;
        return this._client.post(`/accounts/${account_id}/pages/projects/${projectName}/deployments`, Core.multipartFormRequestOptions({ body, ...options }))._thenUnwrap((obj) => obj.result);
    }
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
    list(projectName, params, options) {
        const { account_id, ...query } = params;
        return this._client.getAPIList(`/accounts/${account_id}/pages/projects/${projectName}/deployments`, DeploymentsSinglePage, { query, ...options });
    }
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
    delete(projectName, deploymentId, params, options) {
        const { account_id } = params;
        return this._client.delete(`/accounts/${account_id}/pages/projects/${projectName}/deployments/${deploymentId}`, options)._thenUnwrap((obj) => obj.result);
    }
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
    get(projectName, deploymentId, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/pages/projects/${projectName}/deployments/${deploymentId}`, options)._thenUnwrap((obj) => obj.result);
    }
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
    retry(projectName, deploymentId, params, options) {
        const { account_id, body } = params;
        return this._client.post(`/accounts/${account_id}/pages/projects/${projectName}/deployments/${deploymentId}/retry`, { body: body, ...options })._thenUnwrap((obj) => obj.result);
    }
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
    rollback(projectName, deploymentId, params, options) {
        const { account_id, body } = params;
        return this._client.post(`/accounts/${account_id}/pages/projects/${projectName}/deployments/${deploymentId}/rollback`, { body: body, ...options })._thenUnwrap((obj) => obj.result);
    }
}
Deployments.History = History;
export { DeploymentsSinglePage };
//# sourceMappingURL=deployments.mjs.map