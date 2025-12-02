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
import { GoogleAuth } from 'google-auth-library';
import * as gax from 'google-gax';
import { Schema, SchemaType, ISchema, SchemaView } from './schema';
import { Snapshot } from './snapshot';
import { Subscription, SubscriptionOptions, CreateSubscriptionOptions, CreateSubscriptionCallback, CreateSubscriptionResponse, DetachSubscriptionCallback, DetachSubscriptionResponse } from './subscription';
import { Topic, GetTopicSubscriptionsCallback, GetTopicSubscriptionsResponse, CreateTopicCallback, CreateTopicResponse, TopicMetadata } from './topic';
import { PublishOptions } from './publisher';
import { CallOptions } from 'google-gax';
import { Transform } from 'stream';
import { google } from '../protos/protos';
import { SchemaServiceClient } from './v1';
export type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;
export interface ClientConfig extends gax.GrpcClientOptions {
    apiEndpoint?: string;
    /**
     * Configures the emulator mode behaviour:
     * - If false, disable emulator mode always
     * - If true, enable emulator mode always
     * - If unset, use heuristics to decide
     * Emulator mode notably sets insecure SSL authentication so that you can
     * try the library out without needing a cert.
     *
     * Also notably, if a TPC universeDomain is set, then this will be counted
     * as !emulatorMode for the purposes of the heuristics. If you want emulator
     * mode but with a TPC universe domain set, set this to true as well.
     */
    emulatorMode?: boolean;
    servicePath?: string;
    port?: string | number;
    sslCreds?: gax.grpc.ChannelCredentials;
    /**
     * Enables OpenTelemetry tracing (newer, more full implementation). This
     * defaults to false/undefined
     */
    enableOpenTelemetryTracing?: boolean;
}
export interface PageOptions {
    gaxOpts?: CallOptions;
    pageSize?: number;
    pageToken?: string;
    autoPaginate?: boolean;
}
export type GetSnapshotsCallback = RequestCallback<Snapshot, google.pubsub.v1.IListSnapshotsResponse>;
export type GetSnapshotsResponse = PagedResponse<Snapshot, google.pubsub.v1.IListSnapshotsResponse>;
export type GetSubscriptionsOptions = PageOptions & {
    topic?: string | Topic;
};
type GetAllSubscriptionsCallback = RequestCallback<Subscription, google.pubsub.v1.IListSubscriptionsResponse>;
type GetAllSubscriptionsResponse = PagedResponse<Subscription, google.pubsub.v1.IListSubscriptionsResponse>;
export type GetSubscriptionsCallback = GetAllSubscriptionsCallback | GetTopicSubscriptionsCallback;
export type GetSubscriptionsResponse = GetAllSubscriptionsResponse | GetTopicSubscriptionsResponse;
export type GetTopicsCallback = RequestCallback<Topic, google.pubsub.v1.IListTopicsResponse>;
export type GetTopicsResponse = PagedResponse<Topic, google.pubsub.v1.IListTopicsResponse>;
export type EmptyCallback = RequestCallback<google.protobuf.IEmpty>;
export type EmptyResponse = [google.protobuf.IEmpty];
export type ExistsCallback = RequestCallback<boolean>;
export type ExistsResponse = [boolean];
export type DetachedCallback = RequestCallback<boolean>;
export type DetachedResponse = [boolean];
export interface GetClientConfig {
    client: 'PublisherClient' | 'SubscriberClient';
}
export interface RequestConfig extends GetClientConfig {
    method: string;
    reqOpts?: object;
    gaxOpts?: CallOptions;
}
export interface ResourceCallback<Resource, Response> {
    (err: gax.grpc.ServiceError | null, resource?: Resource | null, response?: Response | null): void;
}
export type RequestCallback<T, R = void> = R extends void ? NormalCallback<T> : PagedCallback<T, R>;
export interface NormalCallback<TResponse> {
    (err: gax.grpc.ServiceError | null, res?: TResponse | null): void;
}
export interface PagedCallback<Item, Response> {
    (err: gax.grpc.ServiceError | null, results?: Item[] | null, nextQuery?: {} | null, response?: Response | null): void;
}
export type PagedResponse<Item, Response> = [Item[]] | [Item[], {} | null, Response];
export type ObjectStream<O> = {
    addListener(event: 'data', listener: (data: O) => void): ObjectStream<O>;
    emit(event: 'data', data: O): boolean;
    on(event: 'data', listener: (data: O) => void): ObjectStream<O>;
    once(event: 'data', listener: (data: O) => void): ObjectStream<O>;
    prependListener(event: 'data', listener: (data: O) => void): ObjectStream<O>;
    prependOnceListener(event: 'data', listener: (data: O) => void): ObjectStream<O>;
} & Transform;
interface GetClientCallback {
    (err: Error | null, gaxClient?: gax.ClientStub): void;
}
/**
 * @typedef {object} ClientConfig
 * @property {string} [projectId] The project ID from the Google Developer's
 *     Console, e.g. 'grape-spaceship-123'. We will also check the environment
 *     variable `GCLOUD_PROJECT` for your project ID. If your app is running in
 *     an environment which supports {@link
 * https://cloud.google.com/docs/authentication/production#providing_credentials_to_your_application
 * Application Default Credentials}, your project ID will be detected
 * automatically.
 * @property {string} [keyFilename] Full path to the a .json, .pem, or .p12 key
 *     downloaded from the Google Developers Console. If you provide a path to a
 *     JSON file, the `projectId` option above is not necessary. NOTE: .pem and
 *     .p12 require you to specify the `email` option as well.
 * @property {string} [apiEndpoint] The `apiEndpoint` from options will set the
 *     host. If not set, the `PUBSUB_EMULATOR_HOST` environment variable from the
 *     gcloud SDK is honored. We also check the `CLOUD_API_ENDPOINT_OVERRIDES_PUBSUB`
 *     environment variable used by `gcloud alpha pubsub`. Otherwise the actual API
 *     endpoint will be used. Note that if the URL doesn't end in '.googleapis.com',
 *     we will assume that it's an emulator and disable strict SSL checks.
 * @property {string} [email] Account email address. Required when using a .pem
 *     or .p12 keyFilename.
 * @property {object} [credentials] Credentials object.
 * @property {string} [credentials.client_email]
 * @property {string} [credentials.private_key]
 * @property {boolean} [autoRetry=true] Automatically retry requests if the
 *     response is related to rate limits or certain intermittent server errors.
 *     We will exponentially backoff subsequent requests by default.
 * @property {Constructor} [promise] Custom promise module to use instead of
 *     native Promises.
 */
