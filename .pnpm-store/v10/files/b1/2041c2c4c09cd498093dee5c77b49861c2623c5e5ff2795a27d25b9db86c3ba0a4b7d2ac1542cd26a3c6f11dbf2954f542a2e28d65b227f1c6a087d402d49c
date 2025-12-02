"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.CertificateSettingsSinglePage = exports.Settings = void 0;
const resource_1 = require("../../../../resource.js");
const core_1 = require("../../../../core.js");
const error_1 = require("../../../../error.js");
const pagination_1 = require("../../../../pagination.js");
class Settings extends resource_1.APIResource {
    /**
     * Updates an mTLS certificate's hostname settings.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const certificateSettings of client.zeroTrust.access.certificates.settings.update(
     *   {
     *     settings: [
     *       {
     *         china_network: false,
     *         client_certificate_forwarding: true,
     *         hostname: 'admin.example.com',
     *       },
     *     ],
     *     account_id: 'account_id',
     *   },
     * )) {
     *   // ...
     * }
     * ```
     */
    update(params, options) {
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
        return this._client.getAPIList(`/${accountOrZone}/${accountOrZoneId}/access/certificates/settings`, CertificateSettingsSinglePage, { body, method: 'put', ...options });
    }
    get(params = {}, options) {
        if ((0, core_1.isRequestOptions)(params)) {
            return this.get({}, params);
        }
        const { account_id, zone_id } = params;
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
        return this._client.getAPIList(`/${accountOrZone}/${accountOrZoneId}/access/certificates/settings`, CertificateSettingsSinglePage, options);
    }
}
exports.Settings = Settings;
class CertificateSettingsSinglePage extends pagination_1.SinglePage {
}
exports.CertificateSettingsSinglePage = CertificateSettingsSinglePage;
Settings.CertificateSettingsSinglePage = CertificateSettingsSinglePage;
//# sourceMappingURL=settings.js.map