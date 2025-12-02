/*!
 * Copyright 2014 Google Inc. All Rights Reserved.
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
import { FlowControlOptions } from './lease-manager';
import { DetachedCallback, DetachedResponse, EmptyCallback, EmptyResponse, ExistsCallback, ExistsResponse, Omit, PubSub, RequestCallback, ResourceCallback } from './pubsub';
import { CreateSnapshotCallback, CreateSnapshotResponse, SeekCallback, SeekResponse, Snapshot } from './snapshot';
import { Message, SubscriberOptions, SubscriberCloseOptions } from './subscriber';
import { Topic } from './topic';
import { StatusError } from './message-stream';
import { DebugMessage } from './debug';
import { EventEmitter } from 'stream';
export { AckError, AckResponse, AckResponses } from './subscriber';
export type PushConfig = google.pubsub.v1.IPushConfig;
export type OidcToken = google.pubsub.v1.PushConfig.IOidcToken;
export type SubscriptionMetadata = {
    messageRetentionDuration?: google.protobuf.IDuration | number;
    pushEndpoint?: string;
    oidcToken?: OidcToken;
} & Omit<google.pubsub.v1.ISubscription, 'messageRetentionDuration'>;
export type SubscriptionOptions = SubscriberOptions & {
    topic?: Topic;
};
export type SubscriptionCloseCallback = (err?: Error) => void;
export type SubscriptionCloseOptions = SubscriberCloseOptions;
export declare const SubscriptionCloseBehaviors: {
    NackImmediately: "NACK";
    WaitForProcessing: "WAIT";
};
type SubscriptionCallback = ResourceCallback<Subscription, google.pubsub.v1.ISubscription>;
type SubscriptionResponse = [Subscription, google.pubsub.v1.ISubscription];
export type CreateSubscriptionOptions = SubscriptionMetadata & {
    gaxOpts?: CallOptions;
    flowControl?: FlowControlOptions;
};
export type CreateSubscriptionCallback = SubscriptionCallback;
export type CreateSubscriptionResponse = SubscriptionResponse;
export type GetSubscriptionOptions = CallOptions & {
    autoCreate?: boolean;
};
export type GetSubscriptionCallback = SubscriptionCallback;
export type GetSubscriptionResponse = SubscriptionResponse;
type MetadataCallback = RequestCallback<google.pubsub.v1.ISubscription>;
type MetadataResponse = [google.pubsub.v1.ISubscription];
export type GetSubscriptionMetadataCallback = MetadataCallback;
export type GetSubscriptionMetadataResponse = MetadataResponse;
export type SetSubscriptionMetadataCallback = MetadataCallback;
export type SetSubscriptionMetadataResponse = MetadataResponse;
export type DetachSubscriptionCallback = EmptyCallback;
export type DetachSubscriptionResponse = EmptyResponse;
export declare interface Subscription {
    on(event: 'message', listener: (message: Message) => void): this;
    on(event: 'error', listener: (error: StatusError) => void): this;
    on(event: 'close', listener: () => void): this;
    on(event: 'debug', listener: (msg: DebugMessage) => void): this;
    on(event: 'newListener', listener: (event: string | symbol, listener: Function) => void): this;
    on(event: 'removeListener', listener: (event: string | symbol, listener: Function) => void): this;
    on(event: string, listener: void): this;
}
/**
 * @typedef {object} ExpirationPolicy
 * A policy that specifies the conditions for this subscription's expiration. A
 * subscription is considered active as long as any connected subscriber is
 * successfully consuming messages from the subscription or is issuing
 * operations on the subscription. If expirationPolicy is not set, a default
 * policy with ttl of 31 days will be used. The minimum allowed value for
 * expirationPolicy.ttl is 1 day.
 * @property {google.protobuf.Duration} ttl Specifies the "time-to-live"
 *     duration for an associated resource. The resource expires if it is not
 *     active for a period of `ttl`. The definition of "activity" depends on the
 *     type of the associated resource. The minimum and maximum allowed values
 *     for `ttl` depend on the type of the associated resource, as well. If
 *     `ttl` is not set, the associated resource never expires.
 */
