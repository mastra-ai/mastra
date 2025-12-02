"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Publish = void 0;
const resource_1 = require("../../resource.js");
class Publish extends resource_1.APIResource {
    /**
     * Publish current Zaraz preview configuration for a zone.
     *
     * @example
     * ```ts
     * const publish = await client.zaraz.publish.create({
     *   zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * });
     * ```
     */
    create(params, options) {
        const { zone_id, body } = params ?? {};
        return this._client.post(`/zones/${zone_id}/settings/zaraz/publish`, {
            body: body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
}
exports.Publish = Publish;
//# sourceMappingURL=publish.js.map