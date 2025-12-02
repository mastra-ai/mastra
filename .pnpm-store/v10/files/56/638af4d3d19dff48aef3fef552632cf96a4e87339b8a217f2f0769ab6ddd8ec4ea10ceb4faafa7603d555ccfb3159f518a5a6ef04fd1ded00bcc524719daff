// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../resource.mjs";
import * as ConsumersAPI from "./consumers.mjs";
import { Consumers, ConsumersSinglePage, } from "./consumers.mjs";
import * as MessagesAPI from "./messages.mjs";
import { Messages, } from "./messages.mjs";
import * as PurgeAPI from "./purge.mjs";
import { Purge } from "./purge.mjs";
import { SinglePage } from "../../pagination.mjs";
export class Queues extends APIResource {
    constructor() {
        super(...arguments);
        this.consumers = new ConsumersAPI.Consumers(this._client);
        this.messages = new MessagesAPI.Messages(this._client);
        this.purge = new PurgeAPI.Purge(this._client);
    }
    /**
     * Create a new queue
     *
     * @example
     * ```ts
     * const queue = await client.queues.create({
     *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *   queue_name: 'example-queue',
     * });
     * ```
     */
    create(params, options) {
        const { account_id, ...body } = params;
        return this._client.post(`/accounts/${account_id}/queues`, { body, ...options })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Updates a Queue. Note that this endpoint does not support partial updates. If
     * successful, the Queue's configuration is overwritten with the supplied
     * configuration.
     *
     * @example
     * ```ts
     * const queue = await client.queues.update(
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    update(queueId, params, options) {
        const { account_id, ...body } = params;
        return this._client.put(`/accounts/${account_id}/queues/${queueId}`, { body, ...options })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Returns the queues owned by an account.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const queue of client.queues.list({
     *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * })) {
     *   // ...
     * }
     * ```
     */
    list(params, options) {
        const { account_id } = params;
        return this._client.getAPIList(`/accounts/${account_id}/queues`, QueuesSinglePage, options);
    }
    /**
     * Deletes a queue
     *
     * @example
     * ```ts
     * const queue = await client.queues.delete(
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    delete(queueId, params, options) {
        const { account_id } = params;
        return this._client.delete(`/accounts/${account_id}/queues/${queueId}`, options);
    }
    /**
     * Updates a Queue.
     *
     * @example
     * ```ts
     * const queue = await client.queues.edit(
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    edit(queueId, params, options) {
        const { account_id, ...body } = params;
        return this._client.patch(`/accounts/${account_id}/queues/${queueId}`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Get details about a specific queue.
     *
     * @example
     * ```ts
     * const queue = await client.queues.get(
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    get(queueId, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/queues/${queueId}`, options)._thenUnwrap((obj) => obj.result);
    }
}
export class QueuesSinglePage extends SinglePage {
}
Queues.QueuesSinglePage = QueuesSinglePage;
Queues.Consumers = Consumers;
Queues.ConsumersSinglePage = ConsumersSinglePage;
Queues.Messages = Messages;
Queues.Purge = Purge;
//# sourceMappingURL=queues.mjs.map