// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
import { isRequestOptions } from "../../../core.mjs";
import * as DOHAPI from "./doh.mjs";
import { DOH } from "./doh.mjs";
import { CloudflareError } from "../../../error.mjs";
export class Organizations extends APIResource {
    constructor() {
        super(...arguments);
        this.doh = new DOHAPI.DOH(this._client);
    }
    /**
     * Sets up a Zero Trust organization for your account or zone.
     *
     * @example
     * ```ts
     * const organization =
     *   await client.zeroTrust.organizations.create({
     *     auth_domain: 'test.cloudflareaccess.com',
     *     name: 'Widget Corps Internal Applications',
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
        return this._client.post(`/${accountOrZone}/${accountOrZoneId}/access/organizations`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Updates the configuration for your Zero Trust organization.
     *
     * @example
     * ```ts
     * const organization =
     *   await client.zeroTrust.organizations.update({
     *     account_id: 'account_id',
     *   });
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
        return this._client.put(`/${accountOrZone}/${accountOrZoneId}/access/organizations`, {
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
        return this._client.get(`/${accountOrZone}/${accountOrZoneId}/access/organizations`, options)._thenUnwrap((obj) => obj.result);
    }
    /**
     * Revokes a user's access across all applications.
     *
     * @example
     * ```ts
     * const response =
     *   await client.zeroTrust.organizations.revokeUsers({
     *     email: 'test@example.com',
     *     account_id: 'account_id',
     *   });
     * ```
     */
    revokeUsers(params, options) {
        const { account_id, zone_id, query_devices, ...body } = params;
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
        return this._client.post(`/${accountOrZone}/${accountOrZoneId}/access/organizations/revoke_user`, {
            query: { devices: query_devices },
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
}
Organizations.DOH = DOH;
//# sourceMappingURL=organizations.mjs.map