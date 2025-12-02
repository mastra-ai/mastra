// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
import * as ASNsAPI from "./asns.mjs";
import { ASNs, } from "./asns.mjs";
import * as LocationsAPI from "./locations.mjs";
import { Locations, } from "./locations.mjs";
export class Entities extends APIResource {
    constructor() {
        super(...arguments);
        this.asns = new ASNsAPI.ASNs(this._client);
        this.locations = new LocationsAPI.Locations(this._client);
    }
    /**
     * Retrieves IP address information.
     *
     * @example
     * ```ts
     * const entity = await client.radar.entities.get({
     *   ip: '8.8.8.8',
     * });
     * ```
     */
    get(query, options) {
        return this._client.get('/radar/entities/ip', { query, ...options })._thenUnwrap((obj) => obj.result);
    }
}
Entities.ASNs = ASNs;
Entities.Locations = Locations;
//# sourceMappingURL=entities.mjs.map