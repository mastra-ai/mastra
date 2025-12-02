"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Deployments = void 0;
const resource_1 = require("../../../resource.js");
class Deployments extends resource_1.APIResource {
    /**
     * Deployments configure how
     * [Worker Versions](https://developers.cloudflare.com/api/operations/worker-versions-list-versions)
     * are deployed to traffic. A deployment can consist of one or two versions of a
     * Worker.
     *
     * @example
     * ```ts
     * const deployment =
     *   await client.workers.scripts.deployments.create(
     *     'this-is_my_script-01',
     *     {
     *       account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *       strategy: 'percentage',
     *       versions: [
     *         {
     *           percentage: 100,
     *           version_id:
     *             'bcf48806-b317-4351-9ee7-36e7d557d4de',
     *         },
     *       ],
     *     },
     *   );
     * ```
     */
    create(scriptName, params, options) {
        const { account_id, force, ...body } = params;
        return this._client.post(`/accounts/${account_id}/workers/scripts/${scriptName}/deployments`, {
            query: { force },
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * List of Worker Deployments. The first deployment in the list is the latest
     * deployment actively serving traffic.
     *
     * @example
     * ```ts
     * const deployment =
     *   await client.workers.scripts.deployments.get(
     *     'this-is_my_script-01',
     *     { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    get(scriptName, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/workers/scripts/${scriptName}/deployments`, options)._thenUnwrap((obj) => obj.result);
    }
}
exports.Deployments = Deployments;
//# sourceMappingURL=deployments.js.map