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
import { PubsubMessage, PublishCallback } from './';
export interface BatchPublishOptions {
    maxBytes?: number;
    maxMessages?: number;
    maxMilliseconds?: number;
}
/**
 * @typedef BatchPublishOptions
 * @property {number} [maxBytes=1 * 1024 * 1024] The maximum number of bytes to
 *     buffer before sending a payload.
 * @property {number} [maxMessages=100] The maximum number of messages to
 *     buffer before sending a payload.
 * @property {number} [maxMilliseconds=10] The maximum duration to wait before
 *     sending a payload.
 */
/**
 * Call used to help batch messages.
 *
 * @private
 *
 * @param {BatchPublishOptions} options The batching options.
 */
export declare class MessageBatch {
    options: BatchPublishOptions;
    topicName: string;
    messages: PubsubMessage[];
    callbacks: PublishCallback[];
    created: number;
    bytes: number;
    constructor(options: BatchPublishOptions, topicName: string);
    /**
     * Updates our options from new values.
     *
     * @param {BatchPublishOptions} options The new options.
     */
    setOptions(options: BatchPublishOptions): void;
    /**
     * Adds a message to the current batch.
     *
     * @param {object} message The message to publish.
     * @param {PublishCallback} callback The callback function.
     */
    add(message: PubsubMessage, callback: PublishCallback): void;
    /**
     * Indicates if a given message can fit in the batch.
     *
     * @param {PubsubMessage} message The message in question.
     * @returns {boolean}
     */
    canFit(message: PubsubMessage): boolean;
    /**
     * Indicates if a given message can fit in the batch, re: message count.
     *
     * @returns {boolean}
     */
    canFitCount(): boolean;
    /**
     * Indicates if a given message can fit in the batch, re: byte count.
     *
     * @param {PubsubMessage} message The message in question.
     * @returns {boolean}
     */
    canFitSize(message: PubsubMessage): boolean;
    /**
     * Checks to see if this batch is at the maximum allowed payload size.
     * When publishing ordered messages, it is ok to exceed the user configured
     * thresholds while a batch is in flight.
     *
     * @returns {boolean}
     */
    isAtMax(): boolean;
    /**
     * Indicates if the batch is at capacity.
     *
     * @returns {boolean}
     */
    isFull(): boolean;
    /**
     * True if we are full because of too many messages.
     *
     * @private
     */
    isFullMessages(): boolean;
    /**
     * True if we are full because of too many bytes.
     *
     * @private
     */
    isFullSize(): boolean;
}
