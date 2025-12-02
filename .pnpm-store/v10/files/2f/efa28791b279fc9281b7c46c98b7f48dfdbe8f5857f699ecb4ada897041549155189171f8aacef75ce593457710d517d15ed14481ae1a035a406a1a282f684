"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Settings = void 0;
const resource_1 = require("../../resource.js");
class Settings extends resource_1.APIResource {
    /**
     * Retrieve the current status of Content Scanning.
     */
    get(params, options) {
        const { zone_id } = params;
        return this._client.get(`/zones/${zone_id}/content-upload-scan/settings`, options)._thenUnwrap((obj) => obj.result);
    }
}
exports.Settings = Settings;
//# sourceMappingURL=settings.js.map