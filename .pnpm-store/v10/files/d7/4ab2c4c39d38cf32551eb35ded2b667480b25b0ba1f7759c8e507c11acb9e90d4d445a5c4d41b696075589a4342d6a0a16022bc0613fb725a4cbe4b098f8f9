"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Tags = void 0;
const resource_1 = require("../../../resource.js");
class Tags extends resource_1.APIResource {
    /**
     * Creates a new tag
     *
     * @example
     * ```ts
     * const tag =
     *   await client.cloudforceOne.threatEvents.tags.create({
     *     account_id: 'account_id',
     *     name: 'name',
     *   });
     * ```
     */
    create(params, options) {
        const { account_id, ...body } = params;
        return this._client.post(`/accounts/${account_id}/cloudforce-one/events/tags/create`, {
            body,
            ...options,
        });
    }
}
exports.Tags = Tags;
//# sourceMappingURL=tags.js.map