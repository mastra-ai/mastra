"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Config = void 0;
const resource_1 = require("../../resource.js");
class Config extends resource_1.APIResource {
    /**
     * Updates Zaraz configuration for a zone.
     *
     * @example
     * ```ts
     * const configuration = await client.zaraz.config.update({
     *   zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *   dataLayer: true,
     *   debugKey: 'debugKey',
     *   settings: { autoInjectScript: true },
     *   tools: {
     *     foo: { ... },
     *   },
     *   triggers: {
     *     foo: { ... },
     *   },
     *   variables: {
     *     foo: { ... },
     *   },
     *   zarazVersion: 0,
     * });
     * ```
     */
    update(params, options) {
        const { zone_id, ...body } = params;
        return this._client.put(`/zones/${zone_id}/settings/zaraz/config`, { body, ...options })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Gets latest Zaraz configuration for a zone. It can be preview or published
     * configuration, whichever was the last updated. Secret variables values will not
     * be included.
     *
     * @example
     * ```ts
     * const configuration = await client.zaraz.config.get({
     *   zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * });
     * ```
     */
    get(params, options) {
        const { zone_id } = params;
        return this._client.get(`/zones/${zone_id}/settings/zaraz/config`, options)._thenUnwrap((obj) => obj.result);
    }
}
exports.Config = Config;
//# sourceMappingURL=config.js.map