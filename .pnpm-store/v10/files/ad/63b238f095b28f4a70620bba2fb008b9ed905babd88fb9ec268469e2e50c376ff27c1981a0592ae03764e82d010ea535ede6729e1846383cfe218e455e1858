"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Logs = void 0;
const resource_1 = require("../../../../../resource.js");
class Logs extends resource_1.APIResource {
    /**
     * Fetch deployment logs for a project.
     *
     * @example
     * ```ts
     * const log =
     *   await client.pages.projects.deployments.history.logs.get(
     *     'this-is-my-project-01',
     *     '023e105f4ecef8ad9ca31a8372d0c353',
     *     { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    get(projectName, deploymentId, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/pages/projects/${projectName}/deployments/${deploymentId}/history/logs`, options)._thenUnwrap((obj) => obj.result);
    }
}
exports.Logs = Logs;
//# sourceMappingURL=logs.js.map