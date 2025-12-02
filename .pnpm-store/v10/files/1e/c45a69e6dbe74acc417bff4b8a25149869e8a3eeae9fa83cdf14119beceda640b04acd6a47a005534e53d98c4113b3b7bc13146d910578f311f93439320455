"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Traces = void 0;
const resource_1 = require("../../resource.js");
class Traces extends resource_1.APIResource {
    /**
     * Request Trace
     *
     * @example
     * ```ts
     * const trace = await client.requestTracers.traces.create({
     *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *   method: 'PUT',
     *   url: 'https://some.zone/some_path',
     *   body: { base64: 'c29tZV9yZXF1ZXN0X2JvZHk=' },
     *   context: {
     *     geoloc: { city: 'London' },
     *     skip_challenge: true,
     *   },
     *   cookies: {
     *     cookie_name_1: 'cookie_value_1',
     *     cookie_name_2: 'cookie_value_2',
     *   },
     *   headers: {
     *     header_name_1: 'header_value_1',
     *     header_name_2: 'header_value_2',
     *   },
     *   protocol: 'HTTP/1.1',
     * });
     * ```
     */
    create(params, options) {
        const { account_id, ...body } = params;
        return this._client.post(`/accounts/${account_id}/request-tracer/trace`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
}
exports.Traces = Traces;
//# sourceMappingURL=traces.js.map