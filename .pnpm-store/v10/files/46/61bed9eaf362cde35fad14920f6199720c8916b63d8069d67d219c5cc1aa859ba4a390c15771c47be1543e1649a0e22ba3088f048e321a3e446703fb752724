// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../resource.mjs";
export class Purge extends APIResource {
    /**
     * Deletes all messages from the Queue.
     *
     * @example
     * ```ts
     * const queue = await client.queues.purge.start(
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    start(queueId, params, options) {
        const { account_id, ...body } = params;
        return this._client.post(`/accounts/${account_id}/queues/${queueId}/purge`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Get details about a Queue's purge status.
     *
     * @example
     * ```ts
     * const response = await client.queues.purge.status(
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    status(queueId, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/queues/${queueId}/purge`, options)._thenUnwrap((obj) => obj.result);
    }
}
//# sourceMappingURL=purge.mjs.map