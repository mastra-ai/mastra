// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
import { SinglePage } from "../../../pagination.mjs";
export class Domains extends APIResource {
    /**
     * Add a new domain for the Pages project.
     *
     * @example
     * ```ts
     * const domain = await client.pages.projects.domains.create(
     *   'this-is-my-project-01',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    create(projectName, params, options) {
        const { account_id, ...body } = params;
        return this._client.post(`/accounts/${account_id}/pages/projects/${projectName}/domains`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Fetch a list of all domains associated with a Pages project.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const domainListResponse of client.pages.projects.domains.list(
     *   'this-is-my-project-01',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(projectName, params, options) {
        const { account_id } = params;
        return this._client.getAPIList(`/accounts/${account_id}/pages/projects/${projectName}/domains`, DomainListResponsesSinglePage, options);
    }
    /**
     * Delete a Pages project's domain.
     *
     * @example
     * ```ts
     * const domain = await client.pages.projects.domains.delete(
     *   'this-is-my-project-01',
     *   'this-is-my-domain-01.com',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    delete(projectName, domainName, params, options) {
        const { account_id } = params;
        return this._client.delete(`/accounts/${account_id}/pages/projects/${projectName}/domains/${domainName}`, options)._thenUnwrap((obj) => obj.result);
    }
    /**
     * Retry the validation status of a single domain.
     *
     * @example
     * ```ts
     * const response = await client.pages.projects.domains.edit(
     *   'this-is-my-project-01',
     *   'this-is-my-domain-01.com',
     *   {
     *     account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *     body: {},
     *   },
     * );
     * ```
     */
    edit(projectName, domainName, params, options) {
        const { account_id, body } = params;
        return this._client.patch(`/accounts/${account_id}/pages/projects/${projectName}/domains/${domainName}`, {
            body: body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Fetch a single domain.
     *
     * @example
     * ```ts
     * const domain = await client.pages.projects.domains.get(
     *   'this-is-my-project-01',
     *   'this-is-my-domain-01.com',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    get(projectName, domainName, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/pages/projects/${projectName}/domains/${domainName}`, options)._thenUnwrap((obj) => obj.result);
    }
}
export class DomainListResponsesSinglePage extends SinglePage {
}
Domains.DomainListResponsesSinglePage = DomainListResponsesSinglePage;
//# sourceMappingURL=domains.mjs.map