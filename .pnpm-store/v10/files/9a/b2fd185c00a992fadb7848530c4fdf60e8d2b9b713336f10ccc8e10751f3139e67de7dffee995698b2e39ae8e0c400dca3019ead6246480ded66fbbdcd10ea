// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
import * as PreviewsAPI from "./previews.mjs";
import { Previews } from "./previews.mjs";
import * as ReferencesAPI from "./references.mjs";
import { ReferenceGetResponsesSinglePage, References, } from "./references.mjs";
import { SinglePage } from "../../../pagination.mjs";
export class Monitors extends APIResource {
    constructor() {
        super(...arguments);
        this.previews = new PreviewsAPI.Previews(this._client);
        this.references = new ReferencesAPI.References(this._client);
    }
    /**
     * Create a configured monitor.
     *
     * @example
     * ```ts
     * const monitor = await client.loadBalancers.monitors.create({
     *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * });
     * ```
     */
    create(params, options) {
        const { account_id, ...body } = params;
        return this._client.post(`/accounts/${account_id}/load_balancers/monitors`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Modify a configured monitor.
     *
     * @example
     * ```ts
     * const monitor = await client.loadBalancers.monitors.update(
     *   'f1aba936b94213e5b8dca0c0dbf1f9cc',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    update(monitorId, params, options) {
        const { account_id, ...body } = params;
        return this._client.put(`/accounts/${account_id}/load_balancers/monitors/${monitorId}`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * List configured monitors for an account.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const monitor of client.loadBalancers.monitors.list(
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(params, options) {
        const { account_id } = params;
        return this._client.getAPIList(`/accounts/${account_id}/load_balancers/monitors`, MonitorsSinglePage, options);
    }
    /**
     * Delete a configured monitor.
     *
     * @example
     * ```ts
     * const monitor = await client.loadBalancers.monitors.delete(
     *   'f1aba936b94213e5b8dca0c0dbf1f9cc',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    delete(monitorId, params, options) {
        const { account_id } = params;
        return this._client.delete(`/accounts/${account_id}/load_balancers/monitors/${monitorId}`, options)._thenUnwrap((obj) => obj.result);
    }
    /**
     * Apply changes to an existing monitor, overwriting the supplied properties.
     *
     * @example
     * ```ts
     * const monitor = await client.loadBalancers.monitors.edit(
     *   'f1aba936b94213e5b8dca0c0dbf1f9cc',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    edit(monitorId, params, options) {
        const { account_id, ...body } = params;
        return this._client.patch(`/accounts/${account_id}/load_balancers/monitors/${monitorId}`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * List a single configured monitor for an account.
     *
     * @example
     * ```ts
     * const monitor = await client.loadBalancers.monitors.get(
     *   'f1aba936b94213e5b8dca0c0dbf1f9cc',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    get(monitorId, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/load_balancers/monitors/${monitorId}`, options)._thenUnwrap((obj) => obj.result);
    }
}
export class MonitorsSinglePage extends SinglePage {
}
Monitors.MonitorsSinglePage = MonitorsSinglePage;
Monitors.Previews = Previews;
Monitors.References = References;
Monitors.ReferenceGetResponsesSinglePage = ReferenceGetResponsesSinglePage;
//# sourceMappingURL=monitors.mjs.map