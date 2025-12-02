"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.TelemetryValuesResponsesSinglePage = exports.TelemetryKeysResponsesSinglePage = exports.Telemetry = void 0;
const resource_1 = require("../../../resource.js");
const pagination_1 = require("../../../pagination.js");
class Telemetry extends resource_1.APIResource {
    /**
     * List all the keys in your telemetry events.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const telemetryKeysResponse of client.workers.observability.telemetry.keys(
     *   { account_id: 'account_id' },
     * )) {
     *   // ...
     * }
     * ```
     */
    keys(params, options) {
        const { account_id, ...body } = params;
        return this._client.getAPIList(`/accounts/${account_id}/workers/observability/telemetry/keys`, TelemetryKeysResponsesSinglePage, { body, method: 'post', ...options });
    }
    /**
     * Runs a temporary or saved query
     *
     * @example
     * ```ts
     * const response =
     *   await client.workers.observability.telemetry.query({
     *     account_id: 'account_id',
     *     queryId: 'queryId',
     *     timeframe: { from: 0, to: 0 },
     *   });
     * ```
     */
    query(params, options) {
        const { account_id, ...body } = params;
        return this._client.post(`/accounts/${account_id}/workers/observability/telemetry/query`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * List unique values found in your events
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const telemetryValuesResponse of client.workers.observability.telemetry.values(
     *   {
     *     account_id: 'account_id',
     *     datasets: ['string'],
     *     key: 'key',
     *     timeframe: { from: 0, to: 0 },
     *     type: 'string',
     *   },
     * )) {
     *   // ...
     * }
     * ```
     */
    values(params, options) {
        const { account_id, ...body } = params;
        return this._client.getAPIList(`/accounts/${account_id}/workers/observability/telemetry/values`, TelemetryValuesResponsesSinglePage, { body, method: 'post', ...options });
    }
}
exports.Telemetry = Telemetry;
class TelemetryKeysResponsesSinglePage extends pagination_1.SinglePage {
}
exports.TelemetryKeysResponsesSinglePage = TelemetryKeysResponsesSinglePage;
class TelemetryValuesResponsesSinglePage extends pagination_1.SinglePage {
}
exports.TelemetryValuesResponsesSinglePage = TelemetryValuesResponsesSinglePage;
Telemetry.TelemetryKeysResponsesSinglePage = TelemetryKeysResponsesSinglePage;
Telemetry.TelemetryValuesResponsesSinglePage = TelemetryValuesResponsesSinglePage;
//# sourceMappingURL=telemetry.js.map