/*!
 * Copyright 2021 Google LLC
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
/**
 * @typedef FlowControlOptions
 * @property {number} [maxOutstandingMessages] The maximum number of messages to
 *     buffer before publisher flow control kicks in.
 * @property {number} [maxOutstandingBytes] The maximum number of bytes to buffer
 *     before publisher flow control kicks in.
 */
export interface FlowControlOptions {
    maxOutstandingMessages?: number;
    maxOutstandingBytes?: number;
}
/**
 * Manages flow control handling for max bytes and messages.
 *
 * Do not use this class externally, it may change without warning.
 * @private
 *
 */
export declare class FlowControl {
    options: FlowControlOptions;
    private bytes;
    private messages;
    private requests;
    constructor(options: FlowControlOptions);
    /**
     * Update our options after the fact.
     *
     * Do not use externally, it may change without warning.
     * @private
     */
    setOptions(options: FlowControlOptions): void;
    /**
     * @returns {number} The number of bytes that are queued up.
     */
    get currentByteCount(): number;
    /**
     * @returns {number} The number of messages that are queued up.
     */
    get currentMessageCount(): number;
    /**
     * Adds the specified number of bytes or messages to our count. We'll
     * assume that this is end running around our queueing mechanisms.
     *
     * @param {number} bytes The number of bytes to add to the count.
     * @param {number} messages The number of messages to add to the count.
     */
    addToCount(bytes: number, messages: number): void;
    /**
     * Attempts to queue the specified number of bytes and messages. If
     * there are too many things in the publisher flow control queue
     * already, we will defer and come back to it.
     *
     * Do not use externally, it may change without warning.
     * @private
     */
    willSend(bytes: number, messages: number): Promise<void>;
    /**
     * Removes the specified number of bytes and messages from our queued
     * counts, after a deferred request was released. If there is enough
     * space.
     *
     * Do not use externally, it may change without warning.
     * @private
     */
    sent(bytes: number, messages: number): void;
    private exceeded;
    /**
     * Returns true if adding the specified number of bytes or messages
     * would exceed limits imposed by configuration.
     *
     * Do not use externally, it may change without warning.
     * @private
     */
    wouldExceed(bytes: number, messages: number): boolean;
}
