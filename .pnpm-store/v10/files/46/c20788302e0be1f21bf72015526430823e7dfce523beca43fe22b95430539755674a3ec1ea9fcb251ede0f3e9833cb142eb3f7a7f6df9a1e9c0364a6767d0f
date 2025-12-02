import type * as gax from 'google-gax';
import type { Callback, CallOptions, Descriptors, ClientOptions, PaginationCallback, IamClient, IamProtos } from 'google-gax';
import { Transform } from 'stream';
import * as protos from '../../protos/protos';
/**
 *  The service that an application uses to manipulate topics, and to send
 *  messages to a topic.
 * @class
 * @memberof v1
 */
export declare class PublisherClient {
    private _terminated;
    private _opts;
    private _providedCustomServicePath;
    private _gaxModule;
    private _gaxGrpc;
    private _protos;
    private _defaults;
    private _universeDomain;
    private _servicePath;
    private _log;
    auth: gax.GoogleAuth;
    descriptors: Descriptors;
    warn: (code: string, message: string, warnType?: string) => void;
    innerApiCalls: {
        [name: string]: Function;
    };
    iamClient: IamClient;
    pathTemplates: {
        [name: string]: gax.PathTemplate;
    };
    publisherStub?: Promise<{
        [name: string]: Function;
    }>;
    /**
     * Construct an instance of PublisherClient.
     *
     * @param {object} [options] - The configuration object.
     * The options accepted by the constructor are described in detail
     * in [this document](https://github.com/googleapis/gax-nodejs/blob/main/client-libraries.md#creating-the-client-instance).
     * The common options are:
     * @param {object} [options.credentials] - Credentials object.
     * @param {string} [options.credentials.client_email]
     * @param {string} [options.credentials.private_key]
     * @param {string} [options.email] - Account email address. Required when
     *     using a .pem or .p12 keyFilename.
     * @param {string} [options.keyFilename] - Full path to the a .json, .pem, or
     *     .p12 key downloaded from the Google Developers Console. If you provide
     *     a path to a JSON file, the projectId option below is not necessary.
     *     NOTE: .pem and .p12 require you to specify options.email as well.
     * @param {number} [options.port] - The port on which to connect to
     *     the remote host.
     * @param {string} [options.projectId] - The project ID from the Google
     *     Developer's Console, e.g. 'grape-spaceship-123'. We will also check
     *     the environment variable GCLOUD_PROJECT for your project ID. If your
     *     app is running in an environment which supports
     *     {@link https://cloud.google.com/docs/authentication/application-default-credentials Application Default Credentials},
     *     your project ID will be detected automatically.
     * @param {string} [options.apiEndpoint] - The domain name of the
     *     API remote host.
     * @param {gax.ClientConfig} [options.clientConfig] - Client configuration override.
     *     Follows the structure of {@link gapicConfig}.
     * @param {boolean} [options.fallback] - Use HTTP/1.1 REST mode.
     *     For more information, please check the
     *     {@link https://github.com/googleapis/gax-nodejs/blob/main/client-libraries.md#http11-rest-api-mode documentation}.
     * @param {gax} [gaxInstance]: loaded instance of `google-gax`. Useful if you
     *     need to avoid loading the default gRPC version and want to use the fallback
     *     HTTP implementation. Load only fallback version and pass it to the constructor:
     *     ```
     *     const gax = require('google-gax/build/src/fallback'); // avoids loading google-gax with gRPC
     *     const client = new PublisherClient({fallback: true}, gax);
     *     ```
     */
    constructor(opts?: ClientOptions, gaxInstance?: typeof gax | typeof gax.fallback);
    /**
     * Initialize the client.
     * Performs asynchronous operations (such as authentication) and prepares the client.
     * This function will be called automatically when any class method is called for the
     * first time, but if you need to initialize it before calling an actual method,
     * feel free to call initialize() directly.
     *
     * You can await on this method if you want to make sure the client is initialized.
     *
     * @returns {Promise} A promise that resolves to an authenticated service stub.
     */
    initialize(): Promise<{
        [name: string]: Function;
    }>;
    /**
     * The DNS address for this API service.
     * @deprecated Use the apiEndpoint method of the client instance.
     * @returns {string} The DNS address for this service.
     */
    static get servicePath(): string;
    /**
     * The DNS address for this API service - same as servicePath.
     * @deprecated Use the apiEndpoint method of the client instance.
     * @returns {string} The DNS address for this service.
     */
    static get apiEndpoint(): string;
    /**
     * The DNS address for this API service.
     * @returns {string} The DNS address for this service.
     */
    get apiEndpoint(): string;
    get universeDomain(): string;
    /**
     * The port for this API service.
     * @returns {number} The default port for this service.
     */
    static get port(): number;
    /**
     * The scopes needed to make gRPC calls for every method defined
     * in this service.
     * @returns {string[]} List of default scopes.
     */
    static get scopes(): string[];
    getProjectId(): Promise<string>;
    getProjectId(callback: Callback<string, undefined, undefined>): void;
    /**
     * Creates the given topic with the given name. See the [resource name rules]
     * (https://cloud.google.com/pubsub/docs/pubsub-basics#resource_names).
     *
     * @param {Object} request
     *   The request object that will be sent.
     * @param {string} request.name
     *   Required. The name of the topic. It must have the format
     *   `"projects/{project}/topics/{topic}"`. `{topic}` must start with a letter,
     *   and contain only letters (`[A-Za-z]`), numbers (`[0-9]`), dashes (`-`),
     *   underscores (`_`), periods (`.`), tildes (`~`), plus (`+`) or percent
     *   signs (`%`). It must be between 3 and 255 characters in length, and it
     *   must not start with `"goog"`.
     * @param {number[]} [request.labels]
     *   Optional. See [Creating and managing labels]
     *   (https://cloud.google.com/pubsub/docs/labels).
     * @param {google.pubsub.v1.MessageStoragePolicy} [request.messageStoragePolicy]
     *   Optional. Policy constraining the set of Google Cloud Platform regions
     *   where messages published to the topic may be stored. If not present, then
     *   no constraints are in effect.
     * @param {string} [request.kmsKeyName]
     *   Optional. The resource name of the Cloud KMS CryptoKey to be used to
     *   protect access to messages published on this topic.
     *
     *   The expected format is `projects/* /locations/* /keyRings/* /cryptoKeys/*`.
     * @param {google.pubsub.v1.SchemaSettings} [request.schemaSettings]
     *   Optional. Settings for validating messages published against a schema.
     * @param {boolean} [request.satisfiesPzs]
     *   Optional. Reserved for future use. This field is set only in responses from
     *   the server; it is ignored if it is set in any requests.
     * @param {google.protobuf.Duration} [request.messageRetentionDuration]
     *   Optional. Indicates the minimum duration to retain a message after it is
     *   published to the topic. If this field is set, messages published to the
     *   topic in the last `message_retention_duration` are always available to
     *   subscribers. For instance, it allows any attached subscription to [seek to
     *   a
     *   timestamp](https://cloud.google.com/pubsub/docs/replay-overview#seek_to_a_time)
     *   that is up to `message_retention_duration` in the past. If this field is
     *   not set, message retention is controlled by settings on individual
     *   subscriptions. Cannot be more than 31 days or less than 10 minutes.
     * @param {google.pubsub.v1.Topic.State} request.state
     *   Output only. An output-only field indicating the state of the topic.
     * @param {google.pubsub.v1.IngestionDataSourceSettings} [request.ingestionDataSourceSettings]
     *   Optional. Settings for ingestion from a data source into this topic.
     * @param {number[]} [request.messageTransforms]
     *   Optional. Transforms to be applied to messages published to the topic.
     *   Transforms are applied in the order specified.
     * @param {object} [options]
     *   Call options. See {@link https://googleapis.dev/nodejs/google-gax/latest/interfaces/CallOptions.html|CallOptions} for more details.
     * @returns {Promise} - The promise which resolves to an array.
     *   The first element of the array is an object representing {@link protos.google.pubsub.v1.Topic|Topic}.
     *   Please see the {@link https://github.com/googleapis/gax-nodejs/blob/master/client-libraries.md#regular-methods | documentation }
     *   for more details and examples.
     */
    createTopic(request?: protos.google.pubsub.v1.ITopic, options?: CallOptions): Promise<[
        protos.google.pubsub.v1.ITopic,
        protos.google.pubsub.v1.ITopic | undefined,
        {} | undefined
    ]>;
    createTopic(request: protos.google.pubsub.v1.ITopic, options: CallOptions, callback: Callback<protos.google.pubsub.v1.ITopic, protos.google.pubsub.v1.ITopic | null | undefined, {} | null | undefined>): void;
    createTopic(request: protos.google.pubsub.v1.ITopic, callback: Callback<protos.google.pubsub.v1.ITopic, protos.google.pubsub.v1.ITopic | null | undefined, {} | null | undefined>): void;
    /**
     * Updates an existing topic by updating the fields specified in the update
     * mask. Note that certain properties of a topic are not modifiable.
     *
     * @param {Object} request
     *   The request object that will be sent.
     * @param {google.pubsub.v1.Topic} request.topic
     *   Required. The updated topic object.
     * @param {google.protobuf.FieldMask} request.updateMask
     *   Required. Indicates which fields in the provided topic to update. Must be
     *   specified and non-empty. Note that if `update_mask` contains
     *   "message_storage_policy" but the `message_storage_policy` is not set in
     *   the `topic` provided above, then the updated value is determined by the
     *   policy configured at the project or organization level.
     * @param {object} [options]
     *   Call options. See {@link https://googleapis.dev/nodejs/google-gax/latest/interfaces/CallOptions.html|CallOptions} for more details.
     * @returns {Promise} - The promise which resolves to an array.
     *   The first element of the array is an object representing {@link protos.google.pubsub.v1.Topic|Topic}.
     *   Please see the {@link https://github.com/googleapis/gax-nodejs/blob/master/client-libraries.md#regular-methods | documentation }
     *   for more details and examples.
     */
    updateTopic(request?: protos.google.pubsub.v1.IUpdateTopicRequest, options?: CallOptions): Promise<[
        protos.google.pubsub.v1.ITopic,
        protos.google.pubsub.v1.IUpdateTopicRequest | undefined,
        {} | undefined
    ]>;
    updateTopic(request: protos.google.pubsub.v1.IUpdateTopicRequest, options: CallOptions, callback: Callback<protos.google.pubsub.v1.ITopic, protos.google.pubsub.v1.IUpdateTopicRequest | null | undefined, {} | null | undefined>): void;
    updateTopic(request: protos.google.pubsub.v1.IUpdateTopicRequest, callback: Callback<protos.google.pubsub.v1.ITopic, protos.google.pubsub.v1.IUpdateTopicRequest | null | undefined, {} | null | undefined>): void;
    /**
     * Adds one or more messages to the topic. Returns `NOT_FOUND` if the topic
     * does not exist.
     *
     * @param {Object} request
     *   The request object that will be sent.
     * @param {string} request.topic
     *   Required. The messages in the request will be published on this topic.
     *   Format is `projects/{project}/topics/{topic}`.
     * @param {number[]} request.messages
     *   Required. The messages to publish.
     * @param {object} [options]
     *   Call options. See {@link https://googleapis.dev/nodejs/google-gax/latest/interfaces/CallOptions.html|CallOptions} for more details.
     * @returns {Promise} - The promise which resolves to an array.
     *   The first element of the array is an object representing {@link protos.google.pubsub.v1.PublishResponse|PublishResponse}.
     *   Please see the {@link https://github.com/googleapis/gax-nodejs/blob/master/client-libraries.md#regular-methods | documentation }
     *   for more details and examples.
     */
    publish(request?: protos.google.pubsub.v1.IPublishRequest, options?: CallOptions): Promise<[
        protos.google.pubsub.v1.IPublishResponse,
        protos.google.pubsub.v1.IPublishRequest | undefined,
        {} | undefined
    ]>;
    publish(request: protos.google.pubsub.v1.IPublishRequest, options: CallOptions, callback: Callback<protos.google.pubsub.v1.IPublishResponse, protos.google.pubsub.v1.IPublishRequest | null | undefined, {} | null | undefined>): void;
    publish(request: protos.google.pubsub.v1.IPublishRequest, callback: Callback<protos.google.pubsub.v1.IPublishResponse, protos.google.pubsub.v1.IPublishRequest | null | undefined, {} | null | undefined>): void;
    /**
     * Gets the configuration of a topic.
     *
     * @param {Object} request
     *   The request object that will be sent.
     * @param {string} request.topic
     *   Required. The name of the topic to get.
     *   Format is `projects/{project}/topics/{topic}`.
     * @param {object} [options]
     *   Call options. See {@link https://googleapis.dev/nodejs/google-gax/latest/interfaces/CallOptions.html|CallOptions} for more details.
     * @returns {Promise} - The promise which resolves to an array.
     *   The first element of the array is an object representing {@link protos.google.pubsub.v1.Topic|Topic}.
     *   Please see the {@link https://github.com/googleapis/gax-nodejs/blob/master/client-libraries.md#regular-methods | documentation }
     *   for more details and examples.
     */
    getTopic(request?: protos.google.pubsub.v1.IGetTopicRequest, options?: CallOptions): Promise<[
        protos.google.pubsub.v1.ITopic,
        protos.google.pubsub.v1.IGetTopicRequest | undefined,
        {} | undefined
    ]>;
    getTopic(request: protos.google.pubsub.v1.IGetTopicRequest, options: CallOptions, callback: Callback<protos.google.pubsub.v1.ITopic, protos.google.pubsub.v1.IGetTopicRequest | null | undefined, {} | null | undefined>): void;
    getTopic(request: protos.google.pubsub.v1.IGetTopicRequest, callback: Callback<protos.google.pubsub.v1.ITopic, protos.google.pubsub.v1.IGetTopicRequest | null | undefined, {} | null | undefined>): void;
    /**
     * Deletes the topic with the given name. Returns `NOT_FOUND` if the topic
     * does not exist. After a topic is deleted, a new topic may be created with
     * the same name; this is an entirely new topic with none of the old
     * configuration or subscriptions. Existing subscriptions to this topic are
     * not deleted, but their `topic` field is set to `_deleted-topic_`.
     *
     * @param {Object} request
     *   The request object that will be sent.
     * @param {string} request.topic
     *   Required. Name of the topic to delete.
     *   Format is `projects/{project}/topics/{topic}`.
     * @param {object} [options]
     *   Call options. See {@link https://googleapis.dev/nodejs/google-gax/latest/interfaces/CallOptions.html|CallOptions} for more details.
     * @returns {Promise} - The promise which resolves to an array.
     *   The first element of the array is an object representing {@link protos.google.protobuf.Empty|Empty}.
     *   Please see the {@link https://github.com/googleapis/gax-nodejs/blob/master/client-libraries.md#regular-methods | documentation }
     *   for more details and examples.
     */
    deleteTopic(request?: protos.google.pubsub.v1.IDeleteTopicRequest, options?: CallOptions): Promise<[
        protos.google.protobuf.IEmpty,
        protos.google.pubsub.v1.IDeleteTopicRequest | undefined,
        {} | undefined
    ]>;
    deleteTopic(request: protos.google.pubsub.v1.IDeleteTopicRequest, options: CallOptions, callback: Callback<protos.google.protobuf.IEmpty, protos.google.pubsub.v1.IDeleteTopicRequest | null | undefined, {} | null | undefined>): void;
    deleteTopic(request: protos.google.pubsub.v1.IDeleteTopicRequest, callback: Callback<protos.google.protobuf.IEmpty, protos.google.pubsub.v1.IDeleteTopicRequest | null | undefined, {} | null | undefined>): void;
    /**
     * Detaches a subscription from this topic. All messages retained in the
     * subscription are dropped. Subsequent `Pull` and `StreamingPull` requests
     * will return FAILED_PRECONDITION. If the subscription is a push
     * subscription, pushes to the endpoint will stop.
     *
     * @param {Object} request
     *   The request object that will be sent.
     * @param {string} request.subscription
     *   Required. The subscription to detach.
     *   Format is `projects/{project}/subscriptions/{subscription}`.
     * @param {object} [options]
     *   Call options. See {@link https://googleapis.dev/nodejs/google-gax/latest/interfaces/CallOptions.html|CallOptions} for more details.
     * @returns {Promise} - The promise which resolves to an array.
     *   The first element of the array is an object representing {@link protos.google.pubsub.v1.DetachSubscriptionResponse|DetachSubscriptionResponse}.
     *   Please see the {@link https://github.com/googleapis/gax-nodejs/blob/master/client-libraries.md#regular-methods | documentation }
     *   for more details and examples.
     */
    detachSubscription(request?: protos.google.pubsub.v1.IDetachSubscriptionRequest, options?: CallOptions): Promise<[
        protos.google.pubsub.v1.IDetachSubscriptionResponse,
        protos.google.pubsub.v1.IDetachSubscriptionRequest | undefined,
        {} | undefined
    ]>;
    detachSubscription(request: protos.google.pubsub.v1.IDetachSubscriptionRequest, options: CallOptions, callback: Callback<protos.google.pubsub.v1.IDetachSubscriptionResponse, protos.google.pubsub.v1.IDetachSubscriptionRequest | null | undefined, {} | null | undefined>): void;
    detachSubscription(request: protos.google.pubsub.v1.IDetachSubscriptionRequest, callback: Callback<protos.google.pubsub.v1.IDetachSubscriptionResponse, protos.google.pubsub.v1.IDetachSubscriptionRequest | null | undefined, {} | null | undefined>): void;
    /**
     * Lists matching topics.
     *
     * @param {Object} request
     *   The request object that will be sent.
     * @param {string} request.project
     *   Required. The name of the project in which to list topics.
     *   Format is `projects/{project-id}`.
     * @param {number} [request.pageSize]
     *   Optional. Maximum number of topics to return.
     * @param {string} [request.pageToken]
     *   Optional. The value returned by the last `ListTopicsResponse`; indicates
     *   that this is a continuation of a prior `ListTopics` call, and that the
     *   system should return the next page of data.
     * @param {object} [options]
     *   Call options. See {@link https://googleapis.dev/nodejs/google-gax/latest/interfaces/CallOptions.html|CallOptions} for more details.
     * @returns {Promise} - The promise which resolves to an array.
     *   The first element of the array is Array of {@link protos.google.pubsub.v1.Topic|Topic}.
     *   The client library will perform auto-pagination by default: it will call the API as many
     *   times as needed and will merge results from all the pages into this array.
     *   Note that it can affect your quota.
     *   We recommend using `listTopicsAsync()`
     *   method described below for async iteration which you can stop as needed.
     *   Please see the {@link https://github.com/googleapis/gax-nodejs/blob/master/client-libraries.md#auto-pagination | documentation }
     *   for more details and examples.
     */
    listTopics(request?: protos.google.pubsub.v1.IListTopicsRequest, options?: CallOptions): Promise<[
        protos.google.pubsub.v1.ITopic[],
        protos.google.pubsub.v1.IListTopicsRequest | null,
        protos.google.pubsub.v1.IListTopicsResponse
    ]>;
    listTopics(request: protos.google.pubsub.v1.IListTopicsRequest, options: CallOptions, callback: PaginationCallback<protos.google.pubsub.v1.IListTopicsRequest, protos.google.pubsub.v1.IListTopicsResponse | null | undefined, protos.google.pubsub.v1.ITopic>): void;
    listTopics(request: protos.google.pubsub.v1.IListTopicsRequest, callback: PaginationCallback<protos.google.pubsub.v1.IListTopicsRequest, protos.google.pubsub.v1.IListTopicsResponse | null | undefined, protos.google.pubsub.v1.ITopic>): void;
    /**
     * Equivalent to `listTopics`, but returns a NodeJS Stream object.
     * @param {Object} request
     *   The request object that will be sent.
     * @param {string} request.project
     *   Required. The name of the project in which to list topics.
     *   Format is `projects/{project-id}`.
     * @param {number} [request.pageSize]
     *   Optional. Maximum number of topics to return.
     * @param {string} [request.pageToken]
     *   Optional. The value returned by the last `ListTopicsResponse`; indicates
     *   that this is a continuation of a prior `ListTopics` call, and that the
     *   system should return the next page of data.
     * @param {object} [options]
     *   Call options. See {@link https://googleapis.dev/nodejs/google-gax/latest/interfaces/CallOptions.html|CallOptions} for more details.
     * @returns {Stream}
     *   An object stream which emits an object representing {@link protos.google.pubsub.v1.Topic|Topic} on 'data' event.
     *   The client library will perform auto-pagination by default: it will call the API as many
     *   times as needed. Note that it can affect your quota.
     *   We recommend using `listTopicsAsync()`
     *   method described below for async iteration which you can stop as needed.
     *   Please see the {@link https://github.com/googleapis/gax-nodejs/blob/master/client-libraries.md#auto-pagination | documentation }
     *   for more details and examples.
     */
    listTopicsStream(request?: protos.google.pubsub.v1.IListTopicsRequest, options?: CallOptions): Transform;
    /**
     * Equivalent to `listTopics`, but returns an iterable object.
     *
     * `for`-`await`-`of` syntax is used with the iterable to get response elements on-demand.
     * @param {Object} request
     *   The request object that will be sent.
     * @param {string} request.project
     *   Required. The name of the project in which to list topics.
     *   Format is `projects/{project-id}`.
     * @param {number} [request.pageSize]
     *   Optional. Maximum number of topics to return.
     * @param {string} [request.pageToken]
     *   Optional. The value returned by the last `ListTopicsResponse`; indicates
     *   that this is a continuation of a prior `ListTopics` call, and that the
     *   system should return the next page of data.
     * @param {object} [options]
     *   Call options. See {@link https://googleapis.dev/nodejs/google-gax/latest/interfaces/CallOptions.html|CallOptions} for more details.
     * @returns {Object}
     *   An iterable Object that allows {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Iteration_protocols | async iteration }.
     *   When you iterate the returned iterable, each element will be an object representing
     *   {@link protos.google.pubsub.v1.Topic|Topic}. The API will be called under the hood as needed, once per the page,
     *   so you can stop the iteration when you don't need more results.
     *   Please see the {@link https://github.com/googleapis/gax-nodejs/blob/master/client-libraries.md#auto-pagination | documentation }
     *   for more details and examples.
     */
    listTopicsAsync(request?: protos.google.pubsub.v1.IListTopicsRequest, options?: CallOptions): AsyncIterable<protos.google.pubsub.v1.ITopic>;
    /**
     * Lists the names of the attached subscriptions on this topic.
     *
     * @param {Object} request
     *   The request object that will be sent.
     * @param {string} request.topic
     *   Required. The name of the topic that subscriptions are attached to.
     *   Format is `projects/{project}/topics/{topic}`.
     * @param {number} [request.pageSize]
     *   Optional. Maximum number of subscription names to return.
     * @param {string} [request.pageToken]
     *   Optional. The value returned by the last `ListTopicSubscriptionsResponse`;
     *   indicates that this is a continuation of a prior `ListTopicSubscriptions`
     *   call, and that the system should return the next page of data.
     * @param {object} [options]
     *   Call options. See {@link https://googleapis.dev/nodejs/google-gax/latest/interfaces/CallOptions.html|CallOptions} for more details.
     * @returns {Promise} - The promise which resolves to an array.
     *   The first element of the array is Array of string.
     *   The client library will perform auto-pagination by default: it will call the API as many
     *   times as needed and will merge results from all the pages into this array.
     *   Note that it can affect your quota.
     *   We recommend using `listTopicSubscriptionsAsync()`
     *   method described below for async iteration which you can stop as needed.
     *   Please see the {@link https://github.com/googleapis/gax-nodejs/blob/master/client-libraries.md#auto-pagination | documentation }
     *   for more details and examples.
     */
    listTopicSubscriptions(request?: protos.google.pubsub.v1.IListTopicSubscriptionsRequest, options?: CallOptions): Promise<[
        string[],
        protos.google.pubsub.v1.IListTopicSubscriptionsRequest | null,
        protos.google.pubsub.v1.IListTopicSubscriptionsResponse
    ]>;
    listTopicSubscriptions(request: protos.google.pubsub.v1.IListTopicSubscriptionsRequest, options: CallOptions, callback: PaginationCallback<protos.google.pubsub.v1.IListTopicSubscriptionsRequest, protos.google.pubsub.v1.IListTopicSubscriptionsResponse | null | undefined, string>): void;
    listTopicSubscriptions(request: protos.google.pubsub.v1.IListTopicSubscriptionsRequest, callback: PaginationCallback<protos.google.pubsub.v1.IListTopicSubscriptionsRequest, protos.google.pubsub.v1.IListTopicSubscriptionsResponse | null | undefined, string>): void;
    /**
     * Equivalent to `listTopicSubscriptions`, but returns a NodeJS Stream object.
     * @param {Object} request
     *   The request object that will be sent.
     * @param {string} request.topic
     *   Required. The name of the topic that subscriptions are attached to.
     *   Format is `projects/{project}/topics/{topic}`.
     * @param {number} [request.pageSize]
     *   Optional. Maximum number of subscription names to return.
     * @param {string} [request.pageToken]
     *   Optional. The value returned by the last `ListTopicSubscriptionsResponse`;
     *   indicates that this is a continuation of a prior `ListTopicSubscriptions`
     *   call, and that the system should return the next page of data.
     * @param {object} [options]
     *   Call options. See {@link https://googleapis.dev/nodejs/google-gax/latest/interfaces/CallOptions.html|CallOptions} for more details.
     * @returns {Stream}
     *   An object stream which emits an object representing string on 'data' event.
     *   The client library will perform auto-pagination by default: it will call the API as many
     *   times as needed. Note that it can affect your quota.
     *   We recommend using `listTopicSubscriptionsAsync()`
     *   method described below for async iteration which you can stop as needed.
     *   Please see the {@link https://github.com/googleapis/gax-nodejs/blob/master/client-libraries.md#auto-pagination | documentation }
     *   for more details and examples.
     */
    listTopicSubscriptionsStream(request?: protos.google.pubsub.v1.IListTopicSubscriptionsRequest, options?: CallOptions): Transform;
    /**
     * Equivalent to `listTopicSubscriptions`, but returns an iterable object.
     *
     * `for`-`await`-`of` syntax is used with the iterable to get response elements on-demand.
     * @param {Object} request
     *   The request object that will be sent.
     * @param {string} request.topic
     *   Required. The name of the topic that subscriptions are attached to.
     *   Format is `projects/{project}/topics/{topic}`.
     * @param {number} [request.pageSize]
     *   Optional. Maximum number of subscription names to return.
     * @param {string} [request.pageToken]
     *   Optional. The value returned by the last `ListTopicSubscriptionsResponse`;
     *   indicates that this is a continuation of a prior `ListTopicSubscriptions`
     *   call, and that the system should return the next page of data.
     * @param {object} [options]
     *   Call options. See {@link https://googleapis.dev/nodejs/google-gax/latest/interfaces/CallOptions.html|CallOptions} for more details.
     * @returns {Object}
     *   An iterable Object that allows {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Iteration_protocols | async iteration }.
     *   When you iterate the returned iterable, each element will be an object representing
     *   string. The API will be called under the hood as needed, once per the page,
     *   so you can stop the iteration when you don't need more results.
     *   Please see the {@link https://github.com/googleapis/gax-nodejs/blob/master/client-libraries.md#auto-pagination | documentation }
     *   for more details and examples.
     */
    listTopicSubscriptionsAsync(request?: protos.google.pubsub.v1.IListTopicSubscriptionsRequest, options?: CallOptions): AsyncIterable<string>;
    /**
     * Lists the names of the snapshots on this topic. Snapshots are used in
     * [Seek](https://cloud.google.com/pubsub/docs/replay-overview) operations,
     * which allow you to manage message acknowledgments in bulk. That is, you can
     * set the acknowledgment state of messages in an existing subscription to the
     * state captured by a snapshot.
     *
     * @param {Object} request
     *   The request object that will be sent.
     * @param {string} request.topic
     *   Required. The name of the topic that snapshots are attached to.
     *   Format is `projects/{project}/topics/{topic}`.
     * @param {number} [request.pageSize]
     *   Optional. Maximum number of snapshot names to return.
     * @param {string} [request.pageToken]
     *   Optional. The value returned by the last `ListTopicSnapshotsResponse`;
     *   indicates that this is a continuation of a prior `ListTopicSnapshots` call,
     *   and that the system should return the next page of data.
     * @param {object} [options]
     *   Call options. See {@link https://googleapis.dev/nodejs/google-gax/latest/interfaces/CallOptions.html|CallOptions} for more details.
     * @returns {Promise} - The promise which resolves to an array.
     *   The first element of the array is Array of string.
     *   The client library will perform auto-pagination by default: it will call the API as many
     *   times as needed and will merge results from all the pages into this array.
     *   Note that it can affect your quota.
     *   We recommend using `listTopicSnapshotsAsync()`
     *   method described below for async iteration which you can stop as needed.
     *   Please see the {@link https://github.com/googleapis/gax-nodejs/blob/master/client-libraries.md#auto-pagination | documentation }
     *   for more details and examples.
     */
    listTopicSnapshots(request?: protos.google.pubsub.v1.IListTopicSnapshotsRequest, options?: CallOptions): Promise<[
        string[],
        protos.google.pubsub.v1.IListTopicSnapshotsRequest | null,
        protos.google.pubsub.v1.IListTopicSnapshotsResponse
    ]>;
    listTopicSnapshots(request: protos.google.pubsub.v1.IListTopicSnapshotsRequest, options: CallOptions, callback: PaginationCallback<protos.google.pubsub.v1.IListTopicSnapshotsRequest, protos.google.pubsub.v1.IListTopicSnapshotsResponse | null | undefined, string>): void;
    listTopicSnapshots(request: protos.google.pubsub.v1.IListTopicSnapshotsRequest, callback: PaginationCallback<protos.google.pubsub.v1.IListTopicSnapshotsRequest, protos.google.pubsub.v1.IListTopicSnapshotsResponse | null | undefined, string>): void;
    /**
     * Equivalent to `listTopicSnapshots`, but returns a NodeJS Stream object.
     * @param {Object} request
     *   The request object that will be sent.
     * @param {string} request.topic
     *   Required. The name of the topic that snapshots are attached to.
     *   Format is `projects/{project}/topics/{topic}`.
     * @param {number} [request.pageSize]
     *   Optional. Maximum number of snapshot names to return.
     * @param {string} [request.pageToken]
     *   Optional. The value returned by the last `ListTopicSnapshotsResponse`;
     *   indicates that this is a continuation of a prior `ListTopicSnapshots` call,
     *   and that the system should return the next page of data.
     * @param {object} [options]
     *   Call options. See {@link https://googleapis.dev/nodejs/google-gax/latest/interfaces/CallOptions.html|CallOptions} for more details.
     * @returns {Stream}
     *   An object stream which emits an object representing string on 'data' event.
     *   The client library will perform auto-pagination by default: it will call the API as many
     *   times as needed. Note that it can affect your quota.
     *   We recommend using `listTopicSnapshotsAsync()`
     *   method described below for async iteration which you can stop as needed.
     *   Please see the {@link https://github.com/googleapis/gax-nodejs/blob/master/client-libraries.md#auto-pagination | documentation }
     *   for more details and examples.
     */
    listTopicSnapshotsStream(request?: protos.google.pubsub.v1.IListTopicSnapshotsRequest, options?: CallOptions): Transform;
    /**
     * Equivalent to `listTopicSnapshots`, but returns an iterable object.
     *
     * `for`-`await`-`of` syntax is used with the iterable to get response elements on-demand.
     * @param {Object} request
     *   The request object that will be sent.
     * @param {string} request.topic
     *   Required. The name of the topic that snapshots are attached to.
     *   Format is `projects/{project}/topics/{topic}`.
     * @param {number} [request.pageSize]
     *   Optional. Maximum number of snapshot names to return.
     * @param {string} [request.pageToken]
     *   Optional. The value returned by the last `ListTopicSnapshotsResponse`;
     *   indicates that this is a continuation of a prior `ListTopicSnapshots` call,
     *   and that the system should return the next page of data.
     * @param {object} [options]
     *   Call options. See {@link https://googleapis.dev/nodejs/google-gax/latest/interfaces/CallOptions.html|CallOptions} for more details.
     * @returns {Object}
     *   An iterable Object that allows {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Iteration_protocols | async iteration }.
     *   When you iterate the returned iterable, each element will be an object representing
     *   string. The API will be called under the hood as needed, once per the page,
     *   so you can stop the iteration when you don't need more results.
     *   Please see the {@link https://github.com/googleapis/gax-nodejs/blob/master/client-libraries.md#auto-pagination | documentation }
     *   for more details and examples.
     */
    listTopicSnapshotsAsync(request?: protos.google.pubsub.v1.IListTopicSnapshotsRequest, options?: CallOptions): AsyncIterable<string>;
    /**
     * Gets the access control policy for a resource. Returns an empty policy
     * if the resource exists and does not have a policy set.
     *
     * @param {Object} request
     *   The request object that will be sent.
     * @param {string} request.resource
     *   REQUIRED: The resource for which the policy is being requested.
     *   See the operation documentation for the appropriate value for this field.
     * @param {Object} [request.options]
     *   OPTIONAL: A `GetPolicyOptions` object for specifying options to
     *   `GetIamPolicy`. This field is only used by Cloud IAM.
     *
     *   This object should have the same structure as {@link google.iam.v1.GetPolicyOptions | GetPolicyOptions}.
     * @param {Object} [options]
     *   Optional parameters. You can override the default settings for this call, e.g, timeout,
     *   retries, paginations, etc. See {@link https://googleapis.github.io/gax-nodejs/interfaces/CallOptions.html | gax.CallOptions} for the details.
     * @param {function(?Error, ?Object)} [callback]
     *   The function which will be called with the result of the API call.
     *
     *   The second parameter to the callback is an object representing {@link google.iam.v1.Policy | Policy}.
     * @returns {Promise} - The promise which resolves to an array.
     *   The first element of the array is an object representing {@link google.iam.v1.Policy | Policy}.
     *   The promise has a method named "cancel" which cancels the ongoing API call.
     */
    getIamPolicy(request: IamProtos.google.iam.v1.GetIamPolicyRequest, options?: gax.CallOptions | Callback<IamProtos.google.iam.v1.Policy, IamProtos.google.iam.v1.GetIamPolicyRequest | null | undefined, {} | null | undefined>, callback?: Callback<IamProtos.google.iam.v1.Policy, IamProtos.google.iam.v1.GetIamPolicyRequest | null | undefined, {} | null | undefined>): Promise<[IamProtos.google.iam.v1.Policy]>;
    /**
     * Returns permissions that a caller has on the specified resource. If the
     * resource does not exist, this will return an empty set of
     * permissions, not a NOT_FOUND error.
     *
     * Note: This operation is designed to be used for building
     * permission-aware UIs and command-line tools, not for authorization
     * checking. This operation may "fail open" without warning.
     *
     * @param {Object} request
     *   The request object that will be sent.
     * @param {string} request.resource
     *   REQUIRED: The resource for which the policy detail is being requested.
     *   See the operation documentation for the appropriate value for this field.
     * @param {string[]} request.permissions
     *   The set of permissions to check for the `resource`. Permissions with
     *   wildcards (such as '*' or 'storage.*') are not allowed. For more
     *   information see {@link https://cloud.google.com/iam/docs/overview#permissions | IAM Overview }.
     * @param {Object} [options]
     *   Optional parameters. You can override the default settings for this call, e.g, timeout,
     *   retries, paginations, etc. See {@link https://googleapis.github.io/gax-nodejs/interfaces/CallOptions.html | gax.CallOptions} for the details.
     * @param {function(?Error, ?Object)} [callback]
     *   The function which will be called with the result of the API call.
     *
     *   The second parameter to the callback is an object representing {@link google.iam.v1.TestIamPermissionsResponse | TestIamPermissionsResponse}.
     * @returns {Promise} - The promise which resolves to an array.
     *   The first element of the array is an object representing {@link google.iam.v1.TestIamPermissionsResponse | TestIamPermissionsResponse}.
     *   The promise has a method named "cancel" which cancels the ongoing API call.
     */
    setIamPolicy(request: IamProtos.google.iam.v1.SetIamPolicyRequest, options?: gax.CallOptions | Callback<IamProtos.google.iam.v1.Policy, IamProtos.google.iam.v1.SetIamPolicyRequest | null | undefined, {} | null | undefined>, callback?: Callback<IamProtos.google.iam.v1.Policy, IamProtos.google.iam.v1.SetIamPolicyRequest | null | undefined, {} | null | undefined>): Promise<[IamProtos.google.iam.v1.Policy]>;
    /**
     * Returns permissions that a caller has on the specified resource. If the
     * resource does not exist, this will return an empty set of
     * permissions, not a NOT_FOUND error.
     *
     * Note: This operation is designed to be used for building
     * permission-aware UIs and command-line tools, not for authorization
     * checking. This operation may "fail open" without warning.
     *
     * @param {Object} request
     *   The request object that will be sent.
     * @param {string} request.resource
     *   REQUIRED: The resource for which the policy detail is being requested.
     *   See the operation documentation for the appropriate value for this field.
     * @param {string[]} request.permissions
     *   The set of permissions to check for the `resource`. Permissions with
     *   wildcards (such as '*' or 'storage.*') are not allowed. For more
     *   information see {@link https://cloud.google.com/iam/docs/overview#permissions | IAM Overview }.
     * @param {Object} [options]
     *   Optional parameters. You can override the default settings for this call, e.g, timeout,
     *   retries, paginations, etc. See {@link https://googleapis.github.io/gax-nodejs/interfaces/CallOptions.html | gax.CallOptions} for the details.
     * @param {function(?Error, ?Object)} [callback]
     *   The function which will be called with the result of the API call.
     *
     *   The second parameter to the callback is an object representing {@link google.iam.v1.TestIamPermissionsResponse | TestIamPermissionsResponse}.
     * @returns {Promise} - The promise which resolves to an array.
     *   The first element of the array is an object representing {@link google.iam.v1.TestIamPermissionsResponse | TestIamPermissionsResponse}.
     *   The promise has a method named "cancel" which cancels the ongoing API call.
     *
     */
    testIamPermissions(request: IamProtos.google.iam.v1.TestIamPermissionsRequest, options?: gax.CallOptions | Callback<IamProtos.google.iam.v1.TestIamPermissionsResponse, IamProtos.google.iam.v1.TestIamPermissionsRequest | null | undefined, {} | null | undefined>, callback?: Callback<IamProtos.google.iam.v1.TestIamPermissionsResponse, IamProtos.google.iam.v1.TestIamPermissionsRequest | null | undefined, {} | null | undefined>): Promise<[IamProtos.google.iam.v1.TestIamPermissionsResponse]>;
    /**
     * Return a fully-qualified project resource name string.
     *
     * @param {string} project
     * @returns {string} Resource name string.
     */
    projectPath(project: string): string;
    /**
     * Parse the project from Project resource.
     *
     * @param {string} projectName
     *   A fully-qualified path representing Project resource.
     * @returns {string} A string representing the project.
     */
    matchProjectFromProjectName(projectName: string): string | number;
    /**
     * Return a fully-qualified projectTopic resource name string.
     *
     * @param {string} project
     * @param {string} topic
     * @returns {string} Resource name string.
     */
    projectTopicPath(project: string, topic: string): string;
    /**
     * Parse the project from ProjectTopic resource.
     *
     * @param {string} projectTopicName
     *   A fully-qualified path representing project_topic resource.
     * @returns {string} A string representing the project.
     */
    matchProjectFromProjectTopicName(projectTopicName: string): string | number;
    /**
     * Parse the topic from ProjectTopic resource.
     *
     * @param {string} projectTopicName
     *   A fully-qualified path representing project_topic resource.
     * @returns {string} A string representing the topic.
     */
    matchTopicFromProjectTopicName(projectTopicName: string): string | number;
    /**
     * Return a fully-qualified schema resource name string.
     *
     * @param {string} project
     * @param {string} schema
     * @returns {string} Resource name string.
     */
    schemaPath(project: string, schema: string): string;
    /**
     * Parse the project from Schema resource.
     *
     * @param {string} schemaName
     *   A fully-qualified path representing Schema resource.
     * @returns {string} A string representing the project.
     */
    matchProjectFromSchemaName(schemaName: string): string | number;
    /**
     * Parse the schema from Schema resource.
     *
     * @param {string} schemaName
     *   A fully-qualified path representing Schema resource.
     * @returns {string} A string representing the schema.
     */
    matchSchemaFromSchemaName(schemaName: string): string | number;
    /**
     * Return a fully-qualified snapshot resource name string.
     *
     * @param {string} project
     * @param {string} snapshot
     * @returns {string} Resource name string.
     */
    snapshotPath(project: string, snapshot: string): string;
    /**
     * Parse the project from Snapshot resource.
     *
     * @param {string} snapshotName
     *   A fully-qualified path representing Snapshot resource.
     * @returns {string} A string representing the project.
     */
    matchProjectFromSnapshotName(snapshotName: string): string | number;
    /**
     * Parse the snapshot from Snapshot resource.
     *
     * @param {string} snapshotName
     *   A fully-qualified path representing Snapshot resource.
     * @returns {string} A string representing the snapshot.
     */
    matchSnapshotFromSnapshotName(snapshotName: string): string | number;
    /**
     * Return a fully-qualified subscription resource name string.
     *
     * @param {string} project
     * @param {string} subscription
     * @returns {string} Resource name string.
     */
    subscriptionPath(project: string, subscription: string): string;
    /**
     * Parse the project from Subscription resource.
     *
     * @param {string} subscriptionName
     *   A fully-qualified path representing Subscription resource.
     * @returns {string} A string representing the project.
     */
    matchProjectFromSubscriptionName(subscriptionName: string): string | number;
    /**
     * Parse the subscription from Subscription resource.
     *
     * @param {string} subscriptionName
     *   A fully-qualified path representing Subscription resource.
     * @returns {string} A string representing the subscription.
     */
    matchSubscriptionFromSubscriptionName(subscriptionName: string): string | number;
    /**
     * Terminate the gRPC channel and close the client.
     *
     * The client will no longer be usable and all future behavior is undefined.
     * @returns {Promise} A promise that resolves when the client is closed.
     */
    close(): Promise<void>;
}
