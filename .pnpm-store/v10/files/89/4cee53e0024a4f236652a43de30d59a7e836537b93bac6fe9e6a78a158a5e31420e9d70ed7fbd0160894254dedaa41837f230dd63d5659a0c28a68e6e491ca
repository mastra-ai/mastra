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
exports.ZonesV4PagePaginationArray = exports.Zones = void 0;
const resource_1 = require("../../resource.js");
const core_1 = require("../../core.js");
const ActivationCheckAPI = __importStar(require("./activation-check.js"));
const activation_check_1 = require("./activation-check.js");
const CustomNameserversAPI = __importStar(require("./custom-nameservers.js"));
const custom_nameservers_1 = require("./custom-nameservers.js");
const HoldsAPI = __importStar(require("./holds.js"));
const holds_1 = require("./holds.js");
const PlansAPI = __importStar(require("./plans.js"));
const plans_1 = require("./plans.js");
const RatePlansAPI = __importStar(require("./rate-plans.js"));
const rate_plans_1 = require("./rate-plans.js");
const SettingsAPI = __importStar(require("./settings.js"));
const settings_1 = require("./settings.js");
const SubscriptionsAPI = __importStar(require("./subscriptions.js"));
const subscriptions_1 = require("./subscriptions.js");
const pagination_1 = require("../../pagination.js");
class Zones extends resource_1.APIResource {
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
        if ((0, core_1.isRequestOptions)(query)) {
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
exports.Zones = Zones;
class ZonesV4PagePaginationArray extends pagination_1.V4PagePaginationArray {
}
exports.ZonesV4PagePaginationArray = ZonesV4PagePaginationArray;
Zones.ZonesV4PagePaginationArray = ZonesV4PagePaginationArray;
Zones.ActivationCheck = activation_check_1.ActivationCheck;
Zones.Settings = settings_1.Settings;
Zones.CustomNameservers = custom_nameservers_1.CustomNameservers;
Zones.CustomNameserverUpdateResponsesSinglePage = custom_nameservers_1.CustomNameserverUpdateResponsesSinglePage;
Zones.Holds = holds_1.Holds;
Zones.Subscriptions = subscriptions_1.Subscriptions;
Zones.Plans = plans_1.Plans;
Zones.AvailableRatePlansSinglePage = plans_1.AvailableRatePlansSinglePage;
Zones.RatePlans = rate_plans_1.RatePlans;
Zones.RatePlanGetResponsesSinglePage = rate_plans_1.RatePlanGetResponsesSinglePage;
//# sourceMappingURL=zones.js.map