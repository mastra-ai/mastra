// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../resource.mjs";
import { SinglePage } from "../../pagination.mjs";
export class Domains extends APIResource {
    /**
     * Update individual domain.
     *
     * @example
     * ```ts
     * const domain = await client.registrar.domains.update(
     *   'cloudflare.com',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    update(domainName, params, options) {
        const { account_id, ...body } = params;
        return this._client.put(`/accounts/${account_id}/registrar/domains/${domainName}`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * List domains handled by Registrar.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const domain of client.registrar.domains.list({
     *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * })) {
     *   // ...
     * }
     * ```
     */
    list(params, options) {
        const { account_id } = params;
        return this._client.getAPIList(`/accounts/${account_id}/registrar/domains`, DomainsSinglePage, options);
    }
    /**
     * Show individual domain.
     *
     * @example
     * ```ts
     * const domain = await client.registrar.domains.get(
     *   'cloudflare.com',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    get(domainName, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/registrar/domains/${domainName}`, options)._thenUnwrap((obj) => obj.result);
    }
}
export class DomainsSinglePage extends SinglePage {
}
Domains.DomainsSinglePage = DomainsSinglePage;
//# sourceMappingURL=domains.mjs.map