"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Validate = void 0;
const resource_1 = require("../../resource.js");
const error_1 = require("../../error.js");
class Validate extends resource_1.APIResource {
    /**
     * Validates destination.
     *
     * @example
     * ```ts
     * const response = await client.logpush.validate.destination({
     *   destination_conf: 's3://mybucket/logs?region=us-west-2',
     *   account_id: 'account_id',
     * });
     * ```
     */
    destination(params, options) {
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
        return this._client.post(`/${accountOrZone}/${accountOrZoneId}/logpush/validate/destination`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Checks if there is an existing job with a destination.
     *
     * @example
     * ```ts
     * const response =
     *   await client.logpush.validate.destinationExists({
     *     destination_conf: 's3://mybucket/logs?region=us-west-2',
     *     account_id: 'account_id',
     *   });
     * ```
     */
    destinationExists(params, options) {
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
        return this._client.post(`/${accountOrZone}/${accountOrZoneId}/logpush/validate/destination/exists`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Validates logpull origin with logpull_options.
     *
     * @example
     * ```ts
     * const response = await client.logpush.validate.origin({
     *   logpull_options:
     *     'fields=RayID,ClientIP,EdgeStartTimestamp&timestamps=rfc3339',
     *   account_id: 'account_id',
     * });
     * ```
     */
    origin(params, options) {
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
        return this._client.post(`/${accountOrZone}/${accountOrZoneId}/logpush/validate/origin`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
}
exports.Validate = Validate;
//# sourceMappingURL=validate.js.map