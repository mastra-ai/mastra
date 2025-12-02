"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CertificatesSinglePage = exports.Certificates = void 0;
const resource_1 = require("../../../../resource.js");
const core_1 = require("../../../../core.js");
const SettingsAPI = __importStar(require("./settings.js"));
const settings_1 = require("./settings.js");
const error_1 = require("../../../../error.js");
const pagination_1 = require("../../../../pagination.js");
class Certificates extends resource_1.APIResource {
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
        return this._client.put(`/${accountOrZone}/${accountOrZoneId}/access/certificates/${certificateId}`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    list(params = {}, options) {
        if ((0, core_1.isRequestOptions)(params)) {
            return this.list({}, params);
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
        return this._client.getAPIList(`/${accountOrZone}/${accountOrZoneId}/access/certificates`, CertificatesSinglePage, options);
    }
    delete(certificateId, params = {}, options) {
        if ((0, core_1.isRequestOptions)(params)) {
            return this.delete(certificateId, {}, params);
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
        return this._client.delete(`/${accountOrZone}/${accountOrZoneId}/access/certificates/${certificateId}`, options)._thenUnwrap((obj) => obj.result);
    }
    get(certificateId, params = {}, options) {
        if ((0, core_1.isRequestOptions)(params)) {
            return this.get(certificateId, {}, params);
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
        return this._client.get(`/${accountOrZone}/${accountOrZoneId}/access/certificates/${certificateId}`, options)._thenUnwrap((obj) => obj.result);
    }
}
exports.Certificates = Certificates;
class CertificatesSinglePage extends pagination_1.SinglePage {
}
exports.CertificatesSinglePage = CertificatesSinglePage;
Certificates.CertificatesSinglePage = CertificatesSinglePage;
Certificates.Settings = settings_1.Settings;
Certificates.CertificateSettingsSinglePage = settings_1.CertificateSettingsSinglePage;
//# sourceMappingURL=certificates.js.map