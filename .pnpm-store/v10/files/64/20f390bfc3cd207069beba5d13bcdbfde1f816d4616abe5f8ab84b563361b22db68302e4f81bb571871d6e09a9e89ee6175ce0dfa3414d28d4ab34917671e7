// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../../../resource.mjs";
import { SinglePage } from "../../../../../pagination.mjs";
export class Tags extends APIResource {
    /**
     * Put script tags for a script uploaded to a Workers for Platforms namespace.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const tagUpdateResponse of client.workersForPlatforms.dispatch.namespaces.scripts.tags.update(
     *   'my-dispatch-namespace',
     *   'this-is_my_script-01',
     *   {
     *     account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *     body: ['my-tag'],
     *   },
     * )) {
     *   // ...
     * }
     * ```
     */
    update(dispatchNamespace, scriptName, params, options) {
        const { account_id, body } = params;
        return this._client.getAPIList(`/accounts/${account_id}/workers/dispatch/namespaces/${dispatchNamespace}/scripts/${scriptName}/tags`, TagUpdateResponsesSinglePage, { body: body, method: 'put', ...options });
    }
    /**
     * Fetch tags from a script uploaded to a Workers for Platforms namespace.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const tagListResponse of client.workersForPlatforms.dispatch.namespaces.scripts.tags.list(
     *   'my-dispatch-namespace',
     *   'this-is_my_script-01',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(dispatchNamespace, scriptName, params, options) {
        const { account_id } = params;
        return this._client.getAPIList(`/accounts/${account_id}/workers/dispatch/namespaces/${dispatchNamespace}/scripts/${scriptName}/tags`, TagListResponsesSinglePage, options);
    }
    /**
     * Delete script tag for a script uploaded to a Workers for Platforms namespace.
     *
     * @example
     * ```ts
     * const tag =
     *   await client.workersForPlatforms.dispatch.namespaces.scripts.tags.delete(
     *     'my-dispatch-namespace',
     *     'this-is_my_script-01',
     *     'my-tag',
     *     { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    delete(dispatchNamespace, scriptName, tag, params, options) {
        const { account_id } = params;
        return this._client.delete(`/accounts/${account_id}/workers/dispatch/namespaces/${dispatchNamespace}/scripts/${scriptName}/tags/${tag}`, options)._thenUnwrap((obj) => obj.result);
    }
}
export class TagUpdateResponsesSinglePage extends SinglePage {
}
export class TagListResponsesSinglePage extends SinglePage {
}
Tags.TagUpdateResponsesSinglePage = TagUpdateResponsesSinglePage;
Tags.TagListResponsesSinglePage = TagListResponsesSinglePage;
//# sourceMappingURL=tags.mjs.map