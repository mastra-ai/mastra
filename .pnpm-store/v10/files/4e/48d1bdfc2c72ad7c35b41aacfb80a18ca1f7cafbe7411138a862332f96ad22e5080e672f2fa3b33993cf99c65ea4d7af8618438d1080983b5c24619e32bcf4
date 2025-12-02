// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../../resource.mjs";
import * as HealthAPI from "./health.mjs";
import { Health } from "./health.mjs";
export class Datasets extends APIResource {
    constructor() {
        super(...arguments);
        this.health = new HealthAPI.Health(this._client);
    }
    /**
     * Creates a dataset
     *
     * @example
     * ```ts
     * const dataset =
     *   await client.cloudforceOne.threatEvents.datasets.create({
     *     account_id: 'account_id',
     *     isPublic: true,
     *     name: 'x',
     *   });
     * ```
     */
    create(params, options) {
        const { account_id, ...body } = params;
        return this._client.post(`/accounts/${account_id}/cloudforce-one/events/dataset/create`, {
            body,
            ...options,
        });
    }
    /**
     * Lists all datasets in an account
     *
     * @example
     * ```ts
     * const datasets =
     *   await client.cloudforceOne.threatEvents.datasets.list({
     *     account_id: 'account_id',
     *   });
     * ```
     */
    list(params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/cloudforce-one/events/dataset`, options);
    }
    /**
     * Updates an existing dataset
     *
     * @example
     * ```ts
     * const response =
     *   await client.cloudforceOne.threatEvents.datasets.edit(
     *     '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
     *     { account_id: 'account_id', isPublic: true, name: 'x' },
     *   );
     * ```
     */
    edit(datasetId, params, options) {
        const { account_id, ...body } = params;
        return this._client.patch(`/accounts/${account_id}/cloudforce-one/events/dataset/${datasetId}`, {
            body,
            ...options,
        });
    }
    /**
     * Reads a dataset
     *
     * @example
     * ```ts
     * const dataset =
     *   await client.cloudforceOne.threatEvents.datasets.get(
     *     '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
     *     { account_id: 'account_id' },
     *   );
     * ```
     */
    get(datasetId, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/cloudforce-one/events/dataset/${datasetId}`, options);
    }
    /**
     * Reads data for a raw event
     *
     * @example
     * ```ts
     * const response =
     *   await client.cloudforceOne.threatEvents.datasets.raw(
     *     'dataset_id',
     *     'event_id',
     *     { account_id: 'account_id' },
     *   );
     * ```
     */
    raw(datasetId, eventId, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/cloudforce-one/events/raw/${datasetId}/${eventId}`, options);
    }
}
Datasets.Health = Health;
//# sourceMappingURL=datasets.mjs.map