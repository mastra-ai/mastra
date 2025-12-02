"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeploymentsSinglePage = exports.Deployments = void 0;
const resource_1 = require("../../../../resource.js");
const Core = __importStar(require("../../../../core.js"));
const projects_1 = require("../projects.js");
Object.defineProperty(exports, "DeploymentsSinglePage", { enumerable: true, get: function () { return projects_1.DeploymentsSinglePage; } });
const HistoryAPI = __importStar(require("./history/history.js"));
const history_1 = require("./history/history.js");
class Deployments extends resource_1.APIResource {
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
        return this._client.getAPIList(`/accounts/${account_id}/pages/projects/${projectName}/deployments`, projects_1.DeploymentsSinglePage, { query, ...options });
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
exports.Deployments = Deployments;
Deployments.History = history_1.History;
//# sourceMappingURL=deployments.js.map