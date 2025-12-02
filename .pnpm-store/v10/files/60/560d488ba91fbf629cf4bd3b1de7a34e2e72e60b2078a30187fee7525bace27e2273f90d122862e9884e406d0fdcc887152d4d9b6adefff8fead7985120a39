"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Ownership = void 0;
const resource_1 = require("../../resource.js");
const error_1 = require("../../error.js");
class Ownership extends resource_1.APIResource {
    /**
     * Gets a new ownership challenge sent to your destination.
     *
     * @example
     * ```ts
     * const ownership = await client.logpush.ownership.create({
     *   destination_conf: 's3://mybucket/logs?region=us-west-2',
     *   account_id: 'account_id',
     * });
     * ```
     */
    create(params, options) {
        const { account_id, zone_id, ...body } = params;
        if (!account_id && !zone_id) {
            throw new error_1.CloudflareError('You must provide either account_id or zone_id.');
        }
        if (account_id && zone_id) {
            throw new error_1.CloudflareError('You cannot provide both account_id and zone_id.');
        }
        const { accountOrZone, accountOrZoneId } = account_id ?
            {
                accountOrZone: 'accounts',
                accountOrZoneId: account_id,
            }
            : {
                accountOrZone: 'zones',
                accountOrZoneId: zone_id,
            };
        return this._client.post(`/${accountOrZone}/${accountOrZoneId}/logpush/ownership`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Validates ownership challenge of the destination.
     *
     * @example
     * ```ts
     * const ownershipValidation =
     *   await client.logpush.ownership.validate({
     *     destination_conf: 's3://mybucket/logs?region=us-west-2',
     *     ownership_challenge: '00000000000000000000',
     *     account_id: 'account_id',
     *   });
     * ```
     */
    validate(params, options) {
        const { account_id, zone_id, ...body } = params;
        if (!account_id && !zone_id) {
            throw new error_1.CloudflareError('You must provide either account_id or zone_id.');
        }
        if (account_id && zone_id) {
            throw new error_1.CloudflareError('You cannot provide both account_id and zone_id.');
        }
        const { accountOrZone, accountOrZoneId } = account_id ?
            {
                accountOrZone: 'accounts',
                accountOrZoneId: account_id,
            }
            : {
                accountOrZone: 'zones',
                accountOrZoneId: zone_id,
            };
        return this._client.post(`/${accountOrZone}/${accountOrZoneId}/logpush/ownership/validate`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
}
exports.Ownership = Ownership;
//# sourceMappingURL=ownership.js.map