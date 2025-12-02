import { APIResource } from "../../../resource.js";
import * as Core from "../../../core.js";
export declare class Raw extends APIResource {
    /**
     * Updates a raw event
     *
     * @example
     * ```ts
     * const response =
     *   await client.cloudforceOne.threatEvents.raw.edit(
     *     'event_id',
     *     'raw_id',
     *     { account_id: 'account_id' },
     *   );
     * ```
     */
    edit(eventId: string, rawId: string, params: RawEditParams, options?: Core.RequestOptions): Core.APIPromise<RawEditResponse>;
    /**
     * Reads data for a raw event
     *
     * @example
     * ```ts
     * const raw = await client.cloudforceOne.threatEvents.raw.get(
     *   'event_id',
     *   'raw_id',
     *   { account_id: 'account_id' },
     * );
     * ```
     */
    get(eventId: string, rawId: string, params: RawGetParams, options?: Core.RequestOptions): Core.APIPromise<RawGetResponse>;
}
export interface RawEditResponse {
    id: string;
    data: unknown;
}
export interface RawGetResponse {
    id: string;
    accountId: number;
    created: string;
    data: unknown;
    source: string;
    tlp: string;
}
export interface RawEditParams {
    /**
     * Path param: Account ID.
     */
    account_id: string;
    /**
     * Body param:
     */
    data?: unknown;
    /**
     * Body param:
     */
    source?: string;
    /**
     * Body param:
     */
    tlp?: string;
}
export interface RawGetParams {
    /**
     * Account ID.
     */
    account_id: string;
}
export declare namespace Raw {
    export { type RawEditResponse as RawEditResponse, type RawGetResponse as RawGetResponse, type RawEditParams as RawEditParams, type RawGetParams as RawGetParams, };
}
//# sourceMappingURL=raw.d.ts.map