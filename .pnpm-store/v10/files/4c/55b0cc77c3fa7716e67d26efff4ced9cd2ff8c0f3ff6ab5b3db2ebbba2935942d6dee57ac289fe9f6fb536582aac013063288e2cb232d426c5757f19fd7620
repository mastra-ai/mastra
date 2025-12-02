// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
import { isRequestOptions } from "../../../core.mjs";
import { CloudflareError } from "../../../error.mjs";
import { SinglePage } from "../../../pagination.mjs";
export class ServiceTokens extends APIResource {
    /**
     * Generates a new service token. **Note:** This is the only time you can get the
     * Client Secret. If you lose the Client Secret, you will have to rotate the Client
     * Secret or create a new service token.
     *
     * @example
     * ```ts
     * const serviceToken =
     *   await client.zeroTrust.access.serviceTokens.create({
     *     name: 'CI/CD token',
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
        return this._client.post(`/${accountOrZone}/${accountOrZoneId}/access/service_tokens`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Updates a configured service token.
     *
     * @example
     * ```ts
     * const serviceToken =
     *   await client.zeroTrust.access.serviceTokens.update(
     *     'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
     *     { account_id: 'account_id' },
     *   );
     * ```
     */
    update(serviceTokenId, params, options) {
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
        return this._client.put(`/${accountOrZone}/${accountOrZoneId}/access/service_tokens/${serviceTokenId}`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
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
        return this._client.getAPIList(`/${accountOrZone}/${accountOrZoneId}/access/service_tokens`, ServiceTokensSinglePage, { query, ...options });
    }
    delete(serviceTokenId, params = {}, options) {
        if (isRequestOptions(params)) {
            return this.delete(serviceTokenId, {}, params);
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
        return this._client.delete(`/${accountOrZone}/${accountOrZoneId}/access/service_tokens/${serviceTokenId}`, options)._thenUnwrap((obj) => obj.result);
    }
    get(serviceTokenId, params = {}, options) {
        if (isRequestOptions(params)) {
            return this.get(serviceTokenId, {}, params);
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
        return this._client.get(`/${accountOrZone}/${accountOrZoneId}/access/service_tokens/${serviceTokenId}`, options)._thenUnwrap((obj) => obj.result);
    }
    /**
     * Refreshes the expiration of a service token.
     *
     * @example
     * ```ts
     * const serviceToken =
     *   await client.zeroTrust.access.serviceTokens.refresh(
     *     'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
     *     { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    refresh(serviceTokenId, params, options) {
        const { account_id } = params;
        return this._client.post(`/accounts/${account_id}/access/service_tokens/${serviceTokenId}/refresh`, options)._thenUnwrap((obj) => obj.result);
    }
    /**
     * Generates a new Client Secret for a service token and revokes the old one.
     *
     * @example
     * ```ts
     * const response =
     *   await client.zeroTrust.access.serviceTokens.rotate(
     *     'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
     *     { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    rotate(serviceTokenId, params, options) {
        const { account_id } = params;
        return this._client.post(`/accounts/${account_id}/access/service_tokens/${serviceTokenId}/rotate`, options)._thenUnwrap((obj) => obj.result);
    }
}
export class ServiceTokensSinglePage extends SinglePage {
}
ServiceTokens.ServiceTokensSinglePage = ServiceTokensSinglePage;
//# sourceMappingURL=service-tokens.mjs.map