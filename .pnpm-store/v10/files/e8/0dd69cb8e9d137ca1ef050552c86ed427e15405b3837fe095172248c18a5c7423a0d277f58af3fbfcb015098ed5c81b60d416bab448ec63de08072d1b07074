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
exports.Buckets = void 0;
const resource_1 = require("../../../resource.js");
const CORSAPI = __importStar(require("./cors.js"));
const cors_1 = require("./cors.js");
const EventNotificationsAPI = __importStar(require("./event-notifications.js"));
const event_notifications_1 = require("./event-notifications.js");
const LifecycleAPI = __importStar(require("./lifecycle.js"));
const lifecycle_1 = require("./lifecycle.js");
const LocksAPI = __importStar(require("./locks.js"));
const locks_1 = require("./locks.js");
const MetricsAPI = __importStar(require("./metrics.js"));
const metrics_1 = require("./metrics.js");
const SippyAPI = __importStar(require("./sippy.js"));
const sippy_1 = require("./sippy.js");
const DomainsAPI = __importStar(require("./domains/domains.js"));
const domains_1 = require("./domains/domains.js");
class Buckets extends resource_1.APIResource {
    constructor() {
        super(...arguments);
        this.lifecycle = new LifecycleAPI.Lifecycle(this._client);
        this.cors = new CORSAPI.CORS(this._client);
        this.domains = new DomainsAPI.Domains(this._client);
        this.eventNotifications = new EventNotificationsAPI.EventNotifications(this._client);
        this.locks = new LocksAPI.Locks(this._client);
        this.metrics = new MetricsAPI.Metrics(this._client);
        this.sippy = new SippyAPI.SippyResource(this._client);
    }
    /**
     * Creates a new R2 bucket.
     *
     * @example
     * ```ts
     * const bucket = await client.r2.buckets.create({
     *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *   name: 'example-bucket',
     * });
     * ```
     */
    create(params, options) {
        const { account_id, jurisdiction, ...body } = params;
        return this._client.post(`/accounts/${account_id}/r2/buckets`, {
            body,
            ...options,
            headers: {
                ...(jurisdiction?.toString() != null ?
                    { 'cf-r2-jurisdiction': jurisdiction?.toString() }
                    : undefined),
                ...options?.headers,
            },
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Lists all R2 buckets on your account.
     *
     * @example
     * ```ts
     * const buckets = await client.r2.buckets.list({
     *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * });
     * ```
     */
    list(params, options) {
        const { account_id, jurisdiction, ...query } = params;
        return this._client.get(`/accounts/${account_id}/r2/buckets`, {
            query,
            ...options,
            headers: {
                ...(jurisdiction?.toString() != null ?
                    { 'cf-r2-jurisdiction': jurisdiction?.toString() }
                    : undefined),
                ...options?.headers,
            },
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Deletes an existing R2 bucket.
     *
     * @example
     * ```ts
     * const bucket = await client.r2.buckets.delete(
     *   'example-bucket',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    delete(bucketName, params, options) {
        const { account_id, jurisdiction } = params;
        return this._client.delete(`/accounts/${account_id}/r2/buckets/${bucketName}`, {
            ...options,
            headers: {
                ...(jurisdiction?.toString() != null ?
                    { 'cf-r2-jurisdiction': jurisdiction?.toString() }
                    : undefined),
                ...options?.headers,
            },
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Updates properties of an existing R2 bucket.
     *
     * @example
     * ```ts
     * const bucket = await client.r2.buckets.edit(
     *   'example-bucket',
     *   {
     *     account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *     storage_class: 'Standard',
     *   },
     * );
     * ```
     */
    edit(bucketName, params, options) {
        const { account_id, storage_class, jurisdiction } = params;
        return this._client.patch(`/accounts/${account_id}/r2/buckets/${bucketName}`, {
            ...options,
            headers: {
                'cf-r2-storage-class': storage_class.toString(),
                ...(jurisdiction?.toString() != null ?
                    { 'cf-r2-jurisdiction': jurisdiction?.toString() }
                    : undefined),
                ...options?.headers,
            },
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Gets properties of an existing R2 bucket.
     *
     * @example
     * ```ts
     * const bucket = await client.r2.buckets.get(
     *   'example-bucket',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    get(bucketName, params, options) {
        const { account_id, jurisdiction } = params;
        return this._client.get(`/accounts/${account_id}/r2/buckets/${bucketName}`, {
            ...options,
            headers: {
                ...(jurisdiction?.toString() != null ?
                    { 'cf-r2-jurisdiction': jurisdiction?.toString() }
                    : undefined),
                ...options?.headers,
            },
        })._thenUnwrap((obj) => obj.result);
    }
}
exports.Buckets = Buckets;
Buckets.Lifecycle = lifecycle_1.Lifecycle;
Buckets.CORS = cors_1.CORS;
Buckets.Domains = domains_1.Domains;
Buckets.EventNotifications = event_notifications_1.EventNotifications;
Buckets.Locks = locks_1.Locks;
Buckets.Metrics = metrics_1.Metrics;
Buckets.SippyResource = sippy_1.SippyResource;
//# sourceMappingURL=buckets.js.map