// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
import * as RegionsAPI from "./regions.mjs";
import { RegionListResponsesSinglePage, Regions } from "./regions.mjs";
import { SinglePage } from "../../../pagination.mjs";
export class RegionalHostnames extends APIResource {
    constructor() {
        super(...arguments);
        this.regions = new RegionsAPI.Regions(this._client);
    }
    /**
     * Create a new Regional Hostname entry. Cloudflare will only use data centers that
     * are physically located within the chosen region to decrypt and service HTTPS
     * traffic. Learn more about
     * [Regional Services](https://developers.cloudflare.com/data-localization/regional-services/get-started/).
     *
     * @example
     * ```ts
     * const regionalHostname =
     *   await client.addressing.regionalHostnames.create({
     *     zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *     hostname: 'foo.example.com',
     *     region_key: 'ca',
     *   });
     * ```
     */
    create(params, options) {
        const { zone_id, ...body } = params;
        return this._client.post(`/zones/${zone_id}/addressing/regional_hostnames`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * List all Regional Hostnames within a zone.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const regionalHostnameListResponse of client.addressing.regionalHostnames.list(
     *   { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(params, options) {
        const { zone_id } = params;
        return this._client.getAPIList(`/zones/${zone_id}/addressing/regional_hostnames`, RegionalHostnameListResponsesSinglePage, options);
    }
    /**
     * Delete the region configuration for a specific Regional Hostname.
     *
     * @example
     * ```ts
     * const regionalHostname =
     *   await client.addressing.regionalHostnames.delete(
     *     'foo.example.com',
     *     { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    delete(hostname, params, options) {
        const { zone_id } = params;
        return this._client.delete(`/zones/${zone_id}/addressing/regional_hostnames/${hostname}`, options);
    }
    /**
     * Update the configuration for a specific Regional Hostname. Only the region_key
     * of a hostname is mutable.
     *
     * @example
     * ```ts
     * const response =
     *   await client.addressing.regionalHostnames.edit(
     *     'foo.example.com',
     *     {
     *       zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *       region_key: 'ca',
     *     },
     *   );
     * ```
     */
    edit(hostname, params, options) {
        const { zone_id, ...body } = params;
        return this._client.patch(`/zones/${zone_id}/addressing/regional_hostnames/${hostname}`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Fetch the configuration for a specific Regional Hostname, within a zone.
     *
     * @example
     * ```ts
     * const regionalHostname =
     *   await client.addressing.regionalHostnames.get(
     *     'foo.example.com',
     *     { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    get(hostname, params, options) {
        const { zone_id } = params;
        return this._client.get(`/zones/${zone_id}/addressing/regional_hostnames/${hostname}`, options)._thenUnwrap((obj) => obj.result);
    }
}
export class RegionalHostnameListResponsesSinglePage extends SinglePage {
}
RegionalHostnames.RegionalHostnameListResponsesSinglePage = RegionalHostnameListResponsesSinglePage;
RegionalHostnames.Regions = Regions;
RegionalHostnames.RegionListResponsesSinglePage = RegionListResponsesSinglePage;
//# sourceMappingURL=regional-hostnames.mjs.map