/**
 * [Cloud Pub/Sub](https://developers.google.com/pubsub/overview) is a
 * reliable, many-to-many, asynchronous messaging service from Cloud
 * Platform.
 *
 * @class
 *
 * @see [Cloud Pub/Sub overview]{@link https://developers.google.com/pubsub/overview}
 *
 * @param {ClientConfig} [options] Configuration options.
 *
 * @example Import the client library
 * ```
 * const {PubSub} = require('@google-cloud/pubsub');
 *
 * ```
 * @example Create a client that uses <a href="https://cloud.google.com/docs/authentication/production#providing_credentials_to_your_application">Application Default Credentials (ADC)</a>:
 * ```
 * const pubsub = new PubSub();
 *
 * ```
 * @example Create a client with <a href="https://cloud.google.com/docs/authentication/production#obtaining_and_providing_service_account_credentials_manually">explicit credentials</a>:
 * ```
 * const pubsub = new PubSub({
 *   projectId: 'your-project-id',
 *   keyFilename: '/path/to/keyfile.json'
 * });
 *
 * ```
 * @example <caption>include:samples/quickstart.js</caption>
 * region_tag:pubsub_quickstart_create_topic
 * Full quickstart example:
 */
export declare class PubSub {
    options: ClientConfig;
    isEmulator: boolean;
    api: {
        [key: string]: gax.ClientStub;
    };
    auth: GoogleAuth;
    projectId: string;
    name?: string;
    Promise?: PromiseConstructor;
    getSubscriptionsStream: () => ObjectStream<Subscription>;
    getSnapshotsStream: () => ObjectStream<Snapshot>;
    getTopicsStream: () => ObjectStream<Topic>;
    isOpen: boolean;
    private schemaClient?;
    constructor(options?: ClientConfig);
    /**
     * Returns true if we have actually resolved the full project name.
     *
     * @returns {boolean} true if the name is resolved.
     */
    get isIdResolved(): boolean;
    /**
     * Closes the PubSub client, releasing any underlying gRPC connections.
     *
     * Note that once you close a PubSub object, it may not be used again. Any pending
     * operations (e.g. queued publish messages) will fail. If you have topic or
     * subscription objects that may have pending operations, you should call close()
     * on those first if you want any pending messages to be delivered correctly. The
     * PubSub class doesn't track those.
  
     * Note that this method primarily closes the gRPC clients (Publisher and Subscriber)
     * used for API requests. It does **not** automatically handle the graceful shutdown
     * of active subscriptions.
     *
     * For graceful shutdown of subscriptions with specific timeout behavior (e.g.,
     * ensuring buffered messages are nacked before closing), please refer to the
     * {@link Subscription#close} method. It is recommended to call
     * `Subscription.close({timeout: ...})` directly on your active `Subscription`
     * objects *before* calling `PubSub.close()` if you require that specific
     * shutdown behavior.
     *
     * Calling `PubSub.close()` without first closing active subscriptions might
     * result in abrupt termination of message processing for those subscriptions.
     * Any pending operations on associated Topic or Subscription objects (e.g.,
     * queued publish messages or unacked subscriber messages) may fail after
     * `PubSub.close()` is called.
     *
     * @callback EmptyCallback
     * @param {Error} [err] Request error, if any.
     * @returns {Promise<void>} Resolves when the clients are closed.
     */
    close(): Promise<void>;
    close(callback: EmptyCallback): void;
    /**
     * Create a schema in the project.
     *
     * @see [Schemas: create API Documentation]{@link https://cloud.google.com/pubsub/docs/reference/rest/v1/projects.schemas/create}
     * @see {@link Schema#create}
     *
     * @throws {Error} If a schema ID or name is not provided.
     * @throws {Error} If an invalid SchemaType is provided.
     * @throws {Error} If an invalid schema definition is provided.
     *
     * @param {string} schemaId The name or ID of the subscription.
     * @param {SchemaType} type The type of the schema (Protobuf, Avro, etc).
     * @param {string} definition The text describing the schema in terms of the type.
     * @param {object} [options] Request configuration options, outlined
     *   here: https://googleapis.github.io/gax-nodejs/interfaces/CallOptions.html.
     * @returns {Promise<Schema>}
     *
     * @example Create a schema.
     * ```
     * const {PubSub} = require('@google-cloud/pubsub');
     * const pubsub = new PubSub();
     *
     * await pubsub.createSchema(
     *   'messageType',
     *   SchemaTypes.Avro,
     *   '{...avro definition...}'
     * );
     * ```
     */
    createSchema(schemaId: string, type: SchemaType, definition: string, gaxOpts?: CallOptions): Promise<Schema>;
    /**
     * @typedef {array} CreateSubscriptionResponse
     * @property {Subscription} 0 The new {@link Subscription}.
     * @property {object} 1 The full API response.
     */
    /**
     * @callback CreateSubscriptionCallback
     * @param {?Error} err Request error, if any.
     * @param {Subscription} Subscription
     * @param {object} apiResponse The full API response.
     */
    /**
     * Options for creating a subscription.
     *
     * See a [Subscription
     * resource](https://cloud.google.com/pubsub/docs/reference/rest/v1/projects.subscriptions).
     *
     * @typedef {object} CreateSubscriptionRequest
     * @property {DeadLetterPolicy} [deadLetterPolicy] A policy that specifies the
     *     conditions for dead lettering messages in this subscription.
     * @property {object} [flowControl] Flow control configurations for
     *     receiving messages. Note that these options do not persist across
     *     subscription instances.
     * @property {number} [flowControl.maxBytes] The maximum number of bytes
     *     in un-acked messages to allow before the subscription pauses incoming
     *     messages. Defaults to 20% of free memory.
     * @property {number} [flowControl.maxMessages=Infinity] The maximum number
     *     of un-acked messages to allow before the subscription pauses incoming
     *     messages.
     * @property {object} [gaxOpts] Request configuration options, outlined
     *     here: https://googleapis.github.io/gax-nodejs/interfaces/CallOptions.html.
     * @property {number|google.protobuf.Duration} [messageRetentionDuration] Set
     *     this to override the default duration of 7 days. This value is expected
     *     in seconds. Acceptable values are in the range of 10 minutes and 7
     *     days.
     * @property {string} [pushEndpoint] A URL to a custom endpoint that
     *     messages should be pushed to.
     * @property {object} [oidcToken] If specified, Pub/Sub will generate and
     *     attach an OIDC JWT token as an `Authorization` header in the HTTP
     *     request for every pushed message. This object should have the same
     *     structure as [OidcToken]{@link google.pubsub.v1.OidcToken}
     * @property {boolean} [retainAckedMessages=false] If set, acked messages
     *     are retained in the subscription's backlog for the length of time
     *     specified by `options.messageRetentionDuration`.
     * @property {ExpirationPolicy} [expirationPolicy] A policy that specifies
     *     the conditions for this subscription's expiration.
     */
    /**
     * Create a subscription to a topic.
     *
     * @see [Subscriptions: create API Documentation]{@link https://cloud.google.com/pubsub/docs/reference/rest/v1/projects.subscriptions/create}
     * @see {@link Topic#createSubscription}
     *
     * @throws {Error} If a Topic instance or topic name is not provided.
     * @throws {Error} If a subscription name is not provided.
     *
     * @param {Topic|string} topic The Topic to create a subscription to.
     * @param {string} name The name of the subscription.
     * @param {CreateSubscriptionRequest} [options] See a [Subscription resource](https://cloud.google.com/pubsub/docs/reference/rest/v1/projects.subscriptions).
     * @param {CreateSubscriptionCallback} [callback] Callback function.
     * @returns {Promise<CreateSubscriptionResponse>}
     *
     * @example Subscribe to a topic.
     * ```
     * const {PubSub} = require('@google-cloud/pubsub');
     * const pubsub = new PubSub();
     *
     * const topic = 'messageCenter';
     * const name = 'newMessages';
     *
     * const callback = function(err, subscription, apiResponse) {};
     *
     * pubsub.createSubscription(topic, name, callback);
     *
     * ```
     * @example If the callback is omitted, we'll return a Promise.
     * ```
     * pubsub.createSubscription(topic, name)
     *   .then(function(data) {
     *     const subscription = data[0];
     *     const apiResponse = data[1];
     *   });
     * ```
     */
    createSubscription(topic: Topic | string, name: string, options?: CreateSubscriptionOptions): Promise<CreateSubscriptionResponse>;
    createSubscription(topic: Topic | string, name: string, callback: CreateSubscriptionCallback): void;
    createSubscription(topic: Topic | string, name: string, options: CreateSubscriptionOptions, callback: CreateSubscriptionCallback): void;
    /**
     * @typedef {array} CreateTopicResponse
     * @property {Topic} 0 The new {@link Topic}.
     * @property {object} 1 The full API response.
     */
    /**
     * @callback CreateTopicCallback
     * @param {?Error} err Request error, if any.
     * @param {Topic} topic The new {@link Topic}.
     * @param {object} apiResponse The full API response.
     */
    /**
     * Create a topic with the given name.
     *
     * @see [Topics: create API Documentation]{@link https://cloud.google.com/pubsub/docs/reference/rest/v1/projects.topics/create}
     *
     * @param {string} name Name of the topic.
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
     * pubsub.createTopic('my-new-topic', function(err, topic, apiResponse) {
     *   if (!err) {
     *     // The topic was created successfully.
     *   }
     * });
     *
     * //-
     * // If the callback is omitted, we'll return a Promise.
     * //-
     * pubsub.createTopic('my-new-topic').then(function(data) {
     *   const topic = data[0];
     *   const apiResponse = data[1];
     * });
     * ```
     */
    createTopic(name: string | TopicMetadata, gaxOpts?: CallOptions): Promise<CreateTopicResponse>;
    createTopic(name: string | TopicMetadata, callback: CreateTopicCallback): void;
    createTopic(name: string | TopicMetadata, gaxOpts: CallOptions, callback: CreateTopicCallback): void;
    /**
     * Detach a subscription with the given name.
     *
     * @see [Admin: Pub/Sub administration API Documentation]{@link https://cloud.google.com/pubsub/docs/admin}
     *
     * @param {string} name Name of the subscription.
     * @param {object} [gaxOpts] Request configuration options, outlined
     *     here: https://googleapis.github.io/gax-nodejs/interfaces/CallOptions.html.
     * @param {DetachSubscriptionCallback} [callback] Callback function.
     * @returns {Promise<DetachSubscriptionResponse>}
     *
     * @example
     * ```
     * const {PubSub} = require('@google-cloud/pubsub');
     * const pubsub = new PubSub();
     *
     * pubsub.detachSubscription('my-sub', (err, topic, apiResponse) => {
     *   if (!err) {
     *     // The topic was created successfully.
     *   }
     * });
     *
     * //-
     * // If the callback is omitted, we'll return a Promise.
     * //-
     * pubsub.detachSubscription('my-sub').then(data => {
     *   const apiResponse = data[0];
     * });
     * ```
     */
    detachSubscription(name: string, gaxOpts?: CallOptions): Promise<DetachSubscriptionResponse>;
    detachSubscription(name: string, callback: DetachSubscriptionCallback): void;
    detachSubscription(name: string, gaxOpts: CallOptions, callback: DetachSubscriptionCallback): void;
    /**
     * Determine the appropriate endpoint to use for API requests, first trying
     * the `apiEndpoint` parameter. If that isn't set, we try the Pub/Sub emulator
     * environment variable (PUBSUB_EMULATOR_HOST). If that is also null, we try
     * the standard `gcloud alpha pubsub` environment variable
     * (CLOUDSDK_API_ENDPOINT_OVERRIDES_PUBSUB). Otherwise the default production
     * API is used.
     *
     * Note that if the URL doesn't end in '.googleapis.com', we will assume that
     * it's an emulator and disable strict SSL checks.
     *
     * @private
     */
    determineBaseUrl_(): void;
    /**
     * Get a list of schemas associated with your project.
     *
     * The returned AsyncIterable will resolve to {@link google.pubsub.v1.ISchema} objects.
     *
     * This method returns an async iterable. These objects can be adapted
     * to work in a Promise/then framework, as well as with callbacks, but
     * this discussion is considered out of scope for these docs.
     *
     * @see [Schemas: list API Documentation]{@link https://cloud.google.com/pubsub/docs/reference/rest/v1/projects.schemas/list}
     * @see [More about async iterators]{@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/for-await...of}
     *
     * @param {google.pubsub.v1.SchemaView} [view] The type of schema objects
     *   requested, which should be an enum value from {@link SchemaViews}. Defaults
     *   to Full.
     * @param {object} [options] Request configuration options, outlined
     *   here: https://googleapis.github.io/gax-nodejs/interfaces/CallOptions.html.
     * @returns {AsyncIterable<ISchema>}
     *
     * @example
     * ```
     * for await (const s of pubsub.listSchemas()) {
     *   const moreInfo = await s.get();
     * }
     * ```
     */
    listSchemas(view?: SchemaView, options?: CallOptions): AsyncIterable<google.pubsub.v1.ISchema>;
    /**
     * Query object for listing snapshots.
     *
     * @typedef {object} GetSnapshotsRequest
     * @property {boolean} [autoPaginate=true] Have pagination handled
     *     automatically.
     * @property {object} [options.gaxOpts] Request configuration options, outlined
     *     here: https://googleapis.github.io/gax-nodejs/interfaces/CallOptions.html.
     * @property {number} [options.pageSize] Maximum number of results to return.
     * @property {string} [options.pageToken] Page token.
     */
    /**
     * @typedef {array} GetSnapshotsResponse
     * @property {Snapshot[]} 0 Array of {@link Snapshot} instances.
     * @property {object} 1 The full API response.
     */
    /**
     * @callback GetSnapshotsCallback
     * @param {?Error} err Request error, if any.
     * @param {Snapshot[]} snapshots Array of {@link Snapshot} instances.
     * @param {object} apiResponse The full API response.
     */
    /**
     * Get a list of snapshots.
     *
     * @param {GetSnapshotsRequest} [query] Query object for listing snapshots.
     * @param {GetSnapshotsCallback} [callback] Callback function.
     * @returns {Promise<GetSnapshotsResponse>}
     *
     * @example
     * ```
     * const {PubSub} = require('@google-cloud/pubsub');
     * const pubsub = new PubSub();
     *
     * pubsub.getSnapshots(function(err, snapshots) {
     *   if (!err) {
     *     // snapshots is an array of Snapshot objects.
     *   }
     * });
     *
     * //-
     * // If the callback is omitted, we'll return a Promise.
     * //-
     * pubsub.getSnapshots().then(function(data) {
     *   const snapshots = data[0];
     * });
     * ```
     */
    getSnapshots(options?: PageOptions): Promise<GetSnapshotsResponse>;
    getSnapshots(callback: GetSnapshotsCallback): void;
    getSnapshots(options: PageOptions, callback: GetSnapshotsCallback): void;
    /**
     * Query object for listing subscriptions.
     *
     * @typedef {object} GetSubscriptionsRequest
     * @property {boolean} [autoPaginate=true] Have pagination handled
     *     automatically.
     * @property {object} [options.gaxOpts] Request configuration options, outlined
     *     here: https://googleapis.github.io/gax-nodejs/interfaces/CallOptions.html.
     * @property {number} [options.pageSize] Maximum number of results to return.
     * @property {string} [options.pageToken] Page token.
     * @param {string|Topic} options.topic - The name of the topic to
     *     list subscriptions from.
     */
    /**
     * @typedef {array} GetSubscriptionsResponse
     * @property {Subscription[]} 0 Array of {@link Subscription} instances.
     * @property {object} 1 The full API response.
     */
    /**
     * @callback GetSubscriptionsCallback
     * @param {?Error} err Request error, if any.
     * @param {Subscription[]} subscriptions Array of {@link Subscription} instances.
     * @param {object} apiResponse The full API response.
     */
    /**
     * Get a list of the subscriptions registered to all of your project's topics.
     * You may optionally provide a query object as the first argument to
     * customize the response.
     *
     * Your provided callback will be invoked with an error object if an API error
     * occurred or an array of {@link Subscription} objects.
     *
     * To get subscriptions for a topic, see {@link Topic}.
     *
     * @see [Subscriptions: list API Documentation]{@link https://cloud.google.com/pubsub/docs/reference/rest/v1/projects.subscriptions/list}
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
     * pubsub.getSubscriptions(function(err, subscriptions) {
     *   if (!err) {
     *     // subscriptions is an array of Subscription objects.
     *   }
     * });
     *
     * //-
     * // If the callback is omitted, we'll return a Promise.
     * //-
     * pubsub.getSubscriptions().then(function(data) {
     *   const subscriptions = data[0];
     * });
     * ```
     */
    getSubscriptions(options?: GetSubscriptionsOptions): Promise<GetSubscriptionsResponse>;
    getSubscriptions(callback: GetSubscriptionsCallback): void;
    getSubscriptions(options: GetSubscriptionsOptions, callback: GetSubscriptionsCallback): void;
    /**
     * Query object for listing topics.
     *
     * @typedef {object} GetTopicsRequest
     * @property {boolean} [autoPaginate=true] Have pagination handled
     *     automatically.
     * @property {object} [options.gaxOpts] Request configuration options, outlined
     *     here: https://googleapis.github.io/gax-nodejs/interfaces/CallOptions.html.
     * @property {number} [options.pageSize] Maximum number of results to return.
     * @property {string} [options.pageToken] Page token.
     */
    /**
     * @typedef {array} GetTopicsResponse
     * @property {Topic[]} 0 Array of {@link Topic} instances.
     * @property {object} 1 The full API response.
     */
    /**
     * @callback GetTopicsCallback
     * @param {?Error} err Request error, if any.
     * @param {Topic[]} topics Array of {@link Topic} instances.
     * @param {object} apiResponse The full API response.
     */
    /**
     * Get a list of the topics registered to your project. You may optionally
     * provide a query object as the first argument to customize the response.
     *
     * @see [Topics: list API Documentation]{@link https://cloud.google.com/pubsub/docs/reference/rest/v1/projects.topics/list}
     *
     * @param {GetTopicsRequest} [query] Query object for listing topics.
     * @param {GetTopicsCallback} [callback] Callback function.
     * @returns {Promise<GetTopicsResponse>}
     *
     * @example
     * ```
     * const {PubSub} = require('@google-cloud/pubsub');
     * const pubsub = new PubSub();
     *
     * pubsub.getTopics(function(err, topics) {
     *   if (!err) {
     *     // topics is an array of Topic objects.
     *   }
     * });
     *
     * //-
     * // Customize the query.
     * //-
     * pubsub.getTopics({
     *   pageSize: 3
     * }, function(err, topics) {});
     *
     * //-
     * // If the callback is omitted, we'll return a Promise.
     * //-
     * pubsub.getTopics().then(function(data) {
     *   const topics = data[0];
     * });
     * ```
     */
    getTopics(options?: PageOptions): Promise<GetTopicsResponse>;
    getTopics(callback: GetTopicsCallback): void;
    getTopics(options: PageOptions, callback: GetTopicsCallback): void;
    /**
     * Retrieve a client configuration, suitable for passing into a GAPIC
     * 'v1' class constructor. This will fill out projectId, emulator URLs,
     * and so forth.
     *
     * @returns {Promise<ClientConfig>} the filled client configuration.
     */
    getClientConfig(): Promise<ClientConfig>;
    /**
     * Gets a schema client, creating one if needed. This is a shortcut for
     * `new v1.SchemaServiceClient(await pubsub.getClientConfig())`.
     *
     * @returns {Promise<SchemaServiceClient>}
     */
    getSchemaClient(): Promise<SchemaServiceClient>;
    /**
     * Callback function to PubSub.getClient_().
     * @private
     * @callback GetClientCallback
     * @param err - Error, if any.
     * @param gaxClient - The gax client specified in RequestConfig.client.
     *                    Typed any since it's importing Javascript source.
     */
    /**
     * Get the PubSub client object.
     *
     * @private
     *
     * @param {object} config Configuration object.
     * @param {object} config.gaxOpts GAX options.
     * @param {function} config.method The gax method to call.
     * @param {object} config.reqOpts Request options.
     * @param {function} [callback] The callback function.
     */
    getClient_(config: GetClientConfig, callback: GetClientCallback): void;
    /**
     * Get the PubSub client object.
     *
     * @private
     *
     * @param {object} config Configuration object.
     * @param {object} config.gaxOpts GAX options.
     * @param {function} config.method The gax method to call.
     * @param {object} config.reqOpts Request options.
     * @returns {Promise}
     */
    getClientAsync_(config: GetClientConfig): Promise<gax.ClientStub>;
    /**
     * Close all open client objects.
     *
     * @private
     *
     * @returns {Promise}
     */
    closeAllClients_(): Promise<void>;
    /**
     * Funnel all API requests through this method, to be sure we have a project
     * ID.
     *
     * @private
     *
     * @param {object} config Configuration object.
     * @param {object} config.gaxOpts GAX options.
     * @param {function} config.method The gax method to call.
     * @param {object} config.reqOpts Request options.
     * @param {function} [callback] The callback function.
     */
    request<T, R = void>(config: RequestConfig, callback: RequestCallback<T, R>): void;
    /**
     * Create a Schema object, representing a schema within the project.
     * See {@link PubSub#createSchema} or {@link Schema#create} to create a schema.
     *
     * @throws {Error} If a name is not provided.
     *
     * @param {string} name The ID or name of the schema.
     * @returns {Schema} A {@link Schema} instance.
     *
     * @example
     * ```
     * const {PubSub} = require('@google-cloud/pubsub');
     * const pubsub = new PubSub();
     *
     * const schema = pubsub.schema('my-schema');
     * ```
     */
    schema(idOrName: string): Schema;
    /**
     * Create a Snapshot object. See {@link Subscription#createSnapshot} to
     * create a snapshot.
     *
     * @throws {Error} If a name is not provided.
     *
     * @param {string} name The name of the snapshot.
     * @returns {Snapshot} A {@link Snapshot} instance.
     *
     * @example
     * ```
     * const {PubSub} = require('@google-cloud/pubsub');
     * const pubsub = new PubSub();
     *
     * const snapshot = pubsub.snapshot('my-snapshot');
     * ```
     */
    snapshot(name: string): Snapshot;
    /**
     * Create a Subscription object. This command by itself will not run any API
     * requests. You will receive a {@link Subscription} object,
     * which will allow you to interact with a subscription.
     *
     * @throws {Error} If subscription name is omitted.
     *
     * @param {string} name Name of the subscription.
     * @param {SubscriberOptions} [options] Configuration object.
     * @returns {Subscription} A {@link Subscription} instance.
     *
     * @example
     * ```
     * const {PubSub} = require('@google-cloud/pubsub');
     * const pubsub = new PubSub();
     *
     * const subscription = pubsub.subscription('my-subscription');
     *
     * // Register a listener for `message` events.
     * subscription.on('message', function(message) {
     *   // Called every time a message is received.
     *   // message.id = ID of the message.
     *   // message.ackId = ID used to acknowledge the message receival.
     *   // message.data = Contents of the message.
     *   // message.attributes = Attributes of the message.
     *   // message.publishTime = Date when Pub/Sub received the message.
     * });
     * ```
     */
    subscription(name: string, options?: SubscriptionOptions): Subscription;
    /**
     * Create a Topic object. See {@link PubSub#createTopic} to create a topic.
     *
     * @throws {Error} If a name is not provided.
     *
     * @param {string} name The name of the topic.
     * @param {PublishOptions} [options] Publisher configuration object.
     * @returns {Topic} A {@link Topic} instance.
     *
     * @example
     * ```
     * const {PubSub} = require('@google-cloud/pubsub');
     * const pubsub = new PubSub();
     *
     * const topic = pubsub.topic('my-topic');
     * ```
     */
    topic(name: string, options?: PublishOptions): Topic;
    /**
     * Validate a schema definition.
     *
     * @see [Schemas: validateSchema API Documentation]{@link https://cloud.google.com/pubsub/docs/reference/rest/v1/projects.schemas/validate}
     *
     * @throws {Error} if the validation fails.
     *
     * @param {ISchema} schema The schema definition you wish to validate.
     * @param {object} [options] Request configuration options, outlined
     *   here: https://googleapis.github.io/gax-nodejs/interfaces/CallOptions.html.
     * @returns {Promise<void>}
     */
    validateSchema(schema: ISchema, gaxOpts?: CallOptions): Promise<void>;
    /*!
     * Format the name of a project. A project's full name is in the
     * format of projects/{projectId}.
     *
     * The GAPIC client should do this for us, but since we maintain
     * names rather than IDs, this is simpler.
     *
     * @private
     */
    static formatName_(name: string): string;
}
export {};
