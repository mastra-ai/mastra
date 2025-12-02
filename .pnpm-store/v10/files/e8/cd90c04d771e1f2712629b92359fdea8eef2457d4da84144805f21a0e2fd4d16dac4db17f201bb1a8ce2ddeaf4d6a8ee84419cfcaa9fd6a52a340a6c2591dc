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
exports.PoolsSinglePage = exports.Pools = void 0;
const resource_1 = require("../../../resource.js");
const HealthAPI = __importStar(require("./health.js"));
const health_1 = require("./health.js");
const ReferencesAPI = __importStar(require("./references.js"));
const references_1 = require("./references.js");
const pagination_1 = require("../../../pagination.js");
class Pools extends resource_1.APIResource {
    constructor() {
        super(...arguments);
        this.health = new HealthAPI.Health(this._client);
        this.references = new ReferencesAPI.References(this._client);
    }
    /**
     * Create a new pool.
     *
     * @example
     * ```ts
     * const pool = await client.loadBalancers.pools.create({
     *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *   name: 'primary-dc-1',
     *   origins: [{}],
     * });
     * ```
     */
    create(params, options) {
        const { account_id, ...body } = params;
        return this._client.post(`/accounts/${account_id}/load_balancers/pools`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Modify a configured pool.
     *
     * @example
     * ```ts
     * const pool = await client.loadBalancers.pools.update(
     *   '17b5962d775c646f3f9725cbc7a53df4',
     *   {
     *     account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *     name: 'primary-dc-1',
     *     origins: [{}],
     *   },
     * );
     * ```
     */
    update(poolId, params, options) {
        const { account_id, ...body } = params;
        return this._client.put(`/accounts/${account_id}/load_balancers/pools/${poolId}`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * List configured pools.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const pool of client.loadBalancers.pools.list({
     *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * })) {
     *   // ...
     * }
     * ```
     */
    list(params, options) {
        const { account_id, ...query } = params;
        return this._client.getAPIList(`/accounts/${account_id}/load_balancers/pools`, PoolsSinglePage, {
            query,
            ...options,
        });
    }
    /**
     * Delete a configured pool.
     *
     * @example
     * ```ts
     * const pool = await client.loadBalancers.pools.delete(
     *   '17b5962d775c646f3f9725cbc7a53df4',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    delete(poolId, params, options) {
        const { account_id } = params;
        return this._client.delete(`/accounts/${account_id}/load_balancers/pools/${poolId}`, options)._thenUnwrap((obj) => obj.result);
    }
    /**
     * Apply changes to a number of existing pools, overwriting the supplied
     * properties. Pools are ordered by ascending `name`. Returns the list of affected
     * pools. Supports the standard pagination query parameters, either
     * `limit`/`offset` or `per_page`/`page`.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const pool of client.loadBalancers.pools.bulkEdit(
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * )) {
     *   // ...
     * }
     * ```
     */
    bulkEdit(params, options) {
        const { account_id, ...body } = params;
        return this._client.getAPIList(`/accounts/${account_id}/load_balancers/pools`, PoolsSinglePage, {
            body,
            method: 'patch',
            ...options,
        });
    }
    /**
     * Apply changes to an existing pool, overwriting the supplied properties.
     *
     * @example
     * ```ts
     * const pool = await client.loadBalancers.pools.edit(
     *   '17b5962d775c646f3f9725cbc7a53df4',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    edit(poolId, params, options) {
        const { account_id, ...body } = params;
        return this._client.patch(`/accounts/${account_id}/load_balancers/pools/${poolId}`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Fetch a single configured pool.
     *
     * @example
     * ```ts
     * const pool = await client.loadBalancers.pools.get(
     *   '17b5962d775c646f3f9725cbc7a53df4',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    get(poolId, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/load_balancers/pools/${poolId}`, options)._thenUnwrap((obj) => obj.result);
    }
}
exports.Pools = Pools;
class PoolsSinglePage extends pagination_1.SinglePage {
}
exports.PoolsSinglePage = PoolsSinglePage;
Pools.PoolsSinglePage = PoolsSinglePage;
Pools.Health = health_1.Health;
Pools.References = references_1.References;
Pools.ReferenceGetResponsesSinglePage = references_1.ReferenceGetResponsesSinglePage;
//# sourceMappingURL=pools.js.map