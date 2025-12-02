// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../../resource.mjs";
import * as IPsAPI from "./ips.mjs";
import { IPs } from "./ips.mjs";
import * as NetworksAPI from "./networks.mjs";
import { Networks } from "./networks.mjs";
import { V4PagePaginationArray } from "../../../../pagination.mjs";
export class Routes extends APIResource {
    constructor() {
        super(...arguments);
        this.ips = new IPsAPI.IPs(this._client);
        this.networks = new NetworksAPI.Networks(this._client);
    }
    /**
     * Routes a private network through a Cloudflare Tunnel.
     *
     * @example
     * ```ts
     * const route = await client.zeroTrust.networks.routes.create(
     *   {
     *     account_id: '699d98642c564d2e855e9661899b7252',
     *     network: '172.16.0.0/16',
     *     tunnel_id: 'f70ff985-a4ef-4643-bbbc-4a0ed4fc8415',
     *   },
     * );
     * ```
     */
    create(params, options) {
        const { account_id, ...body } = params;
        return this._client.post(`/accounts/${account_id}/teamnet/routes`, { body, ...options })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Lists and filters private network routes in an account.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const teamnet of client.zeroTrust.networks.routes.list(
     *   { account_id: '699d98642c564d2e855e9661899b7252' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(params, options) {
        const { account_id, ...query } = params;
        return this._client.getAPIList(`/accounts/${account_id}/teamnet/routes`, TeamnetsV4PagePaginationArray, {
            query,
            ...options,
        });
    }
    /**
     * Deletes a private network route from an account.
     *
     * @example
     * ```ts
     * const route = await client.zeroTrust.networks.routes.delete(
     *   'f70ff985-a4ef-4643-bbbc-4a0ed4fc8415',
     *   { account_id: '699d98642c564d2e855e9661899b7252' },
     * );
     * ```
     */
    delete(routeId, params, options) {
        const { account_id } = params;
        return this._client.delete(`/accounts/${account_id}/teamnet/routes/${routeId}`, options)._thenUnwrap((obj) => obj.result);
    }
    /**
     * Updates an existing private network route in an account. The fields that are
     * meant to be updated should be provided in the body of the request.
     *
     * @example
     * ```ts
     * const route = await client.zeroTrust.networks.routes.edit(
     *   'f70ff985-a4ef-4643-bbbc-4a0ed4fc8415',
     *   { account_id: '699d98642c564d2e855e9661899b7252' },
     * );
     * ```
     */
    edit(routeId, params, options) {
        const { account_id, ...body } = params;
        return this._client.patch(`/accounts/${account_id}/teamnet/routes/${routeId}`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Get a private network route in an account.
     *
     * @example
     * ```ts
     * const route = await client.zeroTrust.networks.routes.get(
     *   'f70ff985-a4ef-4643-bbbc-4a0ed4fc8415',
     *   { account_id: '699d98642c564d2e855e9661899b7252' },
     * );
     * ```
     */
    get(routeId, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/teamnet/routes/${routeId}`, options)._thenUnwrap((obj) => obj.result);
    }
}
export class TeamnetsV4PagePaginationArray extends V4PagePaginationArray {
}
Routes.TeamnetsV4PagePaginationArray = TeamnetsV4PagePaginationArray;
Routes.IPs = IPs;
Routes.Networks = Networks;
//# sourceMappingURL=routes.mjs.map