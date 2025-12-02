"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Settings = void 0;
const resource_1 = require("../../../../resource.js");
const error_1 = require("../../../../error.js");
class Settings extends resource_1.APIResource {
    /**
     * Updates Access application settings.
     *
     * @example
     * ```ts
     * const setting =
     *   await client.zeroTrust.access.applications.settings.update(
     *     '023e105f4ecef8ad9ca31a8372d0c353',
     *     { account_id: 'account_id' },
     *   );
     * ```
     */
    update(appId, params, options) {
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
        return this._client.put(`/${accountOrZone}/${accountOrZoneId}/access/apps/${appId}/settings`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Updates Access application settings.
     *
     * @example
     * ```ts
     * const response =
     *   await client.zeroTrust.access.applications.settings.edit(
     *     '023e105f4ecef8ad9ca31a8372d0c353',
     *     { account_id: 'account_id' },
     *   );
     * ```
     */
    edit(appId, params, options) {
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
        return this._client.patch(`/${accountOrZone}/${accountOrZoneId}/access/apps/${appId}/settings`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
}
exports.Settings = Settings;
//# sourceMappingURL=settings.js.map