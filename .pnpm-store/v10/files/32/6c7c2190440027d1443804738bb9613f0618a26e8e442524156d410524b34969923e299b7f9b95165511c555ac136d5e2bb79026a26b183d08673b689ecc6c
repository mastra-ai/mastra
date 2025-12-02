// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
export class Value extends APIResource {
    /**
     * Roll the token secret.
     *
     * @example
     * ```ts
     * const tokenValue = await client.user.tokens.value.update(
     *   'ed17574386854bf78a67040be0a770b0',
     *   {},
     * );
     * ```
     */
    update(tokenId, body, options) {
        return this._client.put(`/user/tokens/${tokenId}/value`, { body, ...options })._thenUnwrap((obj) => obj.result);
    }
}
//# sourceMappingURL=value.mjs.map