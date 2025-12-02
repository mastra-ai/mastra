import { APIResource } from "../../../resource.js";
import * as Core from "../../../core.js";
import * as AttackersAPI from "./attackers.js";
import { AttackerListParams, AttackerListResponse, Attackers } from "./attackers.js";
import * as CategoriesAPI from "./categories.js";
import { Categories, CategoryCreateParams, CategoryCreateResponse, CategoryDeleteParams, CategoryDeleteResponse, CategoryEditParams, CategoryEditResponse, CategoryGetParams, CategoryGetResponse, CategoryListParams, CategoryListResponse } from "./categories.js";
import * as CountriesAPI from "./countries.js";
import { Countries, CountryListParams, CountryListResponse } from "./countries.js";
import * as CronsAPI from "./crons.js";
import { CronEditParams, CronEditResponse, CronListParams, CronListResponse, Crons } from "./crons.js";
import * as EventTagsAPI from "./event-tags.js";
import { EventTagCreateParams, EventTagCreateResponse, EventTagDeleteParams, EventTagDeleteResponse, EventTags } from "./event-tags.js";
import * as IndicatorTypesAPI from "./indicator-types.js";
import { IndicatorTypeListParams, IndicatorTypeListResponse, IndicatorTypes } from "./indicator-types.js";
import * as InsightsAPI from "./insights.js";
import { InsightCreateParams, InsightCreateResponse, InsightDeleteParams, InsightDeleteResponse, InsightEditParams, InsightEditResponse, InsightGetParams, InsightGetResponse, Insights } from "./insights.js";
import * as RawAPI from "./raw.js";
import { Raw as RawAPIRaw, RawEditParams, RawEditResponse, RawGetParams, RawGetResponse } from "./raw.js";
import * as RelateAPI from "./relate.js";
import { Relate, RelateDeleteParams, RelateDeleteResponse } from "./relate.js";
import * as TagsAPI from "./tags.js";
import { TagCreateParams, TagCreateResponse, Tags } from "./tags.js";
import * as TargetIndustriesAPI from "./target-industries.js";
import { TargetIndustries, TargetIndustryListParams, TargetIndustryListResponse } from "./target-industries.js";
import * as DatasetsAPI from "./datasets/datasets.js";
import { DatasetCreateParams, DatasetCreateResponse, DatasetEditParams, DatasetEditResponse, DatasetGetParams, DatasetGetResponse, DatasetListParams, DatasetListResponse, DatasetRawParams, DatasetRawResponse, Datasets } from "./datasets/datasets.js";
export declare class ThreatEvents extends APIResource {
    attackers: AttackersAPI.Attackers;
    categories: CategoriesAPI.Categories;
    countries: CountriesAPI.Countries;
    crons: CronsAPI.Crons;
    datasets: DatasetsAPI.Datasets;
    indicatorTypes: IndicatorTypesAPI.IndicatorTypes;
    raw: RawAPI.Raw;
    relate: RelateAPI.Relate;
    tags: TagsAPI.Tags;
    eventTags: EventTagsAPI.EventTags;
    targetIndustries: TargetIndustriesAPI.TargetIndustries;
    insights: InsightsAPI.Insights;
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
    create(params: ThreatEventCreateParams, options?: Core.RequestOptions): Core.APIPromise<ThreatEventCreateResponse>;
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
    list(params: ThreatEventListParams, options?: Core.RequestOptions): Core.APIPromise<ThreatEventListResponse>;
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
    delete(eventId: string, params: ThreatEventDeleteParams, options?: Core.RequestOptions): Core.APIPromise<ThreatEventDeleteResponse>;
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
    bulkCreate(params: ThreatEventBulkCreateParams, options?: Core.RequestOptions): Core.APIPromise<ThreatEventBulkCreateResponse>;
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
    edit(eventId: string, params: ThreatEventEditParams, options?: Core.RequestOptions): Core.APIPromise<ThreatEventEditResponse>;
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
    get(eventId: string, params: ThreatEventGetParams, options?: Core.RequestOptions): Core.APIPromise<ThreatEventGetResponse>;
}
export interface ThreatEventCreateResponse {
    id: number;
    accountId: number;
    attacker: string;
    attackerCountry: string;
    category: string;
    date: string;
    event: string;
    indicator: string;
    indicatorType: string;
    indicatorTypeId: number;
    killChain: number;
    mitreAttack: Array<string>;
    numReferenced: number;
    numReferences: number;
    rawId: string;
    referenced: Array<string>;
    referencedIds: Array<number>;
    references: Array<string>;
    referencesIds: Array<number>;
    tags: Array<string>;
    targetCountry: string;
    targetIndustry: string;
    tlp: string;
    uuid: string;
    insight?: string;
    releasabilityId?: string;
}
export type ThreatEventListResponse = Array<ThreatEventListResponse.ThreatEventListResponseItem>;
export declare namespace ThreatEventListResponse {
    interface ThreatEventListResponseItem {
        id: number;
        accountId: number;
        attacker: string;
        attackerCountry: string;
        category: string;
        date: string;
        event: string;
        indicator: string;
        indicatorType: string;
        indicatorTypeId: number;
        killChain: number;
        mitreAttack: Array<string>;
        numReferenced: number;
        numReferences: number;
        rawId: string;
        referenced: Array<string>;
        referencedIds: Array<number>;
        references: Array<string>;
        referencesIds: Array<number>;
        tags: Array<string>;
        targetCountry: string;
        targetIndustry: string;
        tlp: string;
        uuid: string;
        insight?: string;
        releasabilityId?: string;
    }
}
export interface ThreatEventDeleteResponse {
    uuid: string;
}
/**
 * Number of created bulk events
 */
