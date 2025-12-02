import { APIResource } from "../../../resource.js";
import * as Core from "../../../core.js";
export declare class Insights extends APIResource {
    /**
     * Adds an insight to an event
     *
     * @example
     * ```ts
     * const insight =
     *   await client.cloudforceOne.threatEvents.insights.create(
     *     'event_id',
     *     {
     *       account_id: 'account_id',
     *       content:
     *         'Here is some additional context _in markdown_',
     *     },
     *   );
     * ```
     */
    create(eventId: string, params: InsightCreateParams, options?: Core.RequestOptions): Core.APIPromise<InsightCreateResponse>;
    /**
     * Deletes an event insight
     *
     * @example
     * ```ts
     * const insight =
     *   await client.cloudforceOne.threatEvents.insights.delete(
     *     'event_id',
     *     'insight_id',
     *     { account_id: 'account_id' },
     *   );
     * ```
     */
    delete(eventId: string, insightId: string, params: InsightDeleteParams, options?: Core.RequestOptions): Core.APIPromise<InsightDeleteResponse>;
    /**
     * Updates an event insight
     *
     * @example
     * ```ts
     * const response =
     *   await client.cloudforceOne.threatEvents.insights.edit(
     *     'event_id',
     *     'insight_id',
     *     {
     *       account_id: 'account_id',
     *       content:
     *         'Updated: Here is some additional context _in markdown_',
     *     },
     *   );
     * ```
     */
    edit(eventId: string, insightId: string, params: InsightEditParams, options?: Core.RequestOptions): Core.APIPromise<InsightEditResponse>;
    /**
     * Reads an event insight
     *
     * @example
     * ```ts
     * const insight =
     *   await client.cloudforceOne.threatEvents.insights.get(
     *     'event_id',
     *     'insight_id',
     *     { account_id: 'account_id' },
     *   );
     * ```
     */
    get(eventId: string, insightId: string, params: InsightGetParams, options?: Core.RequestOptions): Core.APIPromise<InsightGetResponse>;
}
export interface InsightCreateResponse {
    content: string;
    uuid: string;
}
export interface InsightDeleteResponse {
    success: boolean;
}
export interface InsightEditResponse {
    content: string;
    uuid: string;
}
export interface InsightGetResponse {
    content: string;
    uuid: string;
}
export interface InsightCreateParams {
    /**
     * Path param: Account ID.
     */
    account_id: string;
    /**
     * Body param:
     */
    content: string;
}
export interface InsightDeleteParams {
    /**
     * Account ID.
     */
    account_id: string;
}
export interface InsightEditParams {
    /**
     * Path param: Account ID.
     */
    account_id: string;
    /**
     * Body param:
     */
    content: string;
}
export interface InsightGetParams {
    /**
     * Account ID.
     */
    account_id: string;
}
export declare namespace Insights {
    export { type InsightCreateResponse as InsightCreateResponse, type InsightDeleteResponse as InsightDeleteResponse, type InsightEditResponse as InsightEditResponse, type InsightGetResponse as InsightGetResponse, type InsightCreateParams as InsightCreateParams, type InsightDeleteParams as InsightDeleteParams, type InsightEditParams as InsightEditParams, type InsightGetParams as InsightGetParams, };
}
//# sourceMappingURL=insights.d.ts.map