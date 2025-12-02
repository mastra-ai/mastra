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
exports.ThreatEvents = void 0;
const resource_1 = require("../../../resource.js");
const AttackersAPI = __importStar(require("./attackers.js"));
const attackers_1 = require("./attackers.js");
const CategoriesAPI = __importStar(require("./categories.js"));
const categories_1 = require("./categories.js");
const CountriesAPI = __importStar(require("./countries.js"));
const countries_1 = require("./countries.js");
const CronsAPI = __importStar(require("./crons.js"));
const crons_1 = require("./crons.js");
const EventTagsAPI = __importStar(require("./event-tags.js"));
const event_tags_1 = require("./event-tags.js");
const IndicatorTypesAPI = __importStar(require("./indicator-types.js"));
const indicator_types_1 = require("./indicator-types.js");
const InsightsAPI = __importStar(require("./insights.js"));
const insights_1 = require("./insights.js");
const RawAPI = __importStar(require("./raw.js"));
const raw_1 = require("./raw.js");
const RelateAPI = __importStar(require("./relate.js"));
const relate_1 = require("./relate.js");
const TagsAPI = __importStar(require("./tags.js"));
const tags_1 = require("./tags.js");
const TargetIndustriesAPI = __importStar(require("./target-industries.js"));
const target_industries_1 = require("./target-industries.js");
const DatasetsAPI = __importStar(require("./datasets/datasets.js"));
const datasets_1 = require("./datasets/datasets.js");
class ThreatEvents extends resource_1.APIResource {
    constructor() {
        super(...arguments);
        this.attackers = new AttackersAPI.Attackers(this._client);
        this.categories = new CategoriesAPI.Categories(this._client);
        this.countries = new CountriesAPI.Countries(this._client);
        this.crons = new CronsAPI.Crons(this._client);
        this.datasets = new DatasetsAPI.Datasets(this._client);
        this.indicatorTypes = new IndicatorTypesAPI.IndicatorTypes(this._client);
        this.raw = new RawAPI.Raw(this._client);
        this.relate = new RelateAPI.Relate(this._client);
        this.tags = new TagsAPI.Tags(this._client);
        this.eventTags = new EventTagsAPI.EventTags(this._client);
        this.targetIndustries = new TargetIndustriesAPI.TargetIndustries(this._client);
        this.insights = new InsightsAPI.Insights(this._client);
    }
    /**
     * Events must be created in a client-specific dataset, which means the `datasetId`
     * parameter must be defined. To create a dataset, see the
     * [`Create Dataset`](https://developers.cloudflare.com/api/resources/cloudforce_one/subresources/threat_events/subresources/datasets/methods/create/)
     * endpoint.
     *
     * @example
     * ```ts
     * const threatEvent =
     *   await client.cloudforceOne.threatEvents.create({
     *     account_id: 'account_id',
     *     category: 'Domain Resolution',
     *     date: '2022-04-01T00:00:00Z',
     *     event: 'An attacker registered the domain domain.com',
     *     indicatorType: 'domain',
     *     raw: { data: { foo: 'bar' } },
     *     tlp: 'amber',
     *   });
     * ```
     */
    create(params, options) {
        const { account_id, ...body } = params;
        return this._client.post(`/accounts/${account_id}/cloudforce-one/events/create`, { body, ...options });
    }
    /**
     * The `datasetId` must be defined (to list existing datasets (and their IDs), use
     * the
     * [`List Datasets`](https://developers.cloudflare.com/api/resources/cloudforce_one/subresources/threat_events/subresources/datasets/methods/list/)
     * endpoint). Also, must provide query parameters.
     *
     * @example
     * ```ts
     * const threatEvents =
     *   await client.cloudforceOne.threatEvents.list({
     *     account_id: 'account_id',
     *   });
     * ```
     */
    list(params, options) {
        const { account_id, ...query } = params;
        return this._client.get(`/accounts/${account_id}/cloudforce-one/events`, { query, ...options });
    }
    /**
     * The `datasetId` parameter must be defined. To list existing datasets (and their
     * IDs) in your account, use the
     * [`List Datasets`](https://developers.cloudflare.com/api/resources/cloudforce_one/subresources/threat_events/subresources/datasets/methods/list/)
     * endpoint.
     *
     * @example
     * ```ts
     * const threatEvent =
     *   await client.cloudforceOne.threatEvents.delete(
     *     'event_id',
     *     { account_id: 'account_id' },
     *   );
     * ```
     */
    delete(eventId, params, options) {
        const { account_id } = params;
        return this._client.delete(`/accounts/${account_id}/cloudforce-one/events/${eventId}`, options);
    }
    /**
     * The `datasetId` parameter must be defined. To list existing datasets (and their
     * IDs) in your account, use the
     * [`List Datasets`](https://developers.cloudflare.com/api/resources/cloudforce_one/subresources/threat_events/subresources/datasets/methods/list/)
     * endpoint.
     *
     * @example
     * ```ts
     * const response =
     *   await client.cloudforceOne.threatEvents.bulkCreate({
     *     account_id: 'account_id',
     *     data: [
     *       {
     *         category: 'Domain Resolution',
     *         date: '2022-04-01T00:00:00Z',
     *         event:
     *           'An attacker registered the domain domain.com',
     *         indicatorType: 'domain',
     *         raw: { data: { foo: 'bar' } },
     *         tlp: 'amber',
     *       },
     *     ],
     *     datasetId: 'durableObjectName',
     *   });
     * ```
     */
    bulkCreate(params, options) {
        const { account_id, ...body } = params;
        return this._client.post(`/accounts/${account_id}/cloudforce-one/events/create/bulk`, {
            body,
            ...options,
        });
    }
    /**
     * Updates an event
     *
     * @example
     * ```ts
     * const response =
     *   await client.cloudforceOne.threatEvents.edit('event_id', {
     *     account_id: 'account_id',
     *   });
     * ```
     */
    edit(eventId, params, options) {
        const { account_id, ...body } = params;
        return this._client.patch(`/accounts/${account_id}/cloudforce-one/events/${eventId}`, {
            body,
            ...options,
        });
    }
    /**
     * Reads an event
     *
     * @example
     * ```ts
     * const threatEvent =
     *   await client.cloudforceOne.threatEvents.get('event_id', {
     *     account_id: 'account_id',
     *   });
     * ```
     */
    get(eventId, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/cloudforce-one/events/${eventId}`, options);
    }
}
exports.ThreatEvents = ThreatEvents;
ThreatEvents.Attackers = attackers_1.Attackers;
ThreatEvents.Categories = categories_1.Categories;
ThreatEvents.Countries = countries_1.Countries;
ThreatEvents.Crons = crons_1.Crons;
ThreatEvents.Datasets = datasets_1.Datasets;
ThreatEvents.IndicatorTypes = indicator_types_1.IndicatorTypes;
ThreatEvents.Raw = raw_1.Raw;
ThreatEvents.Relate = relate_1.Relate;
ThreatEvents.Tags = tags_1.Tags;
ThreatEvents.EventTags = event_tags_1.EventTags;
ThreatEvents.TargetIndustries = target_industries_1.TargetIndustries;
ThreatEvents.Insights = insights_1.Insights;
//# sourceMappingURL=threat-events.js.map