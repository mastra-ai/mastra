"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.ACLsSinglePage = exports.ACLs = void 0;
const resource_1 = require("../../../resource.js");
const pagination_1 = require("../../../pagination.js");
class ACLs extends resource_1.APIResource {
    /**
     * Creates a new Site ACL.
     *
     * @example
     * ```ts
     * const acl = await client.magicTransit.sites.acls.create(
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   {
     *     account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *     lan_1: { lan_id: 'lan_id' },
     *     lan_2: { lan_id: 'lan_id' },
     *     name: 'PIN Pad - Cash Register',
     *   },
     * );
     * ```
     */
    create(siteId, params, options) {
        const { account_id, ...body } = params;
        return this._client.post(`/accounts/${account_id}/magic/sites/${siteId}/acls`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Update a specific Site ACL.
     *
     * @example
     * ```ts
     * const acl = await client.magicTransit.sites.acls.update(
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    update(siteId, aclId, params, options) {
        const { account_id, ...body } = params;
        return this._client.put(`/accounts/${account_id}/magic/sites/${siteId}/acls/${aclId}`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Lists Site ACLs associated with an account.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const acl of client.magicTransit.sites.acls.list(
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(siteId, params, options) {
        const { account_id } = params;
        return this._client.getAPIList(`/accounts/${account_id}/magic/sites/${siteId}/acls`, ACLsSinglePage, options);
    }
    /**
     * Remove a specific Site ACL.
     *
     * @example
     * ```ts
     * const acl = await client.magicTransit.sites.acls.delete(
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    delete(siteId, aclId, params, options) {
        const { account_id } = params;
        return this._client.delete(`/accounts/${account_id}/magic/sites/${siteId}/acls/${aclId}`, options)._thenUnwrap((obj) => obj.result);
    }
    /**
     * Patch a specific Site ACL.
     *
     * @example
     * ```ts
     * const acl = await client.magicTransit.sites.acls.edit(
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    edit(siteId, aclId, params, options) {
        const { account_id, ...body } = params;
        return this._client.patch(`/accounts/${account_id}/magic/sites/${siteId}/acls/${aclId}`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Get a specific Site ACL.
     *
     * @example
     * ```ts
     * const acl = await client.magicTransit.sites.acls.get(
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    get(siteId, aclId, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/magic/sites/${siteId}/acls/${aclId}`, options)._thenUnwrap((obj) => obj.result);
    }
}
exports.ACLs = ACLs;
class ACLsSinglePage extends pagination_1.SinglePage {
}
exports.ACLsSinglePage = ACLsSinglePage;
ACLs.ACLsSinglePage = ACLsSinglePage;
//# sourceMappingURL=acls.js.map