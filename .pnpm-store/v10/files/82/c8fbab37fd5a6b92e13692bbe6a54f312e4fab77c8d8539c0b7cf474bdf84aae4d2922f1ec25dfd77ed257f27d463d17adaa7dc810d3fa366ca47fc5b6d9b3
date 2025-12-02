// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../resource.mjs";
import { isRequestOptions } from "../../core.mjs";
import * as ActivationCheckAPI from "./activation-check.mjs";
import { ActivationCheck, } from "./activation-check.mjs";
import * as CustomNameserversAPI from "./custom-nameservers.mjs";
import { CustomNameserverUpdateResponsesSinglePage, CustomNameservers, } from "./custom-nameservers.mjs";
import * as HoldsAPI from "./holds.mjs";
import { Holds } from "./holds.mjs";
import * as PlansAPI from "./plans.mjs";
import { AvailableRatePlansSinglePage, Plans, } from "./plans.mjs";
import * as RatePlansAPI from "./rate-plans.mjs";
import { RatePlanGetResponsesSinglePage, RatePlans, } from "./rate-plans.mjs";
import * as SettingsAPI from "./settings.mjs";
import { Settings, } from "./settings.mjs";
import * as SubscriptionsAPI from "./subscriptions.mjs";
import { Subscriptions, } from "./subscriptions.mjs";
import { V4PagePaginationArray } from "../../pagination.mjs";
export class Zones extends APIResource {
    constructor() {
        super(...arguments);
        this.activationCheck = new ActivationCheckAPI.ActivationCheck(this._client);
        this.settings = new SettingsAPI.Settings(this._client);
        this.customNameservers = new CustomNameserversAPI.CustomNameservers(this._client);
        this.holds = new HoldsAPI.Holds(this._client);
        this.subscriptions = new SubscriptionsAPI.Subscriptions(this._client);
        this.plans = new PlansAPI.Plans(this._client);
        this.ratePlans = new RatePlansAPI.RatePlans(this._client);
    }
    /**
     * Create Zone
     *
     * @example
     * ```ts
     * const zone = await client.zones.create({
     *   account: {},
     *   name: 'example.com',
     * });
     * ```
     */
    create(body, options) {
        return this._client.post('/zones', { body, ...options })._thenUnwrap((obj) => obj.result);
    }
    list(query = {}, options) {
        if (isRequestOptions(query)) {
            return this.list({}, query);
        }
        return this._client.getAPIList('/zones', ZonesV4PagePaginationArray, { query, ...options });
    }
    /**
     * Deletes an existing zone.
     *
     * @example
     * ```ts
     * const zone = await client.zones.delete({
     *   zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * });
     * ```
     */
    delete(params, options) {
        const { zone_id } = params;
        return this._client.delete(`/zones/${zone_id}`, options)._thenUnwrap((obj) => obj.result);
    }
    /**
     * Edits a zone. Only one zone property can be changed at a time.
     *
     * @example
     * ```ts
     * const zone = await client.zones.edit({
     *   zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * });
     * ```
     */
    edit(params, options) {
        const { zone_id, ...body } = params;
        return this._client.patch(`/zones/${zone_id}`, { body, ...options })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Zone Details
     *
     * @example
     * ```ts
     * const zone = await client.zones.get({
     *   zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * });
     * ```
     */
    get(params, options) {
        const { zone_id } = params;
        return this._client.get(`/zones/${zone_id}`, options)._thenUnwrap((obj) => obj.result);
    }
}
export class ZonesV4PagePaginationArray extends V4PagePaginationArray {
}
Zones.ZonesV4PagePaginationArray = ZonesV4PagePaginationArray;
Zones.ActivationCheck = ActivationCheck;
Zones.Settings = Settings;
Zones.CustomNameservers = CustomNameservers;
Zones.CustomNameserverUpdateResponsesSinglePage = CustomNameserverUpdateResponsesSinglePage;
Zones.Holds = Holds;
Zones.Subscriptions = Subscriptions;
Zones.Plans = Plans;
Zones.AvailableRatePlansSinglePage = AvailableRatePlansSinglePage;
Zones.RatePlans = RatePlans;
Zones.RatePlanGetResponsesSinglePage = RatePlanGetResponsesSinglePage;
//# sourceMappingURL=zones.mjs.map