import { APIResource } from "../../resource.js";
import * as Core from "../../core.js";
import * as Shared from "../shared.js";
import * as ConsumersAPI from "./consumers.js";
import { Consumer, ConsumerCreateParams, ConsumerDeleteParams, ConsumerDeleteResponse, ConsumerGetParams, ConsumerUpdateParams, Consumers, ConsumersSinglePage } from "./consumers.js";
import * as MessagesAPI from "./messages.js";
import { MessageAckParams, MessageAckResponse, MessageBulkPushParams, MessageBulkPushResponse, MessagePullParams, MessagePullResponse, MessagePushParams, MessagePushResponse, Messages } from "./messages.js";
import * as PurgeAPI from "./purge.js";
import { Purge, PurgeStartParams, PurgeStatusParams, PurgeStatusResponse } from "./purge.js";
import { SinglePage } from "../../pagination.js";
export declare class Queues extends APIResource {
    consumers: ConsumersAPI.Consumers;
    messages: MessagesAPI.Messages;
    purge: PurgeAPI.Purge;
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
    create(params: QueueCreateParams, options?: Core.RequestOptions): Core.APIPromise<Queue>;
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
    update(queueId: string, params: QueueUpdateParams, options?: Core.RequestOptions): Core.APIPromise<Queue>;
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
    list(params: QueueListParams, options?: Core.RequestOptions): Core.PagePromise<QueuesSinglePage, Queue>;
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
    delete(queueId: string, params: QueueDeleteParams, options?: Core.RequestOptions): Core.APIPromise<QueueDeleteResponse>;
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
    edit(queueId: string, params: QueueEditParams, options?: Core.RequestOptions): Core.APIPromise<Queue>;
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
    get(queueId: string, params: QueueGetParams, options?: Core.RequestOptions): Core.APIPromise<Queue>;
}
export declare class QueuesSinglePage extends SinglePage<Queue> {
}
export interface Queue {
    consumers?: Array<ConsumersAPI.Consumer>;
    consumers_total_count?: number;
    created_on?: string;
    modified_on?: string;
    producers?: Array<Queue.MqWorkerProducer | Queue.MqR2Producer>;
    producers_total_count?: number;
    queue_id?: string;
    queue_name?: string;
    settings?: Queue.Settings;
}
export declare namespace Queue {
    interface MqWorkerProducer {
        script?: string;
        type?: 'worker';
    }
    interface MqR2Producer {
        bucket_name?: string;
        type?: 'r2_bucket';
    }
    interface Settings {
        /**
         * Number of seconds to delay delivery of all messages to consumers.
         */
        delivery_delay?: number;
        /**
         * Indicates if message delivery to consumers is currently paused.
         */
        delivery_paused?: boolean;
        /**
         * Number of seconds after which an unconsumed message will be delayed.
         */
        message_retention_period?: number;
    }
}
export interface QueueDeleteResponse {
    errors?: Array<Shared.ResponseInfo>;
    messages?: Array<string>;
    /**
     * Indicates if the API call was successful or not.
     */
    success?: true;
}
export interface QueueCreateParams {
    /**
     * Path param: A Resource identifier.
     */
    account_id: string;
    /**
     * Body param:
     */
    queue_name: string;
}
export interface QueueUpdateParams {
    /**
     * Path param: A Resource identifier.
     */
    account_id: string;
    /**
     * Body param:
     */
    queue_name?: string;
    /**
     * Body param:
     */
    settings?: QueueUpdateParams.Settings;
}
export declare namespace QueueUpdateParams {
    interface Settings {
        /**
         * Number of seconds to delay delivery of all messages to consumers.
         */
        delivery_delay?: number;
        /**
         * Indicates if message delivery to consumers is currently paused.
         */
        delivery_paused?: boolean;
        /**
         * Number of seconds after which an unconsumed message will be delayed.
         */
        message_retention_period?: number;
    }
}
export interface QueueListParams {
    /**
     * A Resource identifier.
     */
    account_id: string;
}
export interface QueueDeleteParams {
    /**
     * A Resource identifier.
     */
    account_id: string;
}
export interface QueueEditParams {
    /**
     * Path param: A Resource identifier.
     */
    account_id: string;
    /**
     * Body param:
     */
    queue_name?: string;
    /**
     * Body param:
     */
    settings?: QueueEditParams.Settings;
}
export declare namespace QueueEditParams {
    interface Settings {
        /**
         * Number of seconds to delay delivery of all messages to consumers.
         */
        delivery_delay?: number;
        /**
         * Indicates if message delivery to consumers is currently paused.
         */
        delivery_paused?: boolean;
        /**
         * Number of seconds after which an unconsumed message will be delayed.
         */
        message_retention_period?: number;
    }
}
export interface QueueGetParams {
    /**
     * A Resource identifier.
     */
    account_id: string;
}
export declare namespace Queues {
    export { type Queue as Queue, type QueueDeleteResponse as QueueDeleteResponse, QueuesSinglePage as QueuesSinglePage, type QueueCreateParams as QueueCreateParams, type QueueUpdateParams as QueueUpdateParams, type QueueListParams as QueueListParams, type QueueDeleteParams as QueueDeleteParams, type QueueEditParams as QueueEditParams, type QueueGetParams as QueueGetParams, };
    export { Consumers as Consumers, type Consumer as Consumer, type ConsumerDeleteResponse as ConsumerDeleteResponse, ConsumersSinglePage as ConsumersSinglePage, type ConsumerCreateParams as ConsumerCreateParams, type ConsumerUpdateParams as ConsumerUpdateParams, type ConsumerDeleteParams as ConsumerDeleteParams, type ConsumerGetParams as ConsumerGetParams, };
    export { Messages as Messages, type MessageAckResponse as MessageAckResponse, type MessageBulkPushResponse as MessageBulkPushResponse, type MessagePullResponse as MessagePullResponse, type MessagePushResponse as MessagePushResponse, type MessageAckParams as MessageAckParams, type MessageBulkPushParams as MessageBulkPushParams, type MessagePullParams as MessagePullParams, type MessagePushParams as MessagePushParams, };
    export { Purge as Purge, type PurgeStatusResponse as PurgeStatusResponse, type PurgeStartParams as PurgeStartParams, type PurgeStatusParams as PurgeStatusParams, };
}
//# sourceMappingURL=queues.d.ts.map