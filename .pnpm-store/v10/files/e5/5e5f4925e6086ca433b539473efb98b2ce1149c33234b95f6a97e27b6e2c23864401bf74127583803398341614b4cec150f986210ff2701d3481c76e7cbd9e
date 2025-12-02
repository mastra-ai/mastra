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
exports.QueuesSinglePage = exports.Queues = void 0;
const resource_1 = require("../../resource.js");
const ConsumersAPI = __importStar(require("./consumers.js"));
const consumers_1 = require("./consumers.js");
const MessagesAPI = __importStar(require("./messages.js"));
const messages_1 = require("./messages.js");
const PurgeAPI = __importStar(require("./purge.js"));
const purge_1 = require("./purge.js");
const pagination_1 = require("../../pagination.js");
class Queues extends resource_1.APIResource {
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
exports.Queues = Queues;
class QueuesSinglePage extends pagination_1.SinglePage {
}
exports.QueuesSinglePage = QueuesSinglePage;
Queues.QueuesSinglePage = QueuesSinglePage;
Queues.Consumers = consumers_1.Consumers;
Queues.ConsumersSinglePage = consumers_1.ConsumersSinglePage;
Queues.Messages = messages_1.Messages;
Queues.Purge = purge_1.Purge;
//# sourceMappingURL=queues.js.map