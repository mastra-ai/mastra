"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScriptsSinglePage = exports.Scripts = void 0;
const resource_1 = require("../../resource.js");
const pagination_1 = require("../../pagination.js");
class Scripts extends resource_1.APIResource {
    /**
     * Lists all scripts detected by Page Shield.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const script of client.pageShield.scripts.list({
     *   zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * })) {
     *   // ...
     * }
     * ```
     */
    list(params, options) {
        const { zone_id, ...query } = params;
        return this._client.getAPIList(`/zones/${zone_id}/page_shield/scripts`, ScriptsSinglePage, {
            query,
            ...options,
        });
    }
    /**
     * Fetches a script detected by Page Shield by script ID.
     *
     * @example
     * ```ts
     * const script = await client.pageShield.scripts.get(
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    get(scriptId, params, options) {
        const { zone_id } = params;
        return this._client.get(`/zones/${zone_id}/page_shield/scripts/${scriptId}`, options)._thenUnwrap((obj) => obj.result);
    }
}
exports.Scripts = Scripts;
class ScriptsSinglePage extends pagination_1.SinglePage {
}
exports.ScriptsSinglePage = ScriptsSinglePage;
Scripts.ScriptsSinglePage = ScriptsSinglePage;
//# sourceMappingURL=scripts.js.map