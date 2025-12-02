"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.ManagedTransforms = void 0;
const resource_1 = require("../resource.js");
class ManagedTransforms extends resource_1.APIResource {
    /**
     * Fetches a list of all Managed Transforms.
     */
    list(params, options) {
        const { zone_id } = params;
        return this._client.get(`/zones/${zone_id}/managed_headers`, options)._thenUnwrap((obj) => obj.result);
    }
    /**
     * Disables all Managed Transforms.
     */
    delete(params, options) {
        const { zone_id } = params;
        return this._client.delete(`/zones/${zone_id}/managed_headers`, {
            ...options,
            headers: { Accept: '*/*', ...options?.headers },
        });
    }
    /**
     * Updates the status of one or more Managed Transforms.
     */
    edit(params, options) {
        const { zone_id, ...body } = params;
        return this._client.patch(`/zones/${zone_id}/managed_headers`, { body, ...options })._thenUnwrap((obj) => obj.result);
    }
}
exports.ManagedTransforms = ManagedTransforms;
//# sourceMappingURL=managed-transforms.js.map