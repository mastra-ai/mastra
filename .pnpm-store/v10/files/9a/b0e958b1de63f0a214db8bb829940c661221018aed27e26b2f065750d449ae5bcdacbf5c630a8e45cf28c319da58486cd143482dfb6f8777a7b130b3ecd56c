"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.ACLsSinglePage = exports.ACLs = void 0;
const resource_1 = require("../../../resource.js");
const pagination_1 = require("../../../pagination.js");
class ACLs extends resource_1.APIResource {
    /**
     * Create ACL.
     *
     * @example
     * ```ts
     * const acl = await client.dns.zoneTransfers.acls.create({
     *   account_id: '01a7362d577a6c3019a474fd6f485823',
     *   ip_range: '192.0.2.53/28',
     *   name: 'my-acl-1',
     * });
     * ```
     */
    create(params, options) {
        const { account_id, ...body } = params;
        return this._client.post(`/accounts/${account_id}/secondary_dns/acls`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Modify ACL.
     *
     * @example
     * ```ts
     * const acl = await client.dns.zoneTransfers.acls.update(
     *   '23ff594956f20c2a721606e94745a8aa',
     *   {
     *     account_id: '01a7362d577a6c3019a474fd6f485823',
     *     ip_range: '192.0.2.53/28',
     *     name: 'my-acl-1',
     *   },
     * );
     * ```
     */
    update(aclId, params, options) {
        const { account_id, ...body } = params;
        return this._client.put(`/accounts/${account_id}/secondary_dns/acls/${aclId}`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * List ACLs.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const acl of client.dns.zoneTransfers.acls.list({
     *   account_id: '01a7362d577a6c3019a474fd6f485823',
     * })) {
     *   // ...
     * }
     * ```
     */
    list(params, options) {
        const { account_id } = params;
        return this._client.getAPIList(`/accounts/${account_id}/secondary_dns/acls`, ACLsSinglePage, options);
    }
    /**
     * Delete ACL.
     *
     * @example
     * ```ts
     * const acl = await client.dns.zoneTransfers.acls.delete(
     *   '23ff594956f20c2a721606e94745a8aa',
     *   { account_id: '01a7362d577a6c3019a474fd6f485823' },
     * );
     * ```
     */
    delete(aclId, params, options) {
        const { account_id } = params;
        return this._client.delete(`/accounts/${account_id}/secondary_dns/acls/${aclId}`, options)._thenUnwrap((obj) => obj.result);
    }
    /**
     * Get ACL.
     *
     * @example
     * ```ts
     * const acl = await client.dns.zoneTransfers.acls.get(
     *   '23ff594956f20c2a721606e94745a8aa',
     *   { account_id: '01a7362d577a6c3019a474fd6f485823' },
     * );
     * ```
     */
    get(aclId, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/secondary_dns/acls/${aclId}`, options)._thenUnwrap((obj) => obj.result);
    }
}
exports.ACLs = ACLs;
class ACLsSinglePage extends pagination_1.SinglePage {
}
exports.ACLsSinglePage = ACLsSinglePage;
ACLs.ACLsSinglePage = ACLsSinglePage;
//# sourceMappingURL=acls.js.map