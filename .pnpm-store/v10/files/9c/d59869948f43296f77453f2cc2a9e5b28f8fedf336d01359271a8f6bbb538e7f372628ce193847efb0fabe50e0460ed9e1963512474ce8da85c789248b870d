// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
export class Tags extends APIResource {
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
//# sourceMappingURL=tags.mjs.map