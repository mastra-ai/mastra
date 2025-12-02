"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Datasets = void 0;
const resource_1 = require("../../../../resource.js");
const HealthAPI = __importStar(require("./health.js"));
const health_1 = require("./health.js");
class Datasets extends resource_1.APIResource {
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
exports.Datasets = Datasets;
Datasets.Health = health_1.Health;
//# sourceMappingURL=datasets.js.map