/**
 * A Subscription object will give you access to your Cloud Pub/Sub
 * subscription.
 *
 * Subscriptions are sometimes retrieved when using various methods:
 *
 * - {@link PubSub#getSubscriptions}
 * - {@link Topic#getSubscriptions}
 *
 * Subscription objects may be created directly with:
 *
 * - {@link PubSub#createSubscription}
 * - {@link Topic#createSubscription}
 *
 * All Subscription objects are instances of an
 * [EventEmitter](http://nodejs.org/api/events.html). The subscription will pull
 * for messages automatically as long as there is at least one listener assigned
 * for the `message` event. Available events:
 *
 * Upon receipt of a message:
 * on(event: 'message', listener: (message: {@link Message}) => void): this;
 *
 * Upon receipt of an error:
 * on(event: 'error', listener: (error: Error) => void): this;
 *
 * Upon receipt of a (non-fatal) debug warning:
 * on(event: 'debug', listener: (msg: DebugMessage) => void): this;
 *
 * Upon the closing of the subscriber:
 * on(event: 'close', listener: Function): this;
 *
 * By default Subscription objects allow you to process 1000 messages at the same
 * time. You can fine tune this value by adjusting the
 * `options.flowControl.maxMessages` option.
 *
 * If your subscription is seeing more re-deliveries than preferable, you might
 * try increasing your `options.ackDeadline` value or decreasing the
 * `options.streamingOptions.maxStreams` value.
 *
 * Subscription objects handle ack management, by automatically extending the
 * ack deadline while the message is being processed, to then issue the ack or
 * nack of such message when the processing is done. **Note:** message
 * redelivery is still possible.
 *
 * By default each {@link PubSub} instance can handle 100 open streams, with
 * default options this translates to less than 20 Subscriptions per PubSub
 * instance. If you wish to create more Subscriptions than that, you can either
 * create multiple PubSub instances or lower the
 * `options.streamingOptions.maxStreams` value on each Subscription object.
 *
 * @class
 *
 * @param {PubSub} pubsub PubSub object.
 * @param {string} name The name of the subscription.
 * @param {SubscriberOptions} [options] Options for handling messages.
 *
 * @example From {@link PubSub#getSubscriptions}
 * ```
 * const {PubSub} = require('@google-cloud/pubsub');
 * const pubsub = new PubSub();
 *
 * pubsub.getSubscriptions((err, subscriptions) => {
 *   // `subscriptions` is an array of Subscription objects.
 * });
 *
 * ```
 * @example From {@link Topic#getSubscriptions}
 * ```
 * const topic = pubsub.topic('my-topic');
 * topic.getSubscriptions((err, subscriptions) => {
 *   // `subscriptions` is an array of Subscription objects.
 * });
 *
 * ```
 * @example {@link Topic#createSubscription}
 * ```
 * const topic = pubsub.topic('my-topic');
 * topic.createSubscription('new-subscription', (err, subscription) => {
 *   // `subscription` is a Subscription object.
 * });
 *
 * ```
 * @example {@link Topic#subscription}
 * ```
 * const topic = pubsub.topic('my-topic');
 * const subscription = topic.subscription('my-subscription');
 * // `subscription` is a Subscription object.
 *
 * ```
 * @example Once you have obtained a subscription object, you may begin to register listeners. This will automatically trigger pulling for messages.
 * ```
 * // Register an error handler.
 * subscription.on('error', (err) => {});
 *
 * // Register a debug handler, to catch non-fatal errors and other messages.
 * subscription.on('debug', msg => { console.log(msg.message); });
 *
 * // Register a close handler in case the subscriber closes unexpectedly
 * subscription.on('close', () => {});
 *
 * // Register a listener for `message` events.
 * function onMessage(message) {
 *   // Called every time a message is received.
 *
 *   // message.id = ID of the message.
 *   // message.ackId = ID used to acknowledge the message receival.
 *   // message.data = Contents of the message.
 *   // message.attributes = Attributes of the message.
 *   // message.publishTime = Date when Pub/Sub received the message.
 *
 *   // Ack the message:
 *   // message.ack();
 *
 *   // This doesn't ack the message, but allows more messages to be retrieved
 *   // if your limit was hit or if you don't want to ack the message.
 *   // message.nack();
 * }
 * subscription.on('message', onMessage);
 *
 * // Remove the listener from receiving `message` events.
 * subscription.removeListener('message', onMessage);
 *
 * ```
 * @example To apply a fine level of flow control, consider the following configuration
 * ```
 * const subscription = topic.subscription('my-sub', {
 *   flowControl: {
 *     maxMessages: 1,
 *     // this tells the client to manage and lock any excess messages
 *     allowExcessMessages: false
 *   }
 * });
 * ```
 */
