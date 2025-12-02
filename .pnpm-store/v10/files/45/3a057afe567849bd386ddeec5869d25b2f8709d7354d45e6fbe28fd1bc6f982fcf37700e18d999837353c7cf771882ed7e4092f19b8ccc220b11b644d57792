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
exports.LoadBalancersSinglePage = exports.LoadBalancers = void 0;
const resource_1 = require("../../resource.js");
const PreviewsAPI = __importStar(require("./previews.js"));
const previews_1 = require("./previews.js");
const RegionsAPI = __importStar(require("./regions.js"));
const regions_1 = require("./regions.js");
const SearchesAPI = __importStar(require("./searches.js"));
const searches_1 = require("./searches.js");
const MonitorsAPI = __importStar(require("./monitors/monitors.js"));
const monitors_1 = require("./monitors/monitors.js");
const PoolsAPI = __importStar(require("./pools/pools.js"));
const pools_1 = require("./pools/pools.js");
const pagination_1 = require("../../pagination.js");
class LoadBalancers extends resource_1.APIResource {
    constructor() {
        super(...arguments);
        this.monitors = new MonitorsAPI.Monitors(this._client);
        this.pools = new PoolsAPI.Pools(this._client);
        this.previews = new PreviewsAPI.Previews(this._client);
        this.regions = new RegionsAPI.Regions(this._client);
        this.searches = new SearchesAPI.Searches(this._client);
    }
    /**
     * Create a new load balancer.
     *
     * @example
     * ```ts
     * const loadBalancer = await client.loadBalancers.create({
     *   zone_id: '699d98642c564d2e855e9661899b7252',
     *   default_pools: [
     *     '17b5962d775c646f3f9725cbc7a53df4',
     *     '9290f38c5d07c2e2f4df57b1f61d4196',
     *     '00920f38ce07c2e2f4df50b1f61d4194',
     *   ],
     *   fallback_pool: 'fallback_pool',
     *   name: 'www.example.com',
     * });
     * ```
     */
    create(params, options) {
        const { zone_id, ...body } = params;
        return this._client.post(`/zones/${zone_id}/load_balancers`, { body, ...options })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Update a configured load balancer.
     *
     * @example
     * ```ts
     * const loadBalancer = await client.loadBalancers.update(
     *   '699d98642c564d2e855e9661899b7252',
     *   {
     *     zone_id: '699d98642c564d2e855e9661899b7252',
     *     default_pools: [
     *       '17b5962d775c646f3f9725cbc7a53df4',
     *       '9290f38c5d07c2e2f4df57b1f61d4196',
     *       '00920f38ce07c2e2f4df50b1f61d4194',
     *     ],
     *     fallback_pool: 'fallback_pool',
     *     name: 'www.example.com',
     *   },
     * );
     * ```
     */
    update(loadBalancerId, params, options) {
        const { zone_id, ...body } = params;
        return this._client.put(`/zones/${zone_id}/load_balancers/${loadBalancerId}`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * List configured load balancers.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const loadBalancer of client.loadBalancers.list({
     *   zone_id: '699d98642c564d2e855e9661899b7252',
     * })) {
     *   // ...
     * }
     * ```
     */
    list(params, options) {
        const { zone_id } = params;
        return this._client.getAPIList(`/zones/${zone_id}/load_balancers`, LoadBalancersSinglePage, options);
    }
    /**
     * Delete a configured load balancer.
     *
     * @example
     * ```ts
     * const loadBalancer = await client.loadBalancers.delete(
     *   '699d98642c564d2e855e9661899b7252',
     *   { zone_id: '699d98642c564d2e855e9661899b7252' },
     * );
     * ```
     */
    delete(loadBalancerId, params, options) {
        const { zone_id } = params;
        return this._client.delete(`/zones/${zone_id}/load_balancers/${loadBalancerId}`, options)._thenUnwrap((obj) => obj.result);
    }
    /**
     * Apply changes to an existing load balancer, overwriting the supplied properties.
     *
     * @example
     * ```ts
     * const loadBalancer = await client.loadBalancers.edit(
     *   '699d98642c564d2e855e9661899b7252',
     *   { zone_id: '699d98642c564d2e855e9661899b7252' },
     * );
     * ```
     */
    edit(loadBalancerId, params, options) {
        const { zone_id, ...body } = params;
        return this._client.patch(`/zones/${zone_id}/load_balancers/${loadBalancerId}`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Fetch a single configured load balancer.
     *
     * @example
     * ```ts
     * const loadBalancer = await client.loadBalancers.get(
     *   '699d98642c564d2e855e9661899b7252',
     *   { zone_id: '699d98642c564d2e855e9661899b7252' },
     * );
     * ```
     */
    get(loadBalancerId, params, options) {
        const { zone_id } = params;
        return this._client.get(`/zones/${zone_id}/load_balancers/${loadBalancerId}`, options)._thenUnwrap((obj) => obj.result);
    }
}
exports.LoadBalancers = LoadBalancers;
class LoadBalancersSinglePage extends pagination_1.SinglePage {
}
exports.LoadBalancersSinglePage = LoadBalancersSinglePage;
LoadBalancers.LoadBalancersSinglePage = LoadBalancersSinglePage;
LoadBalancers.Monitors = monitors_1.Monitors;
LoadBalancers.MonitorsSinglePage = monitors_1.MonitorsSinglePage;
LoadBalancers.Pools = pools_1.Pools;
LoadBalancers.PoolsSinglePage = pools_1.PoolsSinglePage;
LoadBalancers.Previews = previews_1.Previews;
LoadBalancers.Regions = regions_1.Regions;
LoadBalancers.Searches = searches_1.Searches;
LoadBalancers.SearchListResponsesV4PagePagination = searches_1.SearchListResponsesV4PagePagination;
//# sourceMappingURL=load-balancers.js.map