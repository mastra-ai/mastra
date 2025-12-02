// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
export class EventNotifications extends APIResource {
    /**
     * Create event notification rule.
     *
     * @example
     * ```ts
     * const eventNotification =
     *   await client.r2.buckets.eventNotifications.update(
     *     'example-bucket',
     *     'queue_id',
     *     { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    update(bucketName, queueId, params, options) {
        const { account_id, jurisdiction, ...body } = params;
        return this._client.put(`/accounts/${account_id}/event_notifications/r2/${bucketName}/configuration/queues/${queueId}`, {
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
     * List all event notification rules for a bucket.
     *
     * @example
     * ```ts
     * const eventNotifications =
     *   await client.r2.buckets.eventNotifications.list(
     *     'example-bucket',
     *     { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    list(bucketName, params, options) {
        const { account_id, jurisdiction } = params;
        return this._client.get(`/accounts/${account_id}/event_notifications/r2/${bucketName}/configuration`, {
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
     * Delete an event notification rule. **If no body is provided, all rules for
     * specified queue will be deleted**.
     *
     * @example
     * ```ts
     * const eventNotification =
     *   await client.r2.buckets.eventNotifications.delete(
     *     'example-bucket',
     *     'queue_id',
     *     { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    delete(bucketName, queueId, params, options) {
        const { account_id, jurisdiction } = params;
        return this._client.delete(`/accounts/${account_id}/event_notifications/r2/${bucketName}/configuration/queues/${queueId}`, {
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
     * Get a single event notification rule.
     *
     * @example
     * ```ts
     * const eventNotification =
     *   await client.r2.buckets.eventNotifications.get(
     *     'example-bucket',
     *     'queue_id',
     *     { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    get(bucketName, queueId, params, options) {
        const { account_id, jurisdiction } = params;
        return this._client.get(`/accounts/${account_id}/event_notifications/r2/${bucketName}/configuration/queues/${queueId}`, {
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
//# sourceMappingURL=event-notifications.mjs.map