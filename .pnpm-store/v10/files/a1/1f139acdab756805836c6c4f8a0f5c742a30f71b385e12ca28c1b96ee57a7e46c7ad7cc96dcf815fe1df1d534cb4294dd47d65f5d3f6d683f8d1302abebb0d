"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.TSIGsSinglePage = exports.TSIGs = void 0;
const resource_1 = require("../../../resource.js");
const pagination_1 = require("../../../pagination.js");
class TSIGs extends resource_1.APIResource {
    /**
     * Create TSIG.
     *
     * @example
     * ```ts
     * const tsig = await client.dns.zoneTransfers.tsigs.create({
     *   account_id: '01a7362d577a6c3019a474fd6f485823',
     *   algo: 'hmac-sha512.',
     *   name: 'tsig.customer.cf.',
     *   secret:
     *     'caf79a7804b04337c9c66ccd7bef9190a1e1679b5dd03d8aa10f7ad45e1a9dab92b417896c15d4d007c7c14194538d2a5d0feffdecc5a7f0e1c570cfa700837c',
     * });
     * ```
     */
    create(params, options) {
        const { account_id, ...body } = params;
        return this._client.post(`/accounts/${account_id}/secondary_dns/tsigs`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Modify TSIG.
     *
     * @example
     * ```ts
     * const tsig = await client.dns.zoneTransfers.tsigs.update(
     *   '69cd1e104af3e6ed3cb344f263fd0d5a',
     *   {
     *     account_id: '01a7362d577a6c3019a474fd6f485823',
     *     algo: 'hmac-sha512.',
     *     name: 'tsig.customer.cf.',
     *     secret:
     *       'caf79a7804b04337c9c66ccd7bef9190a1e1679b5dd03d8aa10f7ad45e1a9dab92b417896c15d4d007c7c14194538d2a5d0feffdecc5a7f0e1c570cfa700837c',
     *   },
     * );
     * ```
     */
    update(tsigId, params, options) {
        const { account_id, ...body } = params;
        return this._client.put(`/accounts/${account_id}/secondary_dns/tsigs/${tsigId}`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * List TSIGs.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const tsig of client.dns.zoneTransfers.tsigs.list(
     *   { account_id: '01a7362d577a6c3019a474fd6f485823' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(params, options) {
        const { account_id } = params;
        return this._client.getAPIList(`/accounts/${account_id}/secondary_dns/tsigs`, TSIGsSinglePage, options);
    }
    /**
     * Delete TSIG.
     *
     * @example
     * ```ts
     * const tsig = await client.dns.zoneTransfers.tsigs.delete(
     *   '69cd1e104af3e6ed3cb344f263fd0d5a',
     *   { account_id: '01a7362d577a6c3019a474fd6f485823' },
     * );
     * ```
     */
    delete(tsigId, params, options) {
        const { account_id } = params;
        return this._client.delete(`/accounts/${account_id}/secondary_dns/tsigs/${tsigId}`, options)._thenUnwrap((obj) => obj.result);
    }
    /**
     * Get TSIG.
     *
     * @example
     * ```ts
     * const tsig = await client.dns.zoneTransfers.tsigs.get(
     *   '69cd1e104af3e6ed3cb344f263fd0d5a',
     *   { account_id: '01a7362d577a6c3019a474fd6f485823' },
     * );
     * ```
     */
    get(tsigId, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/secondary_dns/tsigs/${tsigId}`, options)._thenUnwrap((obj) => obj.result);
    }
}
exports.TSIGs = TSIGs;
class TSIGsSinglePage extends pagination_1.SinglePage {
}
exports.TSIGsSinglePage = TSIGsSinglePage;
TSIGs.TSIGsSinglePage = TSIGsSinglePage;
//# sourceMappingURL=tsigs.js.map