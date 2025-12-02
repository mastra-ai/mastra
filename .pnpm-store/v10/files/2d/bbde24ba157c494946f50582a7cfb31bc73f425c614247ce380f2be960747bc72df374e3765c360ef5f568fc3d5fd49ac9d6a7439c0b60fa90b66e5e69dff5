"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.OverrideCodeListResponsesSinglePage = exports.OverrideCodes = void 0;
const resource_1 = require("../../../resource.js");
const pagination_1 = require("../../../pagination.js");
class OverrideCodes extends resource_1.APIResource {
    /**
     * Fetches a one-time use admin override code for a device. This relies on the
     * **Admin Override** setting being enabled in your device configuration. Not
     * supported when
     * [multi-user mode](https://developers.cloudflare.com/cloudflare-one/connections/connect-devices/warp/deployment/mdm-deployment/windows-multiuser/)
     * is enabled for the account. **Deprecated:** please use GET
     * /accounts/{account_id}/devices/registrations/{registration_id}/override_codes
     * instead.
     *
     * @deprecated
     */
    list(deviceId, params, options) {
        const { account_id } = params;
        return this._client.getAPIList(`/accounts/${account_id}/devices/${deviceId}/override_codes`, OverrideCodeListResponsesSinglePage, options);
    }
    /**
     * Fetches one-time use admin override codes for a registration. This relies on the
     * **Admin Override** setting being enabled in your device configuration.
     *
     * @example
     * ```ts
     * const overrideCode =
     *   await client.zeroTrust.devices.overrideCodes.get(
     *     'registration_id',
     *     { account_id: 'account_id' },
     *   );
     * ```
     */
    get(registrationId, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/devices/registrations/${registrationId}/override_codes`, options)._thenUnwrap((obj) => obj.result);
    }
}
exports.OverrideCodes = OverrideCodes;
class OverrideCodeListResponsesSinglePage extends pagination_1.SinglePage {
}
exports.OverrideCodeListResponsesSinglePage = OverrideCodeListResponsesSinglePage;
OverrideCodes.OverrideCodeListResponsesSinglePage = OverrideCodeListResponsesSinglePage;
//# sourceMappingURL=override-codes.js.map