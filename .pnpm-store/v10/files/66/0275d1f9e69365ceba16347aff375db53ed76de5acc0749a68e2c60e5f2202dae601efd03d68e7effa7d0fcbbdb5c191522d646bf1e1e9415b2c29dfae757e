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
exports.TeamnetsV4PagePaginationArray = exports.Routes = void 0;
const resource_1 = require("../../../../resource.js");
const IPsAPI = __importStar(require("./ips.js"));
const ips_1 = require("./ips.js");
const NetworksAPI = __importStar(require("./networks.js"));
const networks_1 = require("./networks.js");
const pagination_1 = require("../../../../pagination.js");
class Routes extends resource_1.APIResource {
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
exports.Routes = Routes;
class TeamnetsV4PagePaginationArray extends pagination_1.V4PagePaginationArray {
}
exports.TeamnetsV4PagePaginationArray = TeamnetsV4PagePaginationArray;
Routes.TeamnetsV4PagePaginationArray = TeamnetsV4PagePaginationArray;
Routes.IPs = ips_1.IPs;
Routes.Networks = networks_1.Networks;
//# sourceMappingURL=routes.js.map