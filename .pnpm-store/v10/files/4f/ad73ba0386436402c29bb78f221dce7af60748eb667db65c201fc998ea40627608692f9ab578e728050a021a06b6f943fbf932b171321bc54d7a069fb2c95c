// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
import * as FieldsAPI from "./fields.mjs";
import { Fields } from "./fields.mjs";
export class Received extends APIResource {
    constructor() {
        super(...arguments);
        this.fields = new FieldsAPI.Fields(this._client);
    }
    /**
     * The `/received` api route allows customers to retrieve their edge HTTP logs. The
     * basic access pattern is "give me all the logs for zone Z for minute M", where
     * the minute M refers to the time records were received at Cloudflare's central
     * data center. `start` is inclusive, and `end` is exclusive. Because of that, to
     * get all data, at minutely cadence, starting at 10AM, the proper values are:
     * `start=2018-05-20T10:00:00Z&end=2018-05-20T10:01:00Z`, then
     * `start=2018-05-20T10:01:00Z&end=2018-05-20T10:02:00Z` and so on; the overlap
     * will be handled properly.
     *
     * @example
     * ```ts
     * const received = await client.logs.received.get({
     *   zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *   end: '2018-05-20T10:01:00Z',
     * });
     * ```
     */
    get(params, options) {
        const { zone_id, ...query } = params;
        return this._client.get(`/zones/${zone_id}/logs/received`, { query, ...options });
    }
}
Received.Fields = Fields;
//# sourceMappingURL=received.mjs.map