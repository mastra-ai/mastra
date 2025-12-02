import { APIResource } from "../../resource.js";
import * as Core from "../../core.js";
import { SinglePage } from "../../pagination.js";
export declare class Edge extends APIResource {
    /**
     * Creates a new Instant Logs job for a zone.
     *
     * @example
     * ```ts
     * const instantLogpushJob = await client.logpush.edge.create({
     *   zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * });
     * ```
     */
    create(params: EdgeCreateParams, options?: Core.RequestOptions): Core.APIPromise<InstantLogpushJob | null>;
    /**
     * Lists Instant Logs jobs for a zone.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const instantLogpushJob of client.logpush.edge.get(
     *   { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * )) {
     *   // ...
     * }
     * ```
     */
    get(params: EdgeGetParams, options?: Core.RequestOptions): Core.PagePromise<InstantLogpushJobsSinglePage, InstantLogpushJob | null>;
}
export declare class InstantLogpushJobsSinglePage extends SinglePage<InstantLogpushJob | null> {
}
export interface InstantLogpushJob {
    /**
     * Unique WebSocket address that will receive messages from Cloudflare’s edge.
     */
    destination_conf?: string;
    /**
     * Comma-separated list of fields.
     */
    fields?: string;
    /**
     * Filters to drill down into specific events.
     */
    filter?: string;
    /**
     * The sample parameter is the sample rate of the records set by the client:
     * "sample": 1 is 100% of records "sample": 10 is 10% and so on.
     */
    sample?: number;
    /**
     * Unique session id of the job.
     */
    session_id?: string;
}
export interface EdgeCreateParams {
    /**
     * Path param: Identifier.
     */
    zone_id: string;
    /**
     * Body param: Comma-separated list of fields.
     */
    fields?: string;
    /**
     * Body param: Filters to drill down into specific events.
     */
    filter?: string;
    /**
     * Body param: The sample parameter is the sample rate of the records set by the
     * client: "sample": 1 is 100% of records "sample": 10 is 10% and so on.
     */
    sample?: number;
}
export interface EdgeGetParams {
    /**
     * Identifier.
     */
    zone_id: string;
}
export declare namespace Edge {
    export { type InstantLogpushJob as InstantLogpushJob, InstantLogpushJobsSinglePage as InstantLogpushJobsSinglePage, type EdgeCreateParams as EdgeCreateParams, type EdgeGetParams as EdgeGetParams, };
}
//# sourceMappingURL=edge.d.ts.map