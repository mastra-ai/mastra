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
exports.RegionalHostnameListResponsesSinglePage = exports.RegionalHostnames = void 0;
const resource_1 = require("../../../resource.js");
const RegionsAPI = __importStar(require("./regions.js"));
const regions_1 = require("./regions.js");
const pagination_1 = require("../../../pagination.js");
class RegionalHostnames extends resource_1.APIResource {
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
exports.RegionalHostnames = RegionalHostnames;
class RegionalHostnameListResponsesSinglePage extends pagination_1.SinglePage {
}
exports.RegionalHostnameListResponsesSinglePage = RegionalHostnameListResponsesSinglePage;
RegionalHostnames.RegionalHostnameListResponsesSinglePage = RegionalHostnameListResponsesSinglePage;
RegionalHostnames.Regions = regions_1.Regions;
RegionalHostnames.RegionListResponsesSinglePage = regions_1.RegionListResponsesSinglePage;
//# sourceMappingURL=regional-hostnames.js.map