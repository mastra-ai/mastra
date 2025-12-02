"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Messages = void 0;
const resource_1 = require("../../resource.js");
class Messages extends resource_1.APIResource {
    /**
     * Acknowledge + Retry messages from a Queue
     *
     * @example
     * ```ts
     * const response = await client.queues.messages.ack(
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    ack(queueId, params, options) {
        const { account_id, ...body } = params;
        return this._client.post(`/accounts/${account_id}/queues/${queueId}/messages/ack`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Push a batch of message to a Queue
     *
     * @example
     * ```ts
     * const response = await client.queues.messages.bulkPush(
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    bulkPush(queueId, params, options) {
        const { account_id, ...body } = params;
        return this._client.post(`/accounts/${account_id}/queues/${queueId}/messages/batch`, {
            body,
            ...options,
        });
    }
    /**
     * Pull a batch of messages from a Queue
     *
     * @example
     * ```ts
     * const response = await client.queues.messages.pull(
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    pull(queueId, params, options) {
        const { account_id, ...body } = params;
        return this._client.post(`/accounts/${account_id}/queues/${queueId}/messages/pull`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Push a message to a Queue
     *
     * @example
     * ```ts
     * const response = await client.queues.messages.push(
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    push(queueId, params, options) {
        const { account_id, ...body } = params;
        return this._client.post(`/accounts/${account_id}/queues/${queueId}/messages`, { body, ...options });
    }
}
exports.Messages = Messages;
//# sourceMappingURL=messages.js.map