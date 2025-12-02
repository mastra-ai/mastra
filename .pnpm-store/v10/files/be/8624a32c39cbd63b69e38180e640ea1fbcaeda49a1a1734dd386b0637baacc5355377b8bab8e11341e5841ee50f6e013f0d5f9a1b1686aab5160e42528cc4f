// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
import { isRequestOptions } from "../../../core.mjs";
import * as SCIMAPI from "./scim/scim.mjs";
import { SCIM } from "./scim/scim.mjs";
import { CloudflareError } from "../../../error.mjs";
import { SinglePage } from "../../../pagination.mjs";
export class IdentityProviders extends APIResource {
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
        return this._client.put(`/${accountOrZone}/${accountOrZoneId}/access/identity_providers/${identityProviderId}`, { body, ...options })._thenUnwrap((obj) => obj.result);
    }
    list(params = {}, options) {
        if (isRequestOptions(params)) {
            return this.list({}, params);
        }
        const { account_id, zone_id, ...query } = params;
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
        return this._client.getAPIList(`/${accountOrZone}/${accountOrZoneId}/access/identity_providers`, IdentityProviderListResponsesSinglePage, { query, ...options });
    }
    delete(identityProviderId, params = {}, options) {
        if (isRequestOptions(params)) {
            return this.delete(identityProviderId, {}, params);
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
        return this._client.delete(`/${accountOrZone}/${accountOrZoneId}/access/identity_providers/${identityProviderId}`, options)._thenUnwrap((obj) => obj.result);
    }
    get(identityProviderId, params = {}, options) {
        if (isRequestOptions(params)) {
            return this.get(identityProviderId, {}, params);
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
        return this._client.get(`/${accountOrZone}/${accountOrZoneId}/access/identity_providers/${identityProviderId}`, options)._thenUnwrap((obj) => obj.result);
    }
}
export class IdentityProviderListResponsesSinglePage extends SinglePage {
}
IdentityProviders.IdentityProviderListResponsesSinglePage = IdentityProviderListResponsesSinglePage;
IdentityProviders.SCIM = SCIM;
//# sourceMappingURL=identity-providers.mjs.map