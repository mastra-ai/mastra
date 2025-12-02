// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../../resource.mjs";
import { isRequestOptions } from "../../../../core.mjs";
import * as SettingsAPI from "./settings.mjs";
import { CertificateSettingsSinglePage, Settings, } from "./settings.mjs";
import { CloudflareError } from "../../../../error.mjs";
import { SinglePage } from "../../../../pagination.mjs";
export class Certificates extends APIResource {
    constructor() {
        super(...arguments);
        this.settings = new SettingsAPI.Settings(this._client);
    }
    /**
     * Adds a new mTLS root certificate to Access.
     *
     * @example
     * ```ts
     * const certificate =
     *   await client.zeroTrust.access.certificates.create({
     *     certificate:
     *       '-----BEGIN CERTIFICATE-----\nMIIGAjCCA+qgAwIBAgIJAI7kymlF7CWT...N4RI7KKB7nikiuUf8vhULKy5IX10\nDrUtmu/B\n-----END CERTIFICATE-----',
     *     name: 'Allow devs',
     *     account_id: 'account_id',
     *   });
     * ```
     */
    create(params, options) {
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
        return this._client.post(`/${accountOrZone}/${accountOrZoneId}/access/certificates`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Updates a configured mTLS certificate.
     *
     * @example
     * ```ts
     * const certificate =
     *   await client.zeroTrust.access.certificates.update(
     *     'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
     *     {
     *       associated_hostnames: ['admin.example.com'],
     *       account_id: 'account_id',
     *     },
     *   );
     * ```
     */
    update(certificateId, params, options) {
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
        return this._client.put(`/${accountOrZone}/${accountOrZoneId}/access/certificates/${certificateId}`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    list(params = {}, options) {
        if (isRequestOptions(params)) {
            return this.list({}, params);
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
        return this._client.getAPIList(`/${accountOrZone}/${accountOrZoneId}/access/certificates`, CertificatesSinglePage, options);
    }
    delete(certificateId, params = {}, options) {
        if (isRequestOptions(params)) {
            return this.delete(certificateId, {}, params);
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
        return this._client.delete(`/${accountOrZone}/${accountOrZoneId}/access/certificates/${certificateId}`, options)._thenUnwrap((obj) => obj.result);
    }
    get(certificateId, params = {}, options) {
        if (isRequestOptions(params)) {
            return this.get(certificateId, {}, params);
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
        return this._client.get(`/${accountOrZone}/${accountOrZoneId}/access/certificates/${certificateId}`, options)._thenUnwrap((obj) => obj.result);
    }
}
export class CertificatesSinglePage extends SinglePage {
}
Certificates.CertificatesSinglePage = CertificatesSinglePage;
Certificates.Settings = Settings;
Certificates.CertificateSettingsSinglePage = CertificateSettingsSinglePage;
//# sourceMappingURL=certificates.mjs.map