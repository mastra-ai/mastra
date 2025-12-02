"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Value = void 0;
const resource_1 = require("../../../resource.js");
class Value extends resource_1.APIResource {
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
exports.Value = Value;
//# sourceMappingURL=value.js.map