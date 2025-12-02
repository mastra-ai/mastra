"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Health = void 0;
const resource_1 = require("../../../../resource.js");
class Health extends resource_1.APIResource {
    /**
     * Benchmark Durable Object warmup
     *
     * @example
     * ```ts
     * const health =
     *   await client.cloudforceOne.threatEvents.datasets.health.get(
     *     '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
     *     { account_id: 'account_id' },
     *   );
     * ```
     */
    get(datasetId, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/cloudforce-one/events/dataset/${datasetId}/health`, options);
    }
}
exports.Health = Health;
//# sourceMappingURL=health.js.map