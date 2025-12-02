// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../resource.mjs";
export class Token extends APIResource {
    /**
     * Creates a signed URL token for a video. If a body is not provided in the
     * request, a token is created with default values.
     *
     * @example
     * ```ts
     * const token = await client.stream.token.create(
     *   'ea95132c15732412d22c1476fa83f27a',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    create(identifier, params, options) {
        const { account_id, ...body } = params;
        return this._client.post(`/accounts/${account_id}/stream/${identifier}/token`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
}
//# sourceMappingURL=token.mjs.map