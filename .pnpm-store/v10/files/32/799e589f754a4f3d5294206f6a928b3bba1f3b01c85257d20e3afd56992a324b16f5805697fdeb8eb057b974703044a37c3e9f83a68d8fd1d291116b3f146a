// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../resource';
import * as Core from '../../core';
import * as Shared from '../shared';

export class Messages extends APIResource {
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
  ack(
    queueId: string,
    params: MessageAckParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<MessageAckResponse> {
    const { account_id, ...body } = params;
    return (
      this._client.post(`/accounts/${account_id}/queues/${queueId}/messages/ack`, {
        body,
        ...options,
      }) as Core.APIPromise<{ result: MessageAckResponse }>
    )._thenUnwrap((obj) => obj.result);
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
  bulkPush(
    queueId: string,
    params: MessageBulkPushParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<MessageBulkPushResponse> {
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
  pull(
    queueId: string,
    params: MessagePullParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<MessagePullResponse> {
    const { account_id, ...body } = params;
    return (
      this._client.post(`/accounts/${account_id}/queues/${queueId}/messages/pull`, {
        body,
        ...options,
      }) as Core.APIPromise<{ result: MessagePullResponse }>
    )._thenUnwrap((obj) => obj.result);
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
  push(
    queueId: string,
    params: MessagePushParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<MessagePushResponse> {
    const { account_id, ...body } = params;
    return this._client.post(`/accounts/${account_id}/queues/${queueId}/messages`, { body, ...options });
  }
}

export interface MessageAckResponse {
  /**
   * The number of messages that were succesfully acknowledged.
   */
  ackCount?: number;

  /**
   * The number of messages that were succesfully retried.
   */
  retryCount?: number;

  warnings?: Array<string>;
}

export interface MessageBulkPushResponse {
  errors?: Array<Shared.ResponseInfo>;

  messages?: Array<string>;

  /**
   * Indicates if the API call was successful or not.
   */
  success?: true;
}

export interface MessagePullResponse {
  /**
   * The number of unacknowledged messages in the queue
   */
  message_backlog_count?: number;

  messages?: Array<MessagePullResponse.Message>;
}

export namespace MessagePullResponse {
  export interface Message {
    id?: string;

    attempts?: number;

    body?: string;

    /**
     * An ID that represents an "in-flight" message that has been pulled from a Queue.
     * You must hold on to this ID and use it to acknowledge this message.
     */
    lease_id?: string;

    metadata?: unknown;

    timestamp_ms?: number;
  }
}

export interface MessagePushResponse {
  errors?: Array<Shared.ResponseInfo>;

  messages?: Array<string>;

  /**
   * Indicates if the API call was successful or not.
   */
  success?: true;
}

export interface MessageAckParams {
  /**
   * Path param: A Resource identifier.
   */
  account_id: string;

  /**
   * Body param:
   */
  acks?: Array<MessageAckParams.Ack>;

  /**
   * Body param:
   */
  retries?: Array<MessageAckParams.Retry>;
}

export namespace MessageAckParams {
  export interface Ack {
    /**
     * An ID that represents an "in-flight" message that has been pulled from a Queue.
     * You must hold on to this ID and use it to acknowledge this message.
     */
    lease_id?: string;
  }

  export interface Retry {
    /**
     * The number of seconds to delay before making the message available for another
     * attempt.
     */
    delay_seconds?: number;

    /**
     * An ID that represents an "in-flight" message that has been pulled from a Queue.
     * You must hold on to this ID and use it to acknowledge this message.
     */
    lease_id?: string;
  }
}

export interface MessageBulkPushParams {
  /**
   * Path param: A Resource identifier.
   */
  account_id: string;

  /**
   * Body param: The number of seconds to wait for attempting to deliver this batch
   * to consumers
   */
  delay_seconds?: number;

  /**
   * Body param:
   */
  messages?: Array<MessageBulkPushParams.MqQueueMessageText | MessageBulkPushParams.MqQueueMessageJson>;
}

export namespace MessageBulkPushParams {
  export interface MqQueueMessageText {
    body?: string;

    content_type?: 'text';

    /**
     * The number of seconds to wait for attempting to deliver this message to
     * consumers
     */
    delay_seconds?: number;
  }

  export interface MqQueueMessageJson {
    body?: unknown;

    content_type?: 'json';

    /**
     * The number of seconds to wait for attempting to deliver this message to
     * consumers
     */
    delay_seconds?: number;
  }
}

export interface MessagePullParams {
  /**
   * Path param: A Resource identifier.
   */
  account_id: string;

  /**
   * Body param: The maximum number of messages to include in a batch.
   */
  batch_size?: number;

  /**
   * Body param: The number of milliseconds that a message is exclusively leased.
   * After the timeout, the message becomes available for another attempt.
   */
  visibility_timeout_ms?: number;
}

export type MessagePushParams = MessagePushParams.MqQueueMessageText | MessagePushParams.MqQueueMessageJson;

export declare namespace MessagePushParams {
  export interface MqQueueMessageText {
    /**
     * Path param: A Resource identifier.
     */
    account_id: string;

    /**
     * Body param:
     */
    body?: string;

    /**
     * Body param:
     */
    content_type?: 'text';

    /**
     * Body param: The number of seconds to wait for attempting to deliver this message
     * to consumers
     */
    delay_seconds?: number;
  }

  export interface MqQueueMessageJson {
    /**
     * Path param: A Resource identifier.
     */
    account_id: string;

    /**
     * Body param:
     */
    body?: unknown;

    /**
     * Body param:
     */
    content_type?: 'json';

    /**
     * Body param: The number of seconds to wait for attempting to deliver this message
     * to consumers
     */
    delay_seconds?: number;
  }
}

export declare namespace Messages {
  export {
    type MessageAckResponse as MessageAckResponse,
    type MessageBulkPushResponse as MessageBulkPushResponse,
    type MessagePullResponse as MessagePullResponse,
    type MessagePushResponse as MessagePushResponse,
    type MessageAckParams as MessageAckParams,
    type MessageBulkPushParams as MessageBulkPushParams,
    type MessagePullParams as MessagePullParams,
    type MessagePushParams as MessagePushParams,
  };
}