export declare class Subscription extends EventEmitter {
    pubsub: PubSub;
    iam: IAM;
    topic?: Topic | string;
    metadata?: google.pubsub.v1.ISubscription;
    request: typeof PubSub.prototype.request;
    private _subscriber;
    constructor(pubsub: PubSub, name: string, options?: SubscriptionOptions);
    private id_;
    get name(): string;
    /**
     * Indicates if the Subscription is open and receiving messages.
     *
     * @type {boolean}
     */
    get isOpen(): boolean;
    /**
     * @type {string}
     */
    get projectId(): string;
    /**
     * Closes the Subscription. Once this is called you will no longer receive
     * message events unless you call {Subscription#open} or add new message
     * listeners.
     *
     * @param {function} [callback] The callback function, if not using the Promise-based
     *   call signature.
     * @param {?error} [callback.err] An error returned while closing the Subscription.
     *
     * @example
     * ```
     * await subscription.close();
     * ```
     */
    close(): Promise<void>;
    close(callback: SubscriptionCloseCallback): void;
    /**
     * Create a subscription.
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
     * const subscription = topic.subscription('newMessages');
     * const callback = function(err, subscription, apiResponse) {};
     *
     * subscription.create(callback);
     *
     * ```
     * @example With options
     * ```
     * subscription.create({
     *   ackDeadlineSeconds: 90
     * }, callback);
     *
     * ```
     * @example If the callback is omitted, we'll return a Promise.
     * ```
     * const [sub, apiResponse] = await subscription.create();
     * ```
     */
    create(options?: CreateSubscriptionOptions): Promise<CreateSubscriptionResponse>;
    create(callback: CreateSubscriptionCallback): void;
    create(options: CreateSubscriptionOptions, callback: CreateSubscriptionCallback): void;
    /**
     * @typedef {array} CreateSnapshotResponse
     * @property {Snapshot} 0 The new {@link Snapshot}.
     * @property {object} 1 The full API response.
     */
    /**
     * @callback CreateSnapshotCallback
     * @param {?Error} err Request error, if any.
     * @param {Snapshot} snapshot The new {@link Snapshot}.
     * @param {object} apiResponse The full API response.
     */
    /**
     * Create a snapshot with the given name.
     *
     * @param {string} name Name of the snapshot.
     * @param {object} [gaxOpts] Request configuration options, outlined
     *     here: https://googleapis.github.io/gax-nodejs/interfaces/CallOptions.html.
     * @param {CreateSnapshotCallback} [callback] Callback function.
     * @returns {Promise<CreateSnapshotResponse>}
     *
     * @example
     * ```
     * const {PubSub} = require('@google-cloud/pubsub');
     * const pubsub = new PubSub();
     *
     * const topic = pubsub.topic('my-topic');
     * const subscription = topic.subscription('my-subscription');
     *
     * const callback = (err, snapshot, apiResponse) => {
     *   if (!err) {
     *     // The snapshot was created successfully.
     *   }
     * };
     *
     * subscription.createSnapshot('my-snapshot', callback);
     *
     * //-
     * // If the callback is omitted, we'll return a Promise.
     * //-
     * subscription.createSnapshot('my-snapshot').then((data) => {
     *   const snapshot = data[0];
     *   const apiResponse = data[1];
     * });
     * ```
     */
    createSnapshot(name: string, gaxOpts?: CallOptions): Promise<CreateSnapshotResponse>;
    createSnapshot(name: string, callback: CreateSnapshotCallback): void;
    createSnapshot(name: string, gaxOpts: CallOptions, callback: CreateSnapshotCallback): void;
    /**
     * Delete the subscription. Pull requests from the current subscription will
     * be errored once unsubscription is complete.
     *
     * @see [Subscriptions: delete API Documentation]{@link https://cloud.google.com/pubsub/docs/reference/rest/v1/projects.subscriptions/delete}
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
     * const subscription = topic.subscription('my-subscription');
     *
     * subscription.delete((err, apiResponse) => {});
     *
     * //-
     * // If the callback is omitted, we'll return a Promise.
     * //-
     * subscription.delete().then((data) => {
     *   const apiResponse = data[0];
     * });
     * ```
     */
    delete(gaxOpts?: CallOptions): Promise<EmptyResponse>;
    delete(callback: EmptyCallback): void;
    delete(gaxOpts: CallOptions, callback: EmptyCallback): void;
    /**
     * @typedef {array} SubscriptionDetachedResponse
     * @property {boolean} 0 Whether the subscription is detached.
     */
    /**
     * @callback SubscriptionDetachedCallback
     * @param {?Error} err Request error, if any.
     * @param {boolean} exists Whether the subscription is detached.
     */
    /**
     * Check if a subscription is detached.
     *
     * @param {SubscriptionDetachedCallback} [callback] Callback function.
     * @returns {Promise<SubscriptionDetachedResponse>}
     *
     * @example
     * ```
     * const {PubSub} = require('@google-cloud/pubsub');
     * const pubsub = new PubSub();
     *
     * const topic = pubsub.topic('my-topic');
     * const subscription = topic.subscription('my-subscription');
     *
     * subscription.detached((err, exists) => {});
     *
     * //-
     * // If the callback is omitted, we'll return a Promise.
     * //-
     * subscription.detached().then((data) => {
     *   const detached = data[0];
     * });
     * ```
     */
    detached(): Promise<DetachedResponse>;
    detached(callback: DetachedCallback): void;
    /**
     * @typedef {array} SubscriptionExistsResponse
     * @property {boolean} 0 Whether the subscription exists
     */
    /**
     * @callback SubscriptionExistsCallback
     * @param {?Error} err Request error, if any.
     * @param {boolean} exists Whether the subscription exists.
     */
    /**
     * Check if a subscription exists.
     *
     * @param {SubscriptionExistsCallback} [callback] Callback function.
     * @returns {Promise<SubscriptionExistsResponse>}
     *
     * @example
     * ```
     * const {PubSub} = require('@google-cloud/pubsub');
     * const pubsub = new PubSub();
     *
     * const topic = pubsub.topic('my-topic');
     * const subscription = topic.subscription('my-subscription');
     *
     * subscription.exists((err, exists) => {});
     *
     * //-
     * // If the callback is omitted, we'll return a Promise.
     * //-
     * subscription.exists().then((data) => {
     *   const exists = data[0];
     * });
     * ```
     */
    exists(): Promise<ExistsResponse>;
    exists(callback: ExistsCallback): void;
    /**
     * @typedef {array} GetSubscriptionResponse
     * @property {Subscription} 0 The {@link Subscription}.
     * @property {object} 1 The full API response.
     */
    /**
     * @callback GetSubscriptionCallback
     * @param {?Error} err Request error, if any.
     * @param {Subscription} subscription The {@link Subscription}.
     * @param {object} apiResponse The full API response.
     */
    /**
     * Get a subscription if it exists.
     *
     * @param {object} [gaxOpts] Request configuration options, outlined
     *     here: https://googleapis.github.io/gax-nodejs/interfaces/CallOptions.html.
     * @param {boolean} [gaxOpts.autoCreate=false] Automatically create the
     *     subscription if it does not already exist.
     * @param {GetSubscriptionCallback} [callback] Callback function.
     * @returns {Promise<GetSubscriptionResponse>}
     *
     * @example
     * ```
     * const {PubSub} = require('@google-cloud/pubsub');
     * const pubsub = new PubSub();
     *
     * const topic = pubsub.topic('my-topic');
     * const subscription = topic.subscription('my-subscription');
     *
     * subscription.get((err, subscription, apiResponse) => {
     *   // The `subscription` data has been populated.
     * });
     *
     * //-
     * // If the callback is omitted, we'll return a Promise.
     * //-
     * subscription.get().then((data) => {
     *   const subscription = data[0];
     *   const apiResponse = data[1];
     * });
     * ```
     */
    get(gaxOpts?: GetSubscriptionOptions): Promise<GetSubscriptionResponse>;
    get(callback: GetSubscriptionCallback): void;
    get(gaxOpts: GetSubscriptionOptions, callback: GetSubscriptionCallback): void;
    /**
     * @typedef {array} GetSubscriptionMetadataResponse
     * @property {object} 0 The full API response.
     */
    /**
     * @callback GetSubscriptionMetadataCallback
     * @param {?Error} err Request error, if any.
     * @param {object} apiResponse The full API response.
     */
    /**
     * Fetches the subscriptions metadata.
     *
     * @param {object} [gaxOpts] Request configuration options, outlined
     *     here: https://googleapis.github.io/gax-nodejs/interfaces/CallOptions.html.
     * @param {GetSubscriptionMetadataCallback} [callback] Callback function.
     * @returns {Promise<GetSubscriptionMetadataResponse>}
     *
     * @example
     * ```
     * const {PubSub} = require('@google-cloud/pubsub');
     * const pubsub = new PubSub();
     *
     * const topic = pubsub.topic('my-topic');
     * const subscription = topic.subscription('my-subscription');
     *
     * subscription.getMetadata((err, apiResponse) => {
     *   if (err) {
     *     // Error handling omitted.
     *   }
     * });
     *
     * //-
     * // If the callback is omitted, we'll return a Promise.
     * //-
     * subscription.getMetadata().then((data) => {
     *   const apiResponse = data[0];
     * });
     * ```
     */
    getMetadata(gaxOpts?: CallOptions): Promise<GetSubscriptionMetadataResponse>;
    getMetadata(callback: GetSubscriptionMetadataCallback): void;
    getMetadata(gaxOpts: CallOptions, callback: GetSubscriptionMetadataCallback): void;
    /**
     * @typedef {array} ModifyPushConfigResponse
     * @property {object} 0 The full API response.
     */
    /**
     * @callback ModifyPushConfigCallback
     * @param {?Error} err Request error, if any.
     * @param {object} apiResponse The full API response.
     */
    /**
     * Modify the push config for the subscription.
     *
     * @param {object} config The push config.
     * @param {string} config.pushEndpoint A URL locating the endpoint to which
     *     messages should be published.
     * @param {object} config.attributes [PushConfig attributes](https://cloud.google.com/pubsub/docs/reference/rpc/google.pubsub.v1#google.pubsub.v1.PushConfig).
     * @param {object} config.oidcToken If specified, Pub/Sub will generate and
     *     attach an OIDC JWT token as an `Authorization` header in the HTTP
     *     request for every pushed message. This object should have the same
     *     structure as [OidcToken]{@link google.pubsub.v1.OidcToken}
     * @param {object} [gaxOpts] Request configuration options, outlined
     *     here: https://googleapis.github.io/gax-nodejs/interfaces/CallOptions.html.
     * @param {ModifyPushConfigCallback} [callback] Callback function.
     * @returns {Promise<ModifyPushConfigResponse>}
     *
     * @example
     * ```
     * const {PubSub} = require('@google-cloud/pubsub');
     * const pubsub = new PubSub();
     *
     * const topic = pubsub.topic('my-topic');
     * const subscription = topic.subscription('my-subscription');
     *
     * const pushConfig = {
     *   pushEndpoint: 'https://mydomain.com/push',
     *   attributes: {
     *     key: 'value'
     *   },
     *   oidcToken: {
     *     serviceAccountEmail: 'myproject@appspot.gserviceaccount.com',
     *     audience: 'myaudience'
     *   }
     * };
     *
     * subscription.modifyPushConfig(pushConfig, (err, apiResponse) => {
     *   if (err) {
     *     // Error handling omitted.
     *   }
     * });
     *
     * //-
     * // If the callback is omitted, we'll return a Promise.
     * //-
     * subscription.modifyPushConfig(pushConfig).then((data) => {
     *   const apiResponse = data[0];
     * });
     * ```
     */
    modifyPushConfig(config: PushConfig, gaxOpts?: CallOptions): Promise<EmptyResponse>;
    modifyPushConfig(config: PushConfig, callback: EmptyCallback): void;
    modifyPushConfig(config: PushConfig, gaxOpts: CallOptions, callback: EmptyCallback): void;
    /**
     * Opens the Subscription to receive messages. In general this method
     * shouldn't need to be called, unless you wish to receive messages after
     * calling {@link Subscription#close}. Alternatively one could just assign a
     * new `message` event listener which will also re-open the Subscription.
     *
     * @example
     * ```
     * subscription.on('message', message => message.ack());
     *
     * // Close the subscription.
     * subscription.close(err => {
     *   if (err) {
     *     // Error handling omitted.
     *   }
     *
     *   The subscription has been closed and messages will no longer be received.
     * });
     *
     * // Resume receiving messages.
     * subscription.open();
     * ```
     */
    open(): void;
    /**
     * @typedef {array} SeekResponse
     * @property {object} 0 The full API response.
     */
    /**
     * @callback SeekCallback
     * @param {?Error} err Request error, if any.
     * @param {object} apiResponse The full API response.
     */
    /**
     * Seeks an existing subscription to a point in time or a given snapshot.
     *
     * @param {string|date} snapshot The point to seek to. This will accept the
     *     name of the snapshot or a Date object.
     * @param {object} [gaxOpts] Request configuration options, outlined
     *     here: https://googleapis.github.io/gax-nodejs/interfaces/CallOptions.html.
     * @param {SeekCallback} [callback] Callback function.
     * @returns {Promise<SeekResponse>}
     *
     * @example
     * ```
     * const callback = (err, resp) => {
     *   if (!err) {
     *     // Seek was successful.
     *   }
     * };
     *
     * subscription.seek('my-snapshot', callback);
     *
     * //-
     * // Alternatively, to specify a certain point in time, you can provide a
     * Date
     * // object.
     * //-
     * const date = new Date('October 21 2015');
     *
     * subscription.seek(date, callback);
     * ```
     */
    seek(snapshot: string | Date, gaxOpts?: CallOptions): Promise<SeekResponse>;
    seek(snapshot: string | Date, callback: SeekCallback): void;
    seek(snapshot: string | Date, gaxOpts: CallOptions, callback: SeekCallback): void;
    /**
     * @typedef {array} SetSubscriptionMetadataResponse
     * @property {object} 0 The full API response.
     */
    /**
     * @callback SetSubscriptionMetadataCallback
     * @param {?Error} err Request error, if any.
     * @param {object} apiResponse The full API response.
     */
    /**
     * Update the subscription object.
     *
     * @param {object} metadata The subscription metadata.
     * @param {object} [gaxOpts] Request configuration options, outlined
     *     here: https://googleapis.github.io/gax-nodejs/interfaces/CallOptions.html.
     * @param {SetSubscriptionMetadataCallback} [callback] Callback function.
     * @returns {Promise<SetSubscriptionMetadataResponse>}
     *
     * @example
     * ```
     * const metadata = {
     *   key: 'value'
     * };
     *
     * subscription.setMetadata(metadata, (err, apiResponse) => {
     *   if (err) {
     *     // Error handling omitted.
     *   }
     * });
     *
     * //-
     * // If the callback is omitted, we'll return a Promise.
     * //-
     * subscription.setMetadata(metadata).then((data) => {
     *   const apiResponse = data[0];
     * });
     * ```
     */
    setMetadata(metadata: SubscriptionMetadata, gaxOpts?: CallOptions): Promise<SetSubscriptionMetadataResponse>;
    setMetadata(metadata: SubscriptionMetadata, callback: SetSubscriptionMetadataCallback): void;
    setMetadata(metadata: SubscriptionMetadata, gaxOpts: CallOptions, callback: SetSubscriptionMetadataCallback): void;
    /**
     * Sets the Subscription options.
     *
     * @param {SubscriberOptions} options The options.
     */
    setOptions(options: SubscriberOptions): void;
    /**
     * Create a Snapshot object. See {@link Subscription#createSnapshot} to
     * create a snapshot.
     *
     * @throws {Error} If a name is not provided.
     *
     * @param {string} name The name of the snapshot.
     * @returns {Snapshot}
     *
     * @example
     * ```
     * const snapshot = subscription.snapshot('my-snapshot');
     * ```
     */
    snapshot(name: string): Snapshot;
    /**
     * Watches for incoming message event handlers and open/closes the
     * subscriber as needed.
     *
     * @private
     */
    private _listen;
    /*!
     * Formats Subscription metadata.
     *
     * @private
     */
    static formatMetadata_(metadata: SubscriptionMetadata): google.pubsub.v1.ISubscription;
    /*!
     * Format the name of a subscription. A subscription's full name is in the
     * format of projects/{projectId}/subscriptions/{subName}.
     *
     * @private
     */
    static formatName_(projectId: string, name: string): string;
}
