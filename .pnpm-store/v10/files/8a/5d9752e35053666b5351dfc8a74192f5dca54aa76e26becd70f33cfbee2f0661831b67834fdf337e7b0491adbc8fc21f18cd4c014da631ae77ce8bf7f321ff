// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../../resource.mjs";
import { isRequestOptions } from "../../../../core.mjs";
import { CloudflareError } from "../../../../error.mjs";
import { SinglePage } from "../../../../pagination.mjs";
export class Settings extends APIResource {
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
            throw new CloudflareError('You must provide either account_id or zone_id.');
        }
        if (account_id && zone_id) {
            throw new CloudflareError('You cannot provide both account_id and zone_id.');
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
        if (isRequestOptions(params)) {
            return this.get({}, params);
        }
        const { account_id, zone_id } = params;
        if (!account_id && !zone_id) {
            throw new CloudflareError('You must provide either account_id or zone_id.');
        }
        if (account_id && zone_id) {
            throw new CloudflareError('You cannot provide both account_id and zone_id.');
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
export class CertificateSettingsSinglePage extends SinglePage {
}
Settings.CertificateSettingsSinglePage = CertificateSettingsSinglePage;
//# sourceMappingURL=settings.mjs.map