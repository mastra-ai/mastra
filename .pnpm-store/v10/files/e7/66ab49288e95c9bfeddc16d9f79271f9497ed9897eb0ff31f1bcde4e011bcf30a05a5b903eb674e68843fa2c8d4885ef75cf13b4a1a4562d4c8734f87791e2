// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../resource.mjs";
import * as PreviewsAPI from "./previews.mjs";
import { Previews } from "./previews.mjs";
import * as RegionsAPI from "./regions.mjs";
import { Regions } from "./regions.mjs";
import * as SearchesAPI from "./searches.mjs";
import { SearchListResponsesV4PagePagination, Searches, } from "./searches.mjs";
import * as MonitorsAPI from "./monitors/monitors.mjs";
import { Monitors, MonitorsSinglePage, } from "./monitors/monitors.mjs";
import * as PoolsAPI from "./pools/pools.mjs";
import { Pools, PoolsSinglePage, } from "./pools/pools.mjs";
import { SinglePage } from "../../pagination.mjs";
export class LoadBalancers extends APIResource {
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
export class LoadBalancersSinglePage extends SinglePage {
}
LoadBalancers.LoadBalancersSinglePage = LoadBalancersSinglePage;
LoadBalancers.Monitors = Monitors;
LoadBalancers.MonitorsSinglePage = MonitorsSinglePage;
LoadBalancers.Pools = Pools;
LoadBalancers.PoolsSinglePage = PoolsSinglePage;
LoadBalancers.Previews = Previews;
LoadBalancers.Regions = Regions;
LoadBalancers.Searches = Searches;
LoadBalancers.SearchListResponsesV4PagePagination = SearchListResponsesV4PagePagination;
//# sourceMappingURL=load-balancers.mjs.map