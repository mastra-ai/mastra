// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
import * as CORSAPI from "./cors.mjs";
import { CORS, } from "./cors.mjs";
import * as EventNotificationsAPI from "./event-notifications.mjs";
import { EventNotifications, } from "./event-notifications.mjs";
import * as LifecycleAPI from "./lifecycle.mjs";
import { Lifecycle, } from "./lifecycle.mjs";
import * as LocksAPI from "./locks.mjs";
import { Locks } from "./locks.mjs";
import * as MetricsAPI from "./metrics.mjs";
import { Metrics } from "./metrics.mjs";
import * as SippyAPI from "./sippy.mjs";
import { SippyResource, } from "./sippy.mjs";
import * as DomainsAPI from "./domains/domains.mjs";
import { Domains } from "./domains/domains.mjs";
export class Buckets extends APIResource {
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
Buckets.Lifecycle = Lifecycle;
Buckets.CORS = CORS;
Buckets.Domains = Domains;
Buckets.EventNotifications = EventNotifications;
Buckets.Locks = Locks;
Buckets.Metrics = Metrics;
Buckets.SippyResource = SippyResource;
//# sourceMappingURL=buckets.mjs.map