// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
import * as BulksAPI from "./bulks.mjs";
import { Bulks } from "./bulks.mjs";
export class Domains extends APIResource {
    constructor() {
        super(...arguments);
        this.bulks = new BulksAPI.Bulks(this._client);
    }
    /**
     * Gets security details and statistics about a domain.
     *
     * @example
     * ```ts
     * const domain = await client.intel.domains.get({
     *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * });
     * ```
     */
    get(params, options) {
        const { account_id, ...query } = params;
        return this._client.get(`/accounts/${account_id}/intel/domain`, { query, ...options })._thenUnwrap((obj) => obj.result);
    }
}
Domains.Bulks = Bulks;
//# sourceMappingURL=domains.mjs.map