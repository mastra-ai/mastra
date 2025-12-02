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
import { Publisher } from '.';
import { PubsubMessage } from './pubsub-message';
/**
 * Encapsulates a series of message publishes from a rapid loop (or similar
 * circumstance).
 *
 * This class is not meant to be instantiated outside of the `@google-cloud/pubsub`
 * package. It is returned from {@link Topic#flowControlled}. Messages sent
 * through an instance of this class will obey publisher flow control
 * settings set through {@link PublisherOptions} on {@link Topic}, across
 * all instances returned by {@link Topic#flowControlled} on that {@link Topic}.
 */
export declare class FlowControlledPublisher {
    private publisher;
    private flowControl;
    private idPromises;
    constructor(publisher: Publisher);
    /**
     * Returns true if sending the specified Buffer would result in exceeding the
     * limits of the flow control settings.
     *
     * @param {PubsubMessage} message The data buffer with the message's contents.
     * @returns {boolean} True if the message would exceed flow control limits.
     */
    wouldExceed(message: PubsubMessage): boolean;
    /**
     * Publishes a message, subject to flow control restrictions.
     *
     * If the message can be sent immediately, this will return `null`. Otherwise,
     * it will return a Promise<void> that resolves after it's okay to resume
     * calling the method.
     *
     * @param {Buffer} [data] The message contents to be sent.
     * @param {Attributes} [attributes] Optional attributes.
     * @returns null, or a Promise that resolves when sending may resume.
     *
     * @example
     * ```
     * const wait = flowControlled.publish({data});
     * if (wait) {
     *   await wait;
     * }
     *
     * ```
     * @example
     * ```
     * // It's okay to await unconditionally, it's equivalent to nextTick().
     * await flowControlled.publish(data);
     * ```
     */
    publish(message: PubsubMessage): Promise<void> | null;
    /**
     * Publishes a message unconditionally, updating flow control counters.
     *
     * You'll generally only want to use this if you want to deal with timing the
     * flow control yourself, but you'd like the library to do the bean counting.
     *
     * @param {Buffer} [data] The message contents to be sent.
     * @param {Attributes} [attributes] Optional attributes.
     *
     * @example
     * ```
     * if (!flowControlled.wouldExceed(data)) {
     *   flowControlled.publishNow(data);
     * }
     * ```
     */
    publishNow(message: PubsubMessage): void;
    private doPublish;
    /**
     * Returns a Promise that will resolve to all of the currently sent
     * message IDs (or reject if there is an error). This also clears
     * out any currently sent messages, so the next call to `all()` will
     * be a clean slate.
     *
     * @returns {Promise<string[]>} A Promise that resolves when all current
     *   messages are sent.
     */
    all(): Promise<string[]>;
}
