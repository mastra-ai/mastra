// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
import { SinglePage } from "../../../pagination.mjs";
export class Locations extends APIResource {
    /**
     * Creates a new Zero Trust Gateway location.
     *
     * @example
     * ```ts
     * const location =
     *   await client.zeroTrust.gateway.locations.create({
     *     account_id: '699d98642c564d2e855e9661899b7252',
     *     name: 'Austin Office Location',
     *   });
     * ```
     */
    create(params, options) {
        const { account_id, ...body } = params;
        return this._client.post(`/accounts/${account_id}/gateway/locations`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Updates a configured Zero Trust Gateway location.
     *
     * @example
     * ```ts
     * const location =
     *   await client.zeroTrust.gateway.locations.update(
     *     'ed35569b41ce4d1facfe683550f54086',
     *     {
     *       account_id: '699d98642c564d2e855e9661899b7252',
     *       name: 'Austin Office Location',
     *     },
     *   );
     * ```
     */
    update(locationId, params, options) {
        const { account_id, ...body } = params;
        return this._client.put(`/accounts/${account_id}/gateway/locations/${locationId}`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Fetches Zero Trust Gateway locations for an account.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const location of client.zeroTrust.gateway.locations.list(
     *   { account_id: '699d98642c564d2e855e9661899b7252' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(params, options) {
        const { account_id } = params;
        return this._client.getAPIList(`/accounts/${account_id}/gateway/locations`, LocationsSinglePage, options);
    }
    /**
     * Deletes a configured Zero Trust Gateway location.
     *
     * @example
     * ```ts
     * const location =
     *   await client.zeroTrust.gateway.locations.delete(
     *     'ed35569b41ce4d1facfe683550f54086',
     *     { account_id: '699d98642c564d2e855e9661899b7252' },
     *   );
     * ```
     */
    delete(locationId, params, options) {
        const { account_id } = params;
        return this._client.delete(`/accounts/${account_id}/gateway/locations/${locationId}`, options)._thenUnwrap((obj) => obj.result);
    }
    /**
     * Fetches a single Zero Trust Gateway location.
     *
     * @example
     * ```ts
     * const location =
     *   await client.zeroTrust.gateway.locations.get(
     *     'ed35569b41ce4d1facfe683550f54086',
     *     { account_id: '699d98642c564d2e855e9661899b7252' },
     *   );
     * ```
     */
    get(locationId, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/gateway/locations/${locationId}`, options)._thenUnwrap((obj) => obj.result);
    }
}
export class LocationsSinglePage extends SinglePage {
}
Locations.LocationsSinglePage = LocationsSinglePage;
//# sourceMappingURL=locations.mjs.map