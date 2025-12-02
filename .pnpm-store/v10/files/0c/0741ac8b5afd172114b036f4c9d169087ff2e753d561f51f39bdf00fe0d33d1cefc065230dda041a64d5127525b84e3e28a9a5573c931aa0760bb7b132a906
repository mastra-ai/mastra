/*!
 * Copyright 2019 Google Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { CallOptions } from 'google-gax';
import { Span } from '@opentelemetry/api';
import { BatchPublishOptions } from './message-batch';
import { Queue, OrderedQueue } from './message-queues';
import { Topic } from '../topic';
import { RequestCallback, EmptyCallback } from '../pubsub';
import { FlowControl, FlowControlOptions } from './flow-control';
import { PubsubMessage, Attributes } from './pubsub-message';
export { PubsubMessage, Attributes } from './pubsub-message';
export type PublishCallback = RequestCallback<string>;
export interface PublishOptions {
    batching?: BatchPublishOptions;
    flowControlOptions?: FlowControlOptions;
    gaxOpts?: CallOptions;
    messageOrdering?: boolean;
}
/**
 * @typedef PublishOptions
 * @property {BatchPublishOptions} [batching] The maximum number of bytes to
 *     buffer before sending a payload.
 * @property {FlowControlOptions} [publisherFlowControl] Publisher-side flow
 *     control settings. If this is undefined, Ignore will be the assumed action.
 * @property {object} [gaxOpts] Request configuration options, outlined
 *     {@link https://googleapis.github.io/gax-nodejs/interfaces/CallOptions.html|here.}
 * @property {boolean} [messageOrdering] If true, messages published with the
 * same order key in Message will be delivered to the subscribers in the order in which they
 *  are received by the Pub/Sub system. Otherwise, they may be delivered in
 * any order.
 */
export declare const BATCH_LIMITS: BatchPublishOptions;
export declare const flowControlDefaults: FlowControlOptions;
/**
 * A Publisher object allows you to publish messages to a specific topic.
 *
 * @private
 * @class
 *
 * @see [Topics: publish API Documentation]{@link https://cloud.google.com/pubsub/docs/reference/rest/v1/projects.topics/publish}
 *
 * @param {Topic} topic The topic associated with this publisher.
 * @param {PublishOptions} [options] Configuration object.
 */
export declare class Publisher {
    topic: Topic;
    settings: PublishOptions;
    queue: Queue;
    orderedQueues: Map<string, OrderedQueue>;
    flowControl: FlowControl;
    constructor(topic: Topic, options?: PublishOptions);
    /**
     * Immediately sends all remaining queued data. This is mostly useful
     * if you are planning to call close() on the PubSub object that holds
     * the server connections.
     *
     * @private
     *
     * @param {EmptyCallback} [callback] Callback function.
     * @returns {Promise<EmptyResponse>}
     */
    flush(): Promise<void>;
    flush(callback: EmptyCallback): void;
    /**
     * Publish the provided message.
     *
     * @deprecated use {@link Publisher#publishMessage} instead.
     *
     * @private
     * @see Publisher#publishMessage
     *
     * @param {buffer} data The message data. This must come in the form of a
     *     Buffer object.
     * @param {object.<string, string>} [attributes] Attributes for this message.
     * @param {PublishCallback} [callback] Callback function.
     * @returns {Promise<PublishResponse>}
     */
    publish(data: Buffer, attributes?: Attributes): Promise<string>;
    publish(data: Buffer, callback: PublishCallback): void;
    publish(data: Buffer, attributes: Attributes, callback: PublishCallback): void;
    /**
     * Publish the provided message.
     *
     * @private
     *
     * @throws {TypeError} If data is not a Buffer object.
     * @throws {TypeError} If any value in `attributes` object is not a string.
     *
     * @param {PubsubMessage} [message] Options for this message.
     * @param {PublishCallback} [callback] Callback function.
     */
    publishMessage(message: PubsubMessage): Promise<string>;
    publishMessage(message: PubsubMessage, callback: PublishCallback): void;
    /**
     * Indicates to the publisher that it is safe to continue publishing for the
     * supplied ordering key.
     *
     * @private
     *
     * @param {string} key The ordering key to continue publishing for.
     */
    resumePublishing(key: string): void;
    /**
     * Returns the set of default options used for {@link Publisher}. The
     * returned value is a copy, and editing it will have no effect elsehwere.
     *
     * This is a non-static method to make it easier to access/stub.
     *
     * @private
     *
     * @returns {PublishOptions}
     */
    getOptionDefaults(): PublishOptions;
    /**
     * Sets the Publisher options.
     *
     * @private
     *
     * @param {PublishOptions} options The publisher options.
     */
    setOptions(options?: PublishOptions): void;
    /**
     * Finds or constructs an telemetry publish/parent span for a message.
     *
     * @private
     *
     * @param {PubsubMessage} message The message to create a span for
     */
    getParentSpan(message: PubsubMessage, caller: string): Span | undefined;
}
