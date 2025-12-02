// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
import * as AttackersAPI from "./attackers.mjs";
import { Attackers } from "./attackers.mjs";
import * as CategoriesAPI from "./categories.mjs";
import { Categories, } from "./categories.mjs";
import * as CountriesAPI from "./countries.mjs";
import { Countries } from "./countries.mjs";
import * as CronsAPI from "./crons.mjs";
import { Crons } from "./crons.mjs";
import * as EventTagsAPI from "./event-tags.mjs";
import { EventTags, } from "./event-tags.mjs";
import * as IndicatorTypesAPI from "./indicator-types.mjs";
import { IndicatorTypes } from "./indicator-types.mjs";
import * as InsightsAPI from "./insights.mjs";
import { Insights, } from "./insights.mjs";
import * as RawAPI from "./raw.mjs";
import { Raw as RawAPIRaw } from "./raw.mjs";
import * as RelateAPI from "./relate.mjs";
import { Relate } from "./relate.mjs";
import * as TagsAPI from "./tags.mjs";
import { Tags } from "./tags.mjs";
import * as TargetIndustriesAPI from "./target-industries.mjs";
import { TargetIndustries } from "./target-industries.mjs";
import * as DatasetsAPI from "./datasets/datasets.mjs";
import { Datasets, } from "./datasets/datasets.mjs";
export class ThreatEvents extends APIResource {
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
ThreatEvents.Attackers = Attackers;
ThreatEvents.Categories = Categories;
ThreatEvents.Countries = Countries;
ThreatEvents.Crons = Crons;
ThreatEvents.Datasets = Datasets;
ThreatEvents.IndicatorTypes = IndicatorTypes;
ThreatEvents.Raw = RawAPIRaw;
ThreatEvents.Relate = Relate;
ThreatEvents.Tags = Tags;
ThreatEvents.EventTags = EventTags;
ThreatEvents.TargetIndustries = TargetIndustries;
ThreatEvents.Insights = Insights;
//# sourceMappingURL=threat-events.mjs.map