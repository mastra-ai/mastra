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
exports.IdentityProviderListResponsesSinglePage = exports.IdentityProviders = void 0;
const resource_1 = require("../../../resource.js");
const core_1 = require("../../../core.js");
const SCIMAPI = __importStar(require("./scim/scim.js"));
const scim_1 = require("./scim/scim.js");
const error_1 = require("../../../error.js");
const pagination_1 = require("../../../pagination.js");
class IdentityProviders extends resource_1.APIResource {
    constructor() {
        super(...arguments);
        this.scim = new SCIMAPI.SCIM(this._client);
    }
    /**
     * Adds a new identity provider to Access.
     *
     * @example
     * ```ts
     * const identityProvider =
     *   await client.zeroTrust.identityProviders.create({
     *     config: {},
     *     name: 'Widget Corps IDP',
     *     type: 'onetimepin',
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
        return this._client.post(`/${accountOrZone}/${accountOrZoneId}/access/identity_providers`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Updates a configured identity provider.
     *
     * @example
     * ```ts
     * const identityProvider =
     *   await client.zeroTrust.identityProviders.update(
     *     'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
     *     {
     *       config: {},
     *       name: 'Widget Corps IDP',
     *       type: 'onetimepin',
     *       account_id: 'account_id',
     *     },
     *   );
     * ```
     */
    update(identityProviderId, params, options) {
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
        return this._client.put(`/${accountOrZone}/${accountOrZoneId}/access/identity_providers/${identityProviderId}`, { body, ...options })._thenUnwrap((obj) => obj.result);
    }
    list(params = {}, options) {
        if ((0, core_1.isRequestOptions)(params)) {
            return this.list({}, params);
        }
        const { account_id, zone_id, ...query } = params;
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
        return this._client.getAPIList(`/${accountOrZone}/${accountOrZoneId}/access/identity_providers`, IdentityProviderListResponsesSinglePage, { query, ...options });
    }
    delete(identityProviderId, params = {}, options) {
        if ((0, core_1.isRequestOptions)(params)) {
            return this.delete(identityProviderId, {}, params);
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
        return this._client.delete(`/${accountOrZone}/${accountOrZoneId}/access/identity_providers/${identityProviderId}`, options)._thenUnwrap((obj) => obj.result);
    }
    get(identityProviderId, params = {}, options) {
        if ((0, core_1.isRequestOptions)(params)) {
            return this.get(identityProviderId, {}, params);
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
        return this._client.get(`/${accountOrZone}/${accountOrZoneId}/access/identity_providers/${identityProviderId}`, options)._thenUnwrap((obj) => obj.result);
    }
}
exports.IdentityProviders = IdentityProviders;
class IdentityProviderListResponsesSinglePage extends pagination_1.SinglePage {
}
exports.IdentityProviderListResponsesSinglePage = IdentityProviderListResponsesSinglePage;
IdentityProviders.IdentityProviderListResponsesSinglePage = IdentityProviderListResponsesSinglePage;
IdentityProviders.SCIM = scim_1.SCIM;
//# sourceMappingURL=identity-providers.js.map