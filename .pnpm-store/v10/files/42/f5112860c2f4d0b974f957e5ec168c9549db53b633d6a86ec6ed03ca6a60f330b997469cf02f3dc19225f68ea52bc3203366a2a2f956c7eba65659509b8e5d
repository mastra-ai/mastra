"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConsumersSinglePage = exports.Consumers = void 0;
const resource_1 = require("../../resource.js");
const pagination_1 = require("../../pagination.js");
class Consumers extends resource_1.APIResource {
    /**
     * Creates a new consumer for a Queue
     *
     * @example
     * ```ts
     * const consumer = await client.queues.consumers.create(
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    create(queueId, params, options) {
        const { account_id, ...body } = params;
        return this._client.post(`/accounts/${account_id}/queues/${queueId}/consumers`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Updates the consumer for a queue, or creates one if it does not exist.
     *
     * @example
     * ```ts
     * const consumer = await client.queues.consumers.update(
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    update(queueId, consumerId, params, options) {
        const { account_id, ...body } = params;
        return this._client.put(`/accounts/${account_id}/queues/${queueId}/consumers/${consumerId}`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Deletes the consumer for a queue.
     *
     * @example
     * ```ts
     * const consumer = await client.queues.consumers.delete(
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    delete(queueId, consumerId, params, options) {
        const { account_id } = params;
        return this._client.delete(`/accounts/${account_id}/queues/${queueId}/consumers/${consumerId}`, options);
    }
    /**
     * Returns the consumers for a Queue
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const consumer of client.queues.consumers.get(
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * )) {
     *   // ...
     * }
     * ```
     */
    get(queueId, params, options) {
        const { account_id } = params;
        return this._client.getAPIList(`/accounts/${account_id}/queues/${queueId}/consumers`, ConsumersSinglePage, options);
    }
}
exports.Consumers = Consumers;
class ConsumersSinglePage extends pagination_1.SinglePage {
}
exports.ConsumersSinglePage = ConsumersSinglePage;
Consumers.ConsumersSinglePage = ConsumersSinglePage;
//# sourceMappingURL=consumers.js.map