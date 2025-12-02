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
exports.DeploymentsSinglePage = exports.Projects = void 0;
const resource_1 = require("../../../resource.js");
const DomainsAPI = __importStar(require("./domains.js"));
const domains_1 = require("./domains.js");
const DeploymentsAPI = __importStar(require("./deployments/deployments.js"));
const deployments_1 = require("./deployments/deployments.js");
const pagination_1 = require("../../../pagination.js");
class Projects extends resource_1.APIResource {
    constructor() {
        super(...arguments);
        this.deployments = new DeploymentsAPI.Deployments(this._client);
        this.domains = new DomainsAPI.Domains(this._client);
    }
    /**
     * Create a new project.
     *
     * @example
     * ```ts
     * const project = await client.pages.projects.create({
     *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * });
     * ```
     */
    create(params, options) {
        const { account_id, ...body } = params;
        return this._client.post(`/accounts/${account_id}/pages/projects`, { body, ...options })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Fetch a list of all user projects.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const deployment of client.pages.projects.list({
     *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * })) {
     *   // ...
     * }
     * ```
     */
    list(params, options) {
        const { account_id } = params;
        return this._client.getAPIList(`/accounts/${account_id}/pages/projects`, DeploymentsSinglePage, options);
    }
    /**
     * Delete a project by name.
     *
     * @example
     * ```ts
     * const project = await client.pages.projects.delete(
     *   'this-is-my-project-01',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    delete(projectName, params, options) {
        const { account_id } = params;
        return this._client.delete(`/accounts/${account_id}/pages/projects/${projectName}`, options)._thenUnwrap((obj) => obj.result);
    }
    /**
     * Set new attributes for an existing project. Modify environment variables. To
     * delete an environment variable, set the key to null.
     *
     * @example
     * ```ts
     * const project = await client.pages.projects.edit(
     *   'this-is-my-project-01',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    edit(projectName, params, options) {
        const { account_id, ...body } = params;
        return this._client.patch(`/accounts/${account_id}/pages/projects/${projectName}`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Fetch a project by name.
     *
     * @example
     * ```ts
     * const project = await client.pages.projects.get(
     *   'this-is-my-project-01',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    get(projectName, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/pages/projects/${projectName}`, options)._thenUnwrap((obj) => obj.result);
    }
    /**
     * Purge all cached build artifacts for a Pages project
     *
     * @example
     * ```ts
     * const response =
     *   await client.pages.projects.purgeBuildCache(
     *     'this-is-my-project-01',
     *     { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    purgeBuildCache(projectName, params, options) {
        const { account_id } = params;
        return this._client.post(`/accounts/${account_id}/pages/projects/${projectName}/purge_build_cache`, options)._thenUnwrap((obj) => obj.result);
    }
}
exports.Projects = Projects;
class DeploymentsSinglePage extends pagination_1.SinglePage {
}
exports.DeploymentsSinglePage = DeploymentsSinglePage;
Projects.DeploymentsSinglePage = DeploymentsSinglePage;
Projects.Deployments = deployments_1.Deployments;
Projects.Domains = domains_1.Domains;
Projects.DomainListResponsesSinglePage = domains_1.DomainListResponsesSinglePage;
//# sourceMappingURL=projects.js.map