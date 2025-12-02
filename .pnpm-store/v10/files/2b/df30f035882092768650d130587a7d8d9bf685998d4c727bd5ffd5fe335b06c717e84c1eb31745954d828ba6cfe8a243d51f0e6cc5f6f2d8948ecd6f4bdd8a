/*!
 * Copyright 2017 Google Inc. All Rights Reserved.
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
import { google } from '../protos/protos';
import { IAM } from './iam';
import { Attributes, PublishCallback, Publisher, PublishOptions, PubsubMessage } from './publisher';
import { FlowControlledPublisher } from './publisher/flow-publisher';
import { EmptyCallback, EmptyResponse, ExistsCallback, ExistsResponse, ObjectStream, PagedResponse, PageOptions, PubSub, RequestCallback, ResourceCallback } from './pubsub';
import { CreateSubscriptionCallback, CreateSubscriptionOptions, CreateSubscriptionResponse, Subscription, SubscriptionOptions } from './subscription';
export type TopicMetadata = google.pubsub.v1.ITopic;
type TopicCallback = ResourceCallback<Topic, TopicMetadata>;
type TopicResponse = [Topic, TopicMetadata];
export type CreateTopicCallback = TopicCallback;
export type CreateTopicResponse = TopicResponse;
export type GetTopicCallback = TopicCallback;
export type GetTopicResponse = TopicResponse;
export type GetTopicOptions = CallOptions & {
    autoCreate?: boolean;
};
type MetadataCallback = RequestCallback<TopicMetadata>;
type MetadataResponse = [TopicMetadata];
export type GetTopicMetadataCallback = MetadataCallback;
export type GetTopicMetadataResponse = MetadataResponse;
export type SetTopicMetadataCallback = MetadataCallback;
export type SetTopicMetadataResponse = MetadataResponse;
export type GetTopicSubscriptionsCallback = RequestCallback<Subscription, google.pubsub.v1.IListTopicSubscriptionsResponse>;
export type GetTopicSubscriptionsResponse = PagedResponse<Subscription, google.pubsub.v1.IListTopicSubscriptionsResponse>;
export type MessageOptions = PubsubMessage & {
    json?: any;
};
/**
 * A Topic object allows you to interact with a Cloud Pub/Sub topic.
 *
 * @class
 * @param {PubSub} pubsub PubSub object.
 * @param {string} name Name of the topic.
 * @param {PublishOptions} [options] Publisher configuration object.
 *
 * @example
 * ```
 * const {PubSub} = require('@google-cloud/pubsub');
 * const pubsub = new PubSub();
 *
 * const topic = pubsub.topic('my-topic');
 *
 * ```
 * @example To enable message ordering, set `enableMessageOrdering` to true. Please note that this does not persist to an actual topic.
 * ```
 * const topic = pubsub.topic('ordered-topic', {enableMessageOrdering: true});
 * ```
 */
export declare class Topic {
    parent: PubSub;
    pubsub: PubSub;
    request: typeof PubSub.prototype.request;
    iam: IAM;
    metadata?: TopicMetadata;
    publisher: Publisher;
    getSubscriptionsStream: () => ObjectStream<Subscription>;
    constructor(pubsub: PubSub, name: string, options?: PublishOptions);
    private id_;
    get name(): string;
    /**
     * Immediately sends all remaining queued data. This is mostly useful
     * if you are planning to call close() on the PubSub object that holds
     * the server connections.
     *
     * @param {EmptyCallback} [callback] Callback function.
     * @returns {Promise<EmptyResponse>}
     */
    flush(): Promise<void>;
    flush(callback: EmptyCallback): void;
    /**
     * Create a topic.
     *
     * @param {object} [gaxOpts] Request configuration options, outlined
     *     here: https://googleapis.github.io/gax-nodejs/interfaces/CallOptions.html.
     * @param {CreateTopicCallback} [callback] Callback function.
     * @returns {Promise<CreateTopicResponse>}
     *
     * @example
     * ```
     * const {PubSub} = require('@google-cloud/pubsub');
     * const pubsub = new PubSub();
     *
     * const topic = pubsub.topic('my-topic');
     *
     * topic.create((err, topic, apiResponse) => {
     *   if (!err) {
     *     // The topic was created successfully.
     *   }
     * });
     *
     * //-
     * // If the callback is omitted, we'll return a Promise.
     * //-
     * topic.create().then((data) => {
     *   const topic = data[0];
     *   const apiResponse = data[1];
     * });
     * ```
     */
    create(gaxOpts?: CallOptions): Promise<CreateTopicResponse>;
    create(callback: CreateTopicCallback): void;
    create(gaxOpts: CallOptions, callback: CreateTopicCallback): void;
    /**
     * Create a subscription to this topic.
     *
     * @see [Subscriptions: create API Documentation]{@link https://cloud.google.com/pubsub/docs/reference/rest/v1/projects.subscriptions/create}
     *
     * @throws {Error} If subscription name is omitted.
     *
     * @param {string} name The name of the subscription.
     * @param {CreateSubscriptionRequest} [options] See a
     *     [Subscription
     * resource](https://cloud.google.com/pubsub/docs/reference/rest/v1/projects.subscriptions).
     * @param {CreateSubscriptionCallback} [callback] Callback function.
     * @returns {Promise<CreateSubscriptionResponse>}
     *
     * @example
     * ```
     * const {PubSub} = require('@google-cloud/pubsub');
     * const pubsub = new PubSub();
     *
     * const topic = pubsub.topic('my-topic');
     * const callback = function(err, subscription, apiResponse) {};
     *
     * // Without specifying any options.
     * topic.createSubscription('newMessages', callback);
     *
     * // With options.
     * topic.createSubscription('newMessages', {
     *   ackDeadlineSeconds: 90
     * }, callback);
     *
     * //-
     * // If the callback is omitted, we'll return a Promise.
     * //-
     * topic.createSubscription('newMessages').then((data) => {
     *   const subscription = data[0];
     *   const apiResponse = data[1];
     * });
     * ```
     */
    createSubscription(name: string, callback: CreateSubscriptionCallback): void;
    createSubscription(name: string, options?: CreateSubscriptionOptions): Promise<CreateSubscriptionResponse>;
    createSubscription(name: string, options: CreateSubscriptionOptions, callback: CreateSubscriptionCallback): void;
    /**
     * Delete the topic. This will not delete subscriptions to this topic.
     *
     * @see [Topics: delete API Documentation]{@link https://cloud.google.com/pubsub/docs/reference/rest/v1/projects.topics/delete}
     *
     * @param {object} [gaxOpts] Request configuration options, outlined
     *     here: https://googleapis.github.io/gax-nodejs/interfaces/CallOptions.html.
     * @param {function} [callback] The callback function.
     * @param {?error} callback.err An error returned while making this
     *     request.
     * @param {object} callback.apiResponse Raw API response.
     *
     * @example
     * ```
     * const {PubSub} = require('@google-cloud/pubsub');
     * const pubsub = new PubSub();
     *
     * const topic = pubsub.topic('my-topic');
     *
     * topic.delete((err, apiResponse) => {});
     *
     * //-
     * // If the callback is omitted, we'll return a Promise.
     * //-
     * topic.delete().then((data) => {
     *   const apiResponse = data[0];
     * });
     * ```
     */
    delete(callback: EmptyCallback): void;
    delete(gaxOpts?: CallOptions): Promise<EmptyResponse>;
    delete(gaxOpts: CallOptions, callback: EmptyCallback): void;
    /**
     * @typedef {array} TopicExistsResponse
     * @property {boolean} 0 Whether the topic exists
     */
    /**
     * @callback TopicExistsCallback
     * @param {?Error} err Request error, if any.
     * @param {boolean} exists Whether the topic exists.
     */
    /**
     * Check if a topic exists.
     *
     * @param {TopicExistsCallback} [callback] Callback function.
     * @returns {Promise<TopicExistsResponse>}
     *
     * @example
     * ```
     * const {PubSub} = require('@google-cloud/pubsub');
     * const pubsub = new PubSub();
     *
     * const topic = pubsub.topic('my-topic');
     *
     * topic.exists((err, exists) => {});
     *
     * //-
     * // If the callback is omitted, we'll return a Promise.
     * //-
     * topic.exists().then((data) => {
     *   const exists = data[0];
     * });
     * ```
     */
    exists(): Promise<ExistsResponse>;
    exists(callback: ExistsCallback): void;
    /**
     * @typedef {array} GetTopicResponse
     * @property {Topic} 0 The {@link Topic}.
     * @property {object} 1 The full API response.
     */
    /**
     * @callback GetTopicCallback
     * @param {?Error} err Request error, if any.
     * @param {Topic} topic The {@link Topic}.
     * @param {object} apiResponse The full API response.
     */
    /**
     * Get a topic if it exists.
     *
     * @param {object} [gaxOpts] Request configuration options, outlined
     *     here: https://googleapis.github.io/gax-nodejs/interfaces/CallOptions.html.
     * @param {boolean} [gaxOpts.autoCreate=false] Automatically create the topic
     *     does not already exist.
     * @param {GetTopicCallback} [callback] Callback function.
     * @returns {Promise<GetTopicResponse>}
     *
     * @example
     * ```
     * const {PubSub} = require('@google-cloud/pubsub');
     * const pubsub = new PubSub();
     *
     * const topic = pubsub.topic('my-topic');
     *
     * topic.get((err, topic, apiResponse) => {
     *   // The `topic` data has been populated.
     * });
     *
     * //-
     * // If the callback is omitted, we'll return a Promise.
     * //-
     * topic.get().then((data) => {
     *   const topic = data[0];
     *   const apiResponse = data[1];
     * });
     * ```
     */
    get(callback: GetTopicCallback): void;
    get(gaxOpts?: GetTopicOptions): Promise<GetTopicResponse>;
    get(gaxOpts: GetTopicOptions, callback: GetTopicCallback): void;
    /**
     * @typedef {array} GetTopicMetadataResponse
     * @property {object} 0 The full API response.
     */
    /**
     * @callback GetTopicMetadataCallback
     * @param {?Error} err Request error, if any.
     * @param {object} apiResponse The full API response.
     */
    /**
     * Get the official representation of this topic from the API.
     *
     * @see [Topics: get API Documentation]{@link https://cloud.google.com/pubsub/docs/reference/rest/v1/projects.topics/get}
     *
     * @param {object} [gaxOpts] Request configuration options, outlined
     *     here: https://googleapis.github.io/gax-nodejs/interfaces/CallOptions.html.
     * @param {GetTopicMetadataCallback} [callback] Callback function.
     * @returns {Promise<GetTopicMetadataResponse>}
     *
     * @example
     * ```
     * const {PubSub} = require('@google-cloud/pubsub');
     * const pubsub = new PubSub();
     *
     * const topic = pubsub.topic('my-topic');
     *
     * topic.getMetadata((err, apiResponse) => {});
     *
     * //-
     * // If the callback is omitted, we'll return a Promise.
     * //-
     * topic.getMetadata().then((data) => {
     *   const apiResponse = data[0];
     * });
     * ```
     */
    getMetadata(callback: GetTopicMetadataCallback): void;
    getMetadata(gaxOpts: CallOptions, callback: GetTopicMetadataCallback): void;
    getMetadata(gaxOpts?: CallOptions): Promise<GetTopicMetadataResponse>;
    /**
     * Get a list of the subscriptions registered to this topic. You may
     * optionally provide a query object as the first argument to customize the
     * response.
     *
     * Your provided callback will be invoked with an error object if an API error
     * occurred or an array of {module:pubsub/subscription} objects.
     *
     * @see [Subscriptions: list API Documentation]{@link https://cloud.google.com/pubsub/docs/reference/rest/v1/projects.topics.subscriptions/list}
     *
     * @param {GetSubscriptionsRequest} [query] Query object for listing subscriptions.
     * @param {GetSubscriptionsCallback} [callback] Callback function.
     * @returns {Promise<GetSubscriptionsResponse>}
     *
     * @example
     * ```
     * const {PubSub} = require('@google-cloud/pubsub');
     * const pubsub = new PubSub();
     *
     * const topic = pubsub.topic('my-topic');
     *
     * topic.getSubscriptions((err, subscriptions) => {
     *   // subscriptions is an array of `Subscription` objects.
     * });
     *
     * // Customize the query.
     * topic.getSubscriptions({
     *   pageSize: 3
     * }, callback);
     *
     * //-
     * // If the callback is omitted, we'll return a Promise.
     * //-
     * topic.getSubscriptions().then((data) => {
     *   const subscriptions = data[0];
     * });
     * ```
     */
    getSubscriptions(callback: GetTopicSubscriptionsCallback): void;
    getSubscriptions(options: PageOptions, callback: GetTopicSubscriptionsCallback): void;
    getSubscriptions(options?: PageOptions): Promise<GetTopicSubscriptionsResponse>;
    /**
     * Publish the provided message.
     *
     * @deprecated Please use {@link Topic#publishMessage}.
     *
     * @throws {TypeError} If data is not a Buffer object.
     * @throws {TypeError} If any value in `attributes` object is not a string.
     *
     * @param {buffer} data The message data. This must come in the form of a
     *     Buffer object.
     * @param {object.<string, string>} [attributes] Attributes for this message.
     * @param {PublishCallback} [callback] Callback function.
     * @returns {Promise<PublishResponse>}
     *
     * @example
     * ```
     * const {PubSub} = require('@google-cloud/pubsub');
     * const pubsub = new PubSub();
     *
     * const topic = pubsub.topic('my-topic');
     * const data = Buffer.from('Hello, world!');
     *
     * const callback = (err, messageId) => {
     *   if (err) {
     *     // Error handling omitted.
     *   }
     * };
     *
     * topic.publish(data, callback);
     *
     * ```
     * @example Optionally you can provide an object containing attributes for the message. Note that all values in the object must be strings.
     * ```
     * const attributes = {
     *   key: 'value'
     * };
     *
     * topic.publish(data, attributes, callback);
     *
     * ```
     * @example If the callback is omitted, we'll return a Promise.
     * ```
     * topic.publish(data).then((messageId) => {});
     * ```
     */
    publish(data: Buffer, attributes?: Attributes): Promise<string>;
    publish(data: Buffer, callback: PublishCallback): void;
    publish(data: Buffer, attributes: Attributes, callback: PublishCallback): void;
    /**
     * Publish the provided JSON. It should be noted that all messages published
     * are done so in the form of a Buffer. This is simply a convenience method
     * that will transform JSON into a Buffer before publishing.
     * {@link Subscription} objects will always return message data in the form of
     * a Buffer, so any JSON published will require manual deserialization.
     *
     * @deprecated Please use the `json` option via {@link Topic#publishMessage}.
     *
     * @throws {Error} If non-object data is provided.
     *
     * @param {object} json The JSON data to publish.
     * @param {object} [attributes] Attributes for this message.
     * @param {PublishCallback} [callback] Callback function.
     * @returns {Promise<PublishResponse>}
     *
     * @example
     * ```
     * const {PubSub} = require('@google-cloud/pubsub');
     * const pubsub = new PubSub();
     * const topic = pubsub.topic('my-topic');
     *
     * const data = {
     *   foo: 'bar'
     * };
     *
     * const callback = (err, messageId) => {
     *   if (err) {
     *     // Error handling omitted.
     *   }
     * };
     *
     * topic.publishJSON(data, callback);
     *
     * ```
     * @example Optionally you can provide an object containing attributes for the message. Note that all values in the object must be strings.
     * ```
     * const attributes = {
     *   key: 'value'
     * };
     *
     * topic.publishJSON(data, attributes, callback);
     *
     * ```
     * @example If the callback is omitted, we'll return a Promise.
     * ```
     * topic.publishJSON(data).then((messageId) => {});
     * ```
     */
    publishJSON(json: object, attributes?: Attributes): Promise<string>;
    publishJSON(json: object, callback: PublishCallback): void;
    publishJSON(json: object, attributes: Attributes, callback: PublishCallback): void;
    /**
     * @typedef {object} MessageOptions
     * @property {buffer} [data] The message data.
     * @property {object} [json] Convenience property to publish JSON data. This
     *     will transform the provided JSON into a Buffer before publishing.
     *     {@link Subscription} objects will always return message data in the
     *     form of a Buffer, so any JSON published will require manual
     *     deserialization.
     * @property {object.<string, string>} [attributes] Attributes for this
     *     message.
     * @property {string} [orderingKey] A message ordering key.
     */
    /**
     * Publish the provided message.
     *
     * @throws {TypeError} If data is not a Buffer object.
     * @throws {TypeError} If any value in `attributes` object is not a string.
     *
     * @param {MessageOptions} message Message object.
     * @param {PublishCallback} [callback] Callback function.
     * @returns {Promise<PublishResponse>}
     *
     * @example
     * ```
     * const {PubSub} = require('@google-cloud/pubsub');
     * const pubsub = new PubSub();
     * const topic = pubsub.topic('my-topic');
     *
     * const data = Buffer.from('Hello, world!');
     *
     * const callback = (err, messageId) => {
     *   if (err) {
     *     // Error handling omitted.
     *   }
     * };
     *
     * topic.publishMessage({data}, callback);
     *
     * ```
     * @example Publish JSON message data.
     * ```
     * const json = {foo: 'bar'};
     *
     * topic.publishMessage({json}, callback);
     *
     * ```
     * @example To publish messages in order (this is still experimental), make sure message ordering is enabled and provide an ordering key
     * ```
     * const topic = pubsub.topic('ordered-topic', {messageOrdering: true});
     * const orderingKey = 'my-key';
     *
     * topic.publishMessage({data, orderingKey}, callback);
     *
     * ```
     * @example If the callback is omitted, we'll return a Promise.
     * ```
     * const messageId = await topic.publishMessage({data});
     * ```
     */
    publishMessage(message: MessageOptions): Promise<string>;
    publishMessage(message: MessageOptions, callback: PublishCallback): void;
    /**
     * Creates a FlowControlledPublisher for this Topic.
     *
     * FlowControlledPublisher is a helper that lets you control how many messages
     * are simultaneously queued to send, to avoid ballooning memory usage on
     * a low bandwidth connection to Pub/Sub.
     *
     * Note that it's perfectly fine to create more than one on the same Topic.
     * The actual flow control settings on the Topic will apply across all
     * FlowControlledPublisher objects on that Topic.
     *
     * @returns {FlowControlledPublisher} The flow control helper.
     */
    flowControlled(): FlowControlledPublisher;
    /**
     * In the event that the client fails to publish an ordered message, all
     * subsequent publish calls using the same ordering key will fail. Calling
     * this method will disregard the publish failure, allowing the supplied
     * ordering key to be used again in the future.
     *
     * @param {string} orderingKey The ordering key in question.
     *
     * @example
     * ```
     * const {PubSub} = require('@google-cloud/pubsub');
     * const pubsub = new PubSub();
     * const topic = pubsub.topic('my-topic', {messageOrdering: true});
     *
     * const orderingKey = 'foo';
     * const data = Buffer.from('Hello, order!');
     *
     * topic.publishMessage({data, orderingKey}, err => {
     *   if (err) {
     *     topic.resumePublishing(orderingKey);
     *   }
     * });
     * ```
     */
    resumePublishing(orderingKey: string): void;
    /**
     * @typedef {array} SetTopicMetadataResponse
     * @property {object} 0 The full API response.
     */
    /**
     * @callback SetTopicMetadataCallback
     * @param {?Error} err Request error, if any.
     * @param {object} apiResponse The full API response.
     */
    /**
     * Updates the topic.
     *
     * @see [UpdateTopicRequest API Documentation]{@link https://cloud.google.com/pubsub/docs/reference/rpc/google.pubsub.v1#google.pubsub.v1.UpdateTopicRequest}
     *
     * @param {object} metadata The fields to update. This should be structured
     *     like a {@link
     * https://cloud.google.com/pubsub/docs/reference/rest/v1/projects.topics#Topic|Topic
     * object}.
     * @param {object} [gaxOpts] Request configuration options, outlined
     *     here: https://googleapis.github.io/gax-nodejs/interfaces/CallOptions.html.
     * @param {SetTopicMetadataCallback} [callback] Callback function.
     * @returns {Promise<SetTopicMetadataResponse>}
     *
     * @example
     * ```
     * const {PubSub} = require('@google-cloud/pubsub');
     * const pubsub = new PubSub();
     *
     * const topic = pubsub.topic('my-topic');
     * const metadata = {
     *   labels: {foo: 'bar'}
     * };
     *
     * topic.setMetadata(metadata, err => {
     *   if (err) {
     *     // Error handling omitted.
     *   }
     * });
     *
     * ```
     * @example If the callback is omitted, we'll return a Promise.
     * ```
     * topic.setMetadata(metadata).then((data) => {
     *   const apiResponse = data[0];
     * });
     * ```
     */
    setMetadata(options: TopicMetadata, gaxOpts?: CallOptions): Promise<SetTopicMetadataResponse>;
    setMetadata(options: TopicMetadata, callback: SetTopicMetadataCallback): void;
    setMetadata(options: TopicMetadata, gaxOpts: CallOptions, callback: SetTopicMetadataCallback): void;
    /**
     * Set the publisher options.
     *
     * @param {PublishOptions} options The publisher options.
     *
     * @example
     * ```
     * const {PubSub} = require('@google-cloud/pubsub');
     * const pubsub = new PubSub();
     *
     * const topic = pubsub.topic('my-topic');
     *
     * topic.setPublishOptions({
     *   batching: {
     *     maxMilliseconds: 10
     *   }
     * });
     * ```
     */
    setPublishOptions(options: PublishOptions): void;
    /**
     * Get the default publisher options. These may be modified and passed
     * back into {@link Topic#setPublishOptions}.
     *
     * @example
     * ```
     * const {PubSub} = require('@google-cloud/pubsub');
     * const pubsub = new PubSub();
     *
     * const topic = pubsub.topic('my-topic');
     *
     * const defaults = topic.getPublishOptionDefaults();
     * defaults.batching.maxMilliseconds = 10;
     * topic.setPublishOptions(defaults);
     * ```
     */
    getPublishOptionDefaults(): PublishOptions;
    /**
     * Create a Subscription object. This command by itself will not run any API
     * requests. You will receive a {module:pubsub/subscription} object,
     * which will allow you to interact with a subscription.
     *
     * @throws {Error} If subscription name is omitted.
     *
     * @param {string} name Name of the subscription.
     * @param {SubscriberOptions} [options] Configuration object.
     * @return {Subscription}
     *
     * @example
     * ```
     * const {PubSub} = require('@google-cloud/pubsub');
     * const pubsub = new PubSub();
     *
     * const topic = pubsub.topic('my-topic');
     * const subscription = topic.subscription('my-subscription');
     *
     * // Register a listener for `message` events.
     * subscription.on('message', (message) => {
     *   // Called every time a message is received.
     *   // message.id = ID of the message.
     *   // message.ackId = ID used to acknowledge the message receival.
     *   // message.data = Contents of the message.
     *   // message.attributes = Attributes of the message.
     *   // message.publishTime = Timestamp when Pub/Sub received the message.
     * });
     * ```
     */
    subscription(name: string, options?: SubscriptionOptions): Subscription;
    /**
     * Format the name of a topic. A Topic's full name is in the format of
     * 'projects/{projectId}/topics/{topicName}'.
     *
     * @private
     *
     * @return {string}
     */
    static formatName_(projectId: string, name: string): string;
}
export { PublishOptions };