export type ThreatEventBulkCreateResponse = number;
export interface ThreatEventEditResponse {
    id: number;
    accountId: number;
    attacker: string;
    attackerCountry: string;
    category: string;
    date: string;
    event: string;
    indicator: string;
    indicatorType: string;
    indicatorTypeId: number;
    killChain: number;
    mitreAttack: Array<string>;
    numReferenced: number;
    numReferences: number;
    rawId: string;
    referenced: Array<string>;
    referencedIds: Array<number>;
    references: Array<string>;
    referencesIds: Array<number>;
    tags: Array<string>;
    targetCountry: string;
    targetIndustry: string;
    tlp: string;
    uuid: string;
    insight?: string;
    releasabilityId?: string;
}
export interface ThreatEventGetResponse {
    id: number;
    accountId: number;
    attacker: string;
    attackerCountry: string;
    category: string;
    date: string;
    event: string;
    indicator: string;
    indicatorType: string;
    indicatorTypeId: number;
    killChain: number;
    mitreAttack: Array<string>;
    numReferenced: number;
    numReferences: number;
    rawId: string;
    referenced: Array<string>;
    referencedIds: Array<number>;
    references: Array<string>;
    referencesIds: Array<number>;
    tags: Array<string>;
    targetCountry: string;
    targetIndustry: string;
    tlp: string;
    uuid: string;
    insight?: string;
    releasabilityId?: string;
}
export interface ThreatEventCreateParams {
    /**
     * Path param: Account ID.
     */
    account_id: string;
    /**
     * Body param:
     */
    category: string;
    /**
     * Body param:
     */
    date: string;
    /**
     * Body param:
     */
    event: string;
    /**
     * Body param:
     */
    indicatorType: string;
    /**
     * Body param:
     */
    raw: ThreatEventCreateParams.Raw;
    /**
     * Body param:
     */
    tlp: string;
    /**
     * Body param:
     */
    accountId?: number;
    /**
     * Body param:
     */
    attacker?: string;
    /**
     * Body param:
     */
    attackerCountry?: string;
    /**
     * Body param:
     */
    datasetId?: string;
    /**
     * Body param:
     */
    indicator?: string;
    /**
     * Body param:
     */
    tags?: Array<string>;
    /**
     * Body param:
     */
    targetCountry?: string;
    /**
     * Body param:
     */
    targetIndustry?: string;
}
export declare namespace ThreatEventCreateParams {
    interface Raw {
        data: {
            [key: string]: unknown;
        } | null;
        source?: string;
        tlp?: string;
    }
}
export interface ThreatEventListParams {
    /**
     * Path param: Account ID.
     */
    account_id: string;
    /**
     * Query param:
     */
    datasetId?: Array<string>;
    /**
     * Query param:
     */
    forceRefresh?: boolean;
    /**
     * Query param:
     */
    order?: 'asc' | 'desc';
    /**
     * Query param:
     */
    orderBy?: string;
    /**
     * Query param:
     */
    page?: number;
    /**
     * Query param:
     */
    pageSize?: number;
    /**
     * Query param:
     */
    search?: Array<ThreatEventListParams.Search>;
}
export declare namespace ThreatEventListParams {
    interface Search {
        field?: string;
        op?: 'equals' | 'not' | 'gt' | 'gte' | 'lt' | 'lte' | 'like' | 'contains' | 'startsWith' | 'endsWith' | 'in' | 'find';
        value?: string | number | Array<string | number>;
    }
}
export interface ThreatEventDeleteParams {
    /**
     * Account ID.
     */
    account_id: string;
}
export interface ThreatEventBulkCreateParams {
    /**
     * Path param: Account ID.
     */
    account_id: string;
    /**
     * Body param:
     */
    data: Array<ThreatEventBulkCreateParams.Data>;
    /**
     * Body param:
     */
    datasetId: string;
}
export declare namespace ThreatEventBulkCreateParams {
    interface Data {
        category: string;
        date: string;
        event: string;
        indicatorType: string;
        raw: Data.Raw;
        tlp: string;
        accountId?: number;
        attacker?: string;
        attackerCountry?: string;
        datasetId?: string;
        indicator?: string;
        tags?: Array<string>;
        targetCountry?: string;
        targetIndustry?: string;
    }
    namespace Data {
        interface Raw {
            data: {
                [key: string]: unknown;
            } | null;
            source?: string;
            tlp?: string;
        }
    }
}
export interface ThreatEventEditParams {
    /**
     * Path param: Account ID.
     */
    account_id: string;
    /**
     * Body param:
     */
    attacker?: string;
    /**
     * Body param:
     */
    attackerCountry?: string;
    /**
     * Body param:
     */
    category?: string;
    /**
     * Body param:
     */
    date?: string;
    /**
     * Body param:
     */
    event?: string;
    /**
     * Body param:
     */
    indicator?: string;
    /**
     * Body param:
     */
    indicatorType?: string;
    /**
     * Body param:
     */
    targetCountry?: string;
    /**
     * Body param:
     */
    targetIndustry?: string;
    /**
     * Body param:
     */
    tlp?: string;
}
export interface ThreatEventGetParams {
    /**
     * Account ID.
     */
    account_id: string;
}
export declare namespace ThreatEvents {
    export { type ThreatEventCreateResponse as ThreatEventCreateResponse, type ThreatEventListResponse as ThreatEventListResponse, type ThreatEventDeleteResponse as ThreatEventDeleteResponse, type ThreatEventBulkCreateResponse as ThreatEventBulkCreateResponse, type ThreatEventEditResponse as ThreatEventEditResponse, type ThreatEventGetResponse as ThreatEventGetResponse, type ThreatEventCreateParams as ThreatEventCreateParams, type ThreatEventListParams as ThreatEventListParams, type ThreatEventDeleteParams as ThreatEventDeleteParams, type ThreatEventBulkCreateParams as ThreatEventBulkCreateParams, type ThreatEventEditParams as ThreatEventEditParams, type ThreatEventGetParams as ThreatEventGetParams, };
    export { Attackers as Attackers, type AttackerListResponse as AttackerListResponse, type AttackerListParams as AttackerListParams, };
    export { Categories as Categories, type CategoryCreateResponse as CategoryCreateResponse, type CategoryListResponse as CategoryListResponse, type CategoryDeleteResponse as CategoryDeleteResponse, type CategoryEditResponse as CategoryEditResponse, type CategoryGetResponse as CategoryGetResponse, type CategoryCreateParams as CategoryCreateParams, type CategoryListParams as CategoryListParams, type CategoryDeleteParams as CategoryDeleteParams, type CategoryEditParams as CategoryEditParams, type CategoryGetParams as CategoryGetParams, };
    export { Countries as Countries, type CountryListResponse as CountryListResponse, type CountryListParams as CountryListParams, };
    export { Crons as Crons, type CronListResponse as CronListResponse, type CronEditResponse as CronEditResponse, type CronListParams as CronListParams, type CronEditParams as CronEditParams, };
    export { Datasets as Datasets, type DatasetCreateResponse as DatasetCreateResponse, type DatasetListResponse as DatasetListResponse, type DatasetEditResponse as DatasetEditResponse, type DatasetGetResponse as DatasetGetResponse, type DatasetRawResponse as DatasetRawResponse, type DatasetCreateParams as DatasetCreateParams, type DatasetListParams as DatasetListParams, type DatasetEditParams as DatasetEditParams, type DatasetGetParams as DatasetGetParams, type DatasetRawParams as DatasetRawParams, };
    export { IndicatorTypes as IndicatorTypes, type IndicatorTypeListResponse as IndicatorTypeListResponse, type IndicatorTypeListParams as IndicatorTypeListParams, };
    export { RawAPIRaw as Raw, type RawEditResponse as RawEditResponse, type RawGetResponse as RawGetResponse, type RawEditParams as RawEditParams, type RawGetParams as RawGetParams, };
    export { Relate as Relate, type RelateDeleteResponse as RelateDeleteResponse, type RelateDeleteParams as RelateDeleteParams, };
    export { Tags as Tags, type TagCreateResponse as TagCreateResponse, type TagCreateParams as TagCreateParams, };
    export { EventTags as EventTags, type EventTagCreateResponse as EventTagCreateResponse, type EventTagDeleteResponse as EventTagDeleteResponse, type EventTagCreateParams as EventTagCreateParams, type EventTagDeleteParams as EventTagDeleteParams, };
    export { TargetIndustries as TargetIndustries, type TargetIndustryListResponse as TargetIndustryListResponse, type TargetIndustryListParams as TargetIndustryListParams, };
    export { Insights as Insights, type InsightCreateResponse as InsightCreateResponse, type InsightDeleteResponse as InsightDeleteResponse, type InsightEditResponse as InsightEditResponse, type InsightGetResponse as InsightGetResponse, type InsightCreateParams as InsightCreateParams, type InsightDeleteParams as InsightDeleteParams, type InsightEditParams as InsightEditParams, type InsightGetParams as InsightGetParams, };
}
//# sourceMappingURL=threat-events.d.ts.map