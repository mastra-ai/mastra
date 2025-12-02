"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.CfInterconnects = void 0;
const resource_1 = require("../../resource.js");
class CfInterconnects extends resource_1.APIResource {
    /**
     * Updates a specific interconnect associated with an account. Use
     * `?validate_only=true` as an optional query parameter to only run validation
     * without persisting changes.
     *
     * @example
     * ```ts
     * const cfInterconnect =
     *   await client.magicTransit.cfInterconnects.update(
     *     '023e105f4ecef8ad9ca31a8372d0c353',
     *     { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    update(cfInterconnectId, params, options) {
        const { account_id, 'x-magic-new-hc-target': xMagicNewHcTarget, ...body } = params;
        return this._client.put(`/accounts/${account_id}/magic/cf_interconnects/${cfInterconnectId}`, {
            body,
            ...options,
            headers: {
                ...(xMagicNewHcTarget?.toString() != null ?
                    { 'x-magic-new-hc-target': xMagicNewHcTarget?.toString() }
                    : undefined),
                ...options?.headers,
            },
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Lists interconnects associated with an account.
     *
     * @example
     * ```ts
     * const cfInterconnects =
     *   await client.magicTransit.cfInterconnects.list({
     *     account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *   });
     * ```
     */
    list(params, options) {
        const { account_id, 'x-magic-new-hc-target': xMagicNewHcTarget } = params;
        return this._client.get(`/accounts/${account_id}/magic/cf_interconnects`, {
            ...options,
            headers: {
                ...(xMagicNewHcTarget?.toString() != null ?
                    { 'x-magic-new-hc-target': xMagicNewHcTarget?.toString() }
                    : undefined),
                ...options?.headers,
            },
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Updates multiple interconnects associated with an account. Use
     * `?validate_only=true` as an optional query parameter to only run validation
     * without persisting changes.
     *
     * @example
     * ```ts
     * const response =
     *   await client.magicTransit.cfInterconnects.bulkUpdate({
     *     account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *     body: {},
     *   });
     * ```
     */
    bulkUpdate(params, options) {
        const { account_id, body, 'x-magic-new-hc-target': xMagicNewHcTarget } = params;
        return this._client.put(`/accounts/${account_id}/magic/cf_interconnects`, {
            body: body,
            ...options,
            headers: {
                ...(xMagicNewHcTarget?.toString() != null ?
                    { 'x-magic-new-hc-target': xMagicNewHcTarget?.toString() }
                    : undefined),
                ...options?.headers,
            },
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Lists details for a specific interconnect.
     *
     * @example
     * ```ts
     * const cfInterconnect =
     *   await client.magicTransit.cfInterconnects.get(
     *     '023e105f4ecef8ad9ca31a8372d0c353',
     *     { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    get(cfInterconnectId, params, options) {
        const { account_id, 'x-magic-new-hc-target': xMagicNewHcTarget } = params;
        return this._client.get(`/accounts/${account_id}/magic/cf_interconnects/${cfInterconnectId}`, {
            ...options,
            headers: {
                ...(xMagicNewHcTarget?.toString() != null ?
                    { 'x-magic-new-hc-target': xMagicNewHcTarget?.toString() }
                    : undefined),
                ...options?.headers,
            },
        })._thenUnwrap((obj) => obj.result);
    }
}
exports.CfInterconnects = CfInterconnects;
//# sourceMappingURL=cf-interconnects.js.map