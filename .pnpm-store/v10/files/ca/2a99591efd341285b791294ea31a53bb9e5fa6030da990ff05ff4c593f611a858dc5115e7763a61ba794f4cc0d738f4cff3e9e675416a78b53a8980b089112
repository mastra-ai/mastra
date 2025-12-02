// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
import * as DomainsAPI from "./domains.mjs";
import { DomainListResponsesSinglePage, Domains, } from "./domains.mjs";
import * as DeploymentsAPI from "./deployments/deployments.mjs";
import { Deployments, } from "./deployments/deployments.mjs";
import { SinglePage } from "../../../pagination.mjs";
export class Projects extends APIResource {
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
export class DeploymentsSinglePage extends SinglePage {
}
Projects.DeploymentsSinglePage = DeploymentsSinglePage;
Projects.Deployments = Deployments;
Projects.Domains = Domains;
Projects.DomainListResponsesSinglePage = DomainListResponsesSinglePage;
//# sourceMappingURL=projects.mjs.map