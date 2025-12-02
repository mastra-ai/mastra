"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.DomainsSinglePage = exports.Domains = void 0;
const resource_1 = require("../../resource.js");
const pagination_1 = require("../../pagination.js");
class Domains extends resource_1.APIResource {
    /**
     * Attaches a Worker to a zone and hostname.
     *
     * @example
     * ```ts
     * const domain = await client.workers.domains.update({
     *   account_id: '9a7806061c88ada191ed06f989cc3dac',
     *   environment: 'production',
     *   hostname: 'foo.example.com',
     *   service: 'foo',
     *   zone_id: '593c9c94de529bbbfaac7c53ced0447d',
     * });
     * ```
     */
    update(params, options) {
        const { account_id, ...body } = params;
        return this._client.put(`/accounts/${account_id}/workers/domains`, { body, ...options })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Lists all Worker Domains for an account.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const domain of client.workers.domains.list({
     *   account_id: '9a7806061c88ada191ed06f989cc3dac',
     * })) {
     *   // ...
     * }
     * ```
     */
    list(params, options) {
        const { account_id, ...query } = params;
        return this._client.getAPIList(`/accounts/${account_id}/workers/domains`, DomainsSinglePage, {
            query,
            ...options,
        });
    }
    /**
     * Detaches a Worker from a zone and hostname.
     *
     * @example
     * ```ts
     * await client.workers.domains.delete(
     *   'dbe10b4bc17c295377eabd600e1787fd',
     *   { account_id: '9a7806061c88ada191ed06f989cc3dac' },
     * );
     * ```
     */
    delete(domainId, params, options) {
        const { account_id } = params;
        return this._client.delete(`/accounts/${account_id}/workers/domains/${domainId}`, {
            ...options,
            headers: { Accept: '*/*', ...options?.headers },
        });
    }
    /**
     * Gets a Worker domain.
     *
     * @example
     * ```ts
     * const domain = await client.workers.domains.get(
     *   'dbe10b4bc17c295377eabd600e1787fd',
     *   { account_id: '9a7806061c88ada191ed06f989cc3dac' },
     * );
     * ```
     */
    get(domainId, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/workers/domains/${domainId}`, options)._thenUnwrap((obj) => obj.result);
    }
}
exports.Domains = Domains;
class DomainsSinglePage extends pagination_1.SinglePage {
}
exports.DomainsSinglePage = DomainsSinglePage;
Domains.DomainsSinglePage = DomainsSinglePage;
//# sourceMappingURL=domains.js.map