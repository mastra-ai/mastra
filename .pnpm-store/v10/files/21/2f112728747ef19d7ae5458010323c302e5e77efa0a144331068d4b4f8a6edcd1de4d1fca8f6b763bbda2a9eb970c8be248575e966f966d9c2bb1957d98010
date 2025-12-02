// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../resource.mjs";
export class Responses extends APIResource {
    /**
     * Returns the raw response of the network request. Find the `response_id` in the
     * `data.requests.response.hash`.
     *
     * @example
     * ```ts
     * const response = await client.urlScanner.responses.get(
     *   'response_id',
     *   { account_id: 'account_id' },
     * );
     * ```
     */
    get(responseId, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/urlscanner/v2/responses/${responseId}`, {
            ...options,
            headers: { Accept: 'text/plain', ...options?.headers },
        });
    }
}
//# sourceMappingURL=responses.mjs.map