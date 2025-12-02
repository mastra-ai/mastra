// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../../../resource.mjs";
import * as Core from "../../../../../core.mjs";
export class Content extends APIResource {
    /**
     * Put script content for a script uploaded to a Workers for Platforms namespace.
     *
     * @example
     * ```ts
     * const script =
     *   await client.workersForPlatforms.dispatch.namespaces.scripts.content.update(
     *     'my-dispatch-namespace',
     *     'this-is_my_script-01',
     *     {
     *       account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *       metadata: {},
     *     },
     *   );
     * ```
     */
    update(dispatchNamespace, scriptName, params, options) {
        const { account_id, 'CF-WORKER-BODY-PART': cfWorkerBodyPart, 'CF-WORKER-MAIN-MODULE-PART': cfWorkerMainModulePart, ...body } = params;
        return this._client.put(`/accounts/${account_id}/workers/dispatch/namespaces/${dispatchNamespace}/scripts/${scriptName}/content`, Core.multipartFormRequestOptions({
            body,
            ...options,
            headers: {
                ...(cfWorkerBodyPart != null ? { 'CF-WORKER-BODY-PART': cfWorkerBodyPart } : undefined),
                ...(cfWorkerMainModulePart != null ?
                    { 'CF-WORKER-MAIN-MODULE-PART': cfWorkerMainModulePart }
                    : undefined),
                ...options?.headers,
            },
        }))._thenUnwrap((obj) => obj.result);
    }
    /**
     * Fetch script content from a script uploaded to a Workers for Platforms
     * namespace.
     *
     * @example
     * ```ts
     * const content =
     *   await client.workersForPlatforms.dispatch.namespaces.scripts.content.get(
     *     'my-dispatch-namespace',
     *     'this-is_my_script-01',
     *     { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     *
     * const data = await content.blob();
     * console.log(data);
     * ```
     */
    get(dispatchNamespace, scriptName, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/workers/dispatch/namespaces/${dispatchNamespace}/scripts/${scriptName}/content`, { ...options, headers: { Accept: 'string', ...options?.headers }, __binaryResponse: true });
    }
}
//# sourceMappingURL=content.mjs.map