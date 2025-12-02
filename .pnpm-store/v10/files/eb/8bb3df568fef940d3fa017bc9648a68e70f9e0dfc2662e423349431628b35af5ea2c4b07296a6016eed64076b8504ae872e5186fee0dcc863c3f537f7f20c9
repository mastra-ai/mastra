import type * as gax from 'google-gax';
import type { Callback, CallOptions, Descriptors, ClientOptions, PaginationCallback, IamClient, IamProtos } from 'google-gax';
import { Transform } from 'stream';
import * as protos from '../../protos/protos';
/**
 *  The service that an application uses to manipulate subscriptions and to
 *  consume messages from a subscription via the `Pull` method or by
 *  establishing a bi-directional stream using the `StreamingPull` method.
 * @class
 * @memberof v1
 */
export declare class SubscriberClient {
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
    subscriberStub?: Promise<{
        [name: string]: Function;
    }>;
    /**
     * Construct an instance of SubscriberClient.
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
     *     const client = new SubscriberClient({fallback: true}, gax);
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
     * Creates a subscription to a given topic. See the [resource name rules]
     * (https://cloud.google.com/pubsub/docs/pubsub-basics#resource_names).
     * If the subscription already exists, returns `ALREADY_EXISTS`.
     * If the corresponding topic doesn't exist, returns `NOT_FOUND`.
     *
     * If the name is not provided in the request, the server will assign a random
     * name for this subscription on the same project as the topic, conforming
     * to the [resource name format]
     * (https://cloud.google.com/pubsub/docs/pubsub-basics#resource_names). The
     * generated name is populated in the returned Subscription object. Note that
     * for REST API requests, you must specify a name in the request.
     *
     * @param {Object} request
     *   The request object that will be sent.
     * @param {string} request.name
     *   Required. The name of the subscription. It must have the format
     *   `"projects/{project}/subscriptions/{subscription}"`. `{subscription}` must
     *   start with a letter, and contain only letters (`[A-Za-z]`), numbers
     *   (`[0-9]`), dashes (`-`), underscores (`_`), periods (`.`), tildes (`~`),
     *   plus (`+`) or percent signs (`%`). It must be between 3 and 255 characters
     *   in length, and it must not start with `"goog"`.
     * @param {string} request.topic
     *   Required. The name of the topic from which this subscription is receiving
     *   messages. Format is `projects/{project}/topics/{topic}`. The value of this
     *   field will be `_deleted-topic_` if the topic has been deleted.
     * @param {google.pubsub.v1.PushConfig} [request.pushConfig]
     *   Optional. If push delivery is used with this subscription, this field is
     *   used to configure it.
     * @param {google.pubsub.v1.BigQueryConfig} [request.bigqueryConfig]
     *   Optional. If delivery to BigQuery is used with this subscription, this
     *   field is used to configure it.
     * @param {google.pubsub.v1.CloudStorageConfig} [request.cloudStorageConfig]
     *   Optional. If delivery to Google Cloud Storage is used with this
     *   subscription, this field is used to configure it.
     * @param {number} [request.ackDeadlineSeconds]
     *   Optional. The approximate amount of time (on a best-effort basis) Pub/Sub
     *   waits for the subscriber to acknowledge receipt before resending the
     *   message. In the interval after the message is delivered and before it is
     *   acknowledged, it is considered to be _outstanding_. During that time
     *   period, the message will not be redelivered (on a best-effort basis).
     *
     *   For pull subscriptions, this value is used as the initial value for the ack
     *   deadline. To override this value for a given message, call
     *   `ModifyAckDeadline` with the corresponding `ack_id` if using
     *   non-streaming pull or send the `ack_id` in a
     *   `StreamingModifyAckDeadlineRequest` if using streaming pull.
     *   The minimum custom deadline you can specify is 10 seconds.
     *   The maximum custom deadline you can specify is 600 seconds (10 minutes).
     *   If this parameter is 0, a default value of 10 seconds is used.
     *
     *   For push delivery, this value is also used to set the request timeout for
     *   the call to the push endpoint.
     *
     *   If the subscriber never acknowledges the message, the Pub/Sub
     *   system will eventually redeliver the message.
     * @param {boolean} [request.retainAckedMessages]
     *   Optional. Indicates whether to retain acknowledged messages. If true, then
     *   messages are not expunged from the subscription's backlog, even if they are
     *   acknowledged, until they fall out of the `message_retention_duration`
     *   window. This must be true if you would like to [`Seek` to a timestamp]
     *   (https://cloud.google.com/pubsub/docs/replay-overview#seek_to_a_time) in
     *   the past to replay previously-acknowledged messages.
     * @param {google.protobuf.Duration} [request.messageRetentionDuration]
     *   Optional. How long to retain unacknowledged messages in the subscription's
     *   backlog, from the moment a message is published. If `retain_acked_messages`
     *   is true, then this also configures the retention of acknowledged messages,
     *   and thus configures how far back in time a `Seek` can be done. Defaults to
     *   7 days. Cannot be more than 31 days or less than 10 minutes.
     * @param {number[]} [request.labels]
     *   Optional. See [Creating and managing
     *   labels](https://cloud.google.com/pubsub/docs/labels).
     * @param {boolean} [request.enableMessageOrdering]
     *   Optional. If true, messages published with the same `ordering_key` in
     *   `PubsubMessage` will be delivered to the subscribers in the order in which
     *   they are received by the Pub/Sub system. Otherwise, they may be delivered
     *   in any order.
     * @param {google.pubsub.v1.ExpirationPolicy} [request.expirationPolicy]
     *   Optional. A policy that specifies the conditions for this subscription's
     *   expiration. A subscription is considered active as long as any connected
     *   subscriber is successfully consuming messages from the subscription or is
     *   issuing operations on the subscription. If `expiration_policy` is not set,
     *   a *default policy* with `ttl` of 31 days will be used. The minimum allowed
     *   value for `expiration_policy.ttl` is 1 day. If `expiration_policy` is set,
     *   but `expiration_policy.ttl` is not set, the subscription never expires.
     * @param {string} [request.filter]
     *   Optional. An expression written in the Pub/Sub [filter
     *   language](https://cloud.google.com/pubsub/docs/filtering). If non-empty,
     *   then only `PubsubMessage`s whose `attributes` field matches the filter are
     *   delivered on this subscription. If empty, then no messages are filtered
     *   out.
     * @param {google.pubsub.v1.DeadLetterPolicy} [request.deadLetterPolicy]
     *   Optional. A policy that specifies the conditions for dead lettering
     *   messages in this subscription. If dead_letter_policy is not set, dead
     *   lettering is disabled.
     *
     *   The Pub/Sub service account associated with this subscriptions's
     *   parent project (i.e.,
     *   service-{project_number}@gcp-sa-pubsub.iam.gserviceaccount.com) must have
     *   permission to Acknowledge() messages on this subscription.
     * @param {google.pubsub.v1.RetryPolicy} [request.retryPolicy]
     *   Optional. A policy that specifies how Pub/Sub retries message delivery for
     *   this subscription.
     *
     *   If not set, the default retry policy is applied. This generally implies
     *   that messages will be retried as soon as possible for healthy subscribers.
     *   RetryPolicy will be triggered on NACKs or acknowledgment deadline exceeded
     *   events for a given message.
     * @param {boolean} [request.detached]
     *   Optional. Indicates whether the subscription is detached from its topic.
     *   Detached subscriptions don't receive messages from their topic and don't
     *   retain any backlog. `Pull` and `StreamingPull` requests will return
     *   FAILED_PRECONDITION. If the subscription is a push subscription, pushes to
     *   the endpoint will not be made.
     * @param {boolean} [request.enableExactlyOnceDelivery]
     *   Optional. If true, Pub/Sub provides the following guarantees for the
     *   delivery of a message with a given value of `message_id` on this
     *   subscription:
     *
     *   * The message sent to a subscriber is guaranteed not to be resent
     *   before the message's acknowledgment deadline expires.
     *   * An acknowledged message will not be resent to a subscriber.
     *
     *   Note that subscribers may still receive multiple copies of a message
     *   when `enable_exactly_once_delivery` is true if the message was published
     *   multiple times by a publisher client. These copies are  considered distinct
     *   by Pub/Sub and have distinct `message_id` values.
     * @param {google.protobuf.Duration} request.topicMessageRetentionDuration
     *   Output only. Indicates the minimum duration for which a message is retained
     *   after it is published to the subscription's topic. If this field is set,
     *   messages published to the subscription's topic in the last
     *   `topic_message_retention_duration` are always available to subscribers. See
     *   the `message_retention_duration` field in `Topic`. This field is set only
     *   in responses from the server; it is ignored if it is set in any requests.
     * @param {google.pubsub.v1.Subscription.State} request.state
     *   Output only. An output-only field indicating whether or not the
     *   subscription can receive messages.
     * @param {google.pubsub.v1.Subscription.AnalyticsHubSubscriptionInfo} request.analyticsHubSubscriptionInfo
     *   Output only. Information about the associated Analytics Hub subscription.
     *   Only set if the subscritpion is created by Analytics Hub.
     * @param {number[]} [request.messageTransforms]
     *   Optional. Transforms to be applied to messages before they are delivered to
     *   subscribers. Transforms are applied in the order specified.
     * @param {object} [options]
     *   Call options. See {@link https://googleapis.dev/nodejs/google-gax/latest/interfaces/CallOptions.html|CallOptions} for more details.
     * @returns {Promise} - The promise which resolves to an array.
     *   The first element of the array is an object representing {@link protos.google.pubsub.v1.Subscription|Subscription}.
     *   Please see the {@link https://github.com/googleapis/gax-nodejs/blob/master/client-libraries.md#regular-methods | documentation }
     *   for more details and examples.
     */
    createSubscription(request?: protos.google.pubsub.v1.ISubscription, options?: CallOptions): Promise<[
        protos.google.pubsub.v1.ISubscription,
        protos.google.pubsub.v1.ISubscription | undefined,
        {} | undefined
    ]>;
    createSubscription(request: protos.google.pubsub.v1.ISubscription, options: CallOptions, callback: Callback<protos.google.pubsub.v1.ISubscription, protos.google.pubsub.v1.ISubscription | null | undefined, {} | null | undefined>): void;
    createSubscription(request: protos.google.pubsub.v1.ISubscription, callback: Callback<protos.google.pubsub.v1.ISubscription, protos.google.pubsub.v1.ISubscription | null | undefined, {} | null | undefined>): void;
    /**
     * Gets the configuration details of a subscription.
     *
     * @param {Object} request
     *   The request object that will be sent.
     * @param {string} request.subscription
     *   Required. The name of the subscription to get.
     *   Format is `projects/{project}/subscriptions/{sub}`.
     * @param {object} [options]
     *   Call options. See {@link https://googleapis.dev/nodejs/google-gax/latest/interfaces/CallOptions.html|CallOptions} for more details.
     * @returns {Promise} - The promise which resolves to an array.
     *   The first element of the array is an object representing {@link protos.google.pubsub.v1.Subscription|Subscription}.
     *   Please see the {@link https://github.com/googleapis/gax-nodejs/blob/master/client-libraries.md#regular-methods | documentation }
     *   for more details and examples.
     */
    getSubscription(request?: protos.google.pubsub.v1.IGetSubscriptionRequest, options?: CallOptions): Promise<[
        protos.google.pubsub.v1.ISubscription,
        protos.google.pubsub.v1.IGetSubscriptionRequest | undefined,
        {} | undefined
    ]>;
    getSubscription(request: protos.google.pubsub.v1.IGetSubscriptionRequest, options: CallOptions, callback: Callback<protos.google.pubsub.v1.ISubscription, protos.google.pubsub.v1.IGetSubscriptionRequest | null | undefined, {} | null | undefined>): void;
    getSubscription(request: protos.google.pubsub.v1.IGetSubscriptionRequest, callback: Callback<protos.google.pubsub.v1.ISubscription, protos.google.pubsub.v1.IGetSubscriptionRequest | null | undefined, {} | null | undefined>): void;
    /**
     * Updates an existing subscription by updating the fields specified in the
     * update mask. Note that certain properties of a subscription, such as its
     * topic, are not modifiable.
     *
     * @param {Object} request
     *   The request object that will be sent.
     * @param {google.pubsub.v1.Subscription} request.subscription
     *   Required. The updated subscription object.
     * @param {google.protobuf.FieldMask} request.updateMask
     *   Required. Indicates which fields in the provided subscription to update.
     *   Must be specified and non-empty.
     * @param {object} [options]
     *   Call options. See {@link https://googleapis.dev/nodejs/google-gax/latest/interfaces/CallOptions.html|CallOptions} for more details.
     * @returns {Promise} - The promise which resolves to an array.
     *   The first element of the array is an object representing {@link protos.google.pubsub.v1.Subscription|Subscription}.
     *   Please see the {@link https://github.com/googleapis/gax-nodejs/blob/master/client-libraries.md#regular-methods | documentation }
     *   for more details and examples.
     */
    updateSubscription(request?: protos.google.pubsub.v1.IUpdateSubscriptionRequest, options?: CallOptions): Promise<[
        protos.google.pubsub.v1.ISubscription,
        protos.google.pubsub.v1.IUpdateSubscriptionRequest | undefined,
        {} | undefined
    ]>;
    updateSubscription(request: protos.google.pubsub.v1.IUpdateSubscriptionRequest, options: CallOptions, callback: Callback<protos.google.pubsub.v1.ISubscription, protos.google.pubsub.v1.IUpdateSubscriptionRequest | null | undefined, {} | null | undefined>): void;
    updateSubscription(request: protos.google.pubsub.v1.IUpdateSubscriptionRequest, callback: Callback<protos.google.pubsub.v1.ISubscription, protos.google.pubsub.v1.IUpdateSubscriptionRequest | null | undefined, {} | null | undefined>): void;
    /**
     * Deletes an existing subscription. All messages retained in the subscription
     * are immediately dropped. Calls to `Pull` after deletion will return
     * `NOT_FOUND`. After a subscription is deleted, a new one may be created with
     * the same name, but the new one has no association with the old
     * subscription or its topic unless the same topic is specified.
     *
     * @param {Object} request
     *   The request object that will be sent.
     * @param {string} request.subscription
     *   Required. The subscription to delete.
     *   Format is `projects/{project}/subscriptions/{sub}`.
     * @param {object} [options]
     *   Call options. See {@link https://googleapis.dev/nodejs/google-gax/latest/interfaces/CallOptions.html|CallOptions} for more details.
     * @returns {Promise} - The promise which resolves to an array.
     *   The first element of the array is an object representing {@link protos.google.protobuf.Empty|Empty}.
     *   Please see the {@link https://github.com/googleapis/gax-nodejs/blob/master/client-libraries.md#regular-methods | documentation }
     *   for more details and examples.
     */
    deleteSubscription(request?: protos.google.pubsub.v1.IDeleteSubscriptionRequest, options?: CallOptions): Promise<[
        protos.google.protobuf.IEmpty,
        protos.google.pubsub.v1.IDeleteSubscriptionRequest | undefined,
        {} | undefined
    ]>;
    deleteSubscription(request: protos.google.pubsub.v1.IDeleteSubscriptionRequest, options: CallOptions, callback: Callback<protos.google.protobuf.IEmpty, protos.google.pubsub.v1.IDeleteSubscriptionRequest | null | undefined, {} | null | undefined>): void;
    deleteSubscription(request: protos.google.pubsub.v1.IDeleteSubscriptionRequest, callback: Callback<protos.google.protobuf.IEmpty, protos.google.pubsub.v1.IDeleteSubscriptionRequest | null | undefined, {} | null | undefined>): void;
    /**
     * Modifies the ack deadline for a specific message. This method is useful
     * to indicate that more time is needed to process a message by the
     * subscriber, or to make the message available for redelivery if the
     * processing was interrupted. Note that this does not modify the
     * subscription-level `ackDeadlineSeconds` used for subsequent messages.
     *
     * @param {Object} request
     *   The request object that will be sent.
     * @param {string} request.subscription
     *   Required. The name of the subscription.
     *   Format is `projects/{project}/subscriptions/{sub}`.
     * @param {string[]} request.ackIds
     *   Required. List of acknowledgment IDs.
     * @param {number} request.ackDeadlineSeconds
     *   Required. The new ack deadline with respect to the time this request was
     *   sent to the Pub/Sub system. For example, if the value is 10, the new ack
     *   deadline will expire 10 seconds after the `ModifyAckDeadline` call was
     *   made. Specifying zero might immediately make the message available for
     *   delivery to another subscriber client. This typically results in an
     *   increase in the rate of message redeliveries (that is, duplicates).
     *   The minimum deadline you can specify is 0 seconds.
     *   The maximum deadline you can specify in a single request is 600 seconds
     *   (10 minutes).
     * @param {object} [options]
     *   Call options. See {@link https://googleapis.dev/nodejs/google-gax/latest/interfaces/CallOptions.html|CallOptions} for more details.
     * @returns {Promise} - The promise which resolves to an array.
     *   The first element of the array is an object representing {@link protos.google.protobuf.Empty|Empty}.
     *   Please see the {@link https://github.com/googleapis/gax-nodejs/blob/master/client-libraries.md#regular-methods | documentation }
     *   for more details and examples.
     */
    modifyAckDeadline(request?: protos.google.pubsub.v1.IModifyAckDeadlineRequest, options?: CallOptions): Promise<[
        protos.google.protobuf.IEmpty,
        protos.google.pubsub.v1.IModifyAckDeadlineRequest | undefined,
        {} | undefined
    ]>;
    modifyAckDeadline(request: protos.google.pubsub.v1.IModifyAckDeadlineRequest, options: CallOptions, callback: Callback<protos.google.protobuf.IEmpty, protos.google.pubsub.v1.IModifyAckDeadlineRequest | null | undefined, {} | null | undefined>): void;
    modifyAckDeadline(request: protos.google.pubsub.v1.IModifyAckDeadlineRequest, callback: Callback<protos.google.protobuf.IEmpty, protos.google.pubsub.v1.IModifyAckDeadlineRequest | null | undefined, {} | null | undefined>): void;
    /**
     * Acknowledges the messages associated with the `ack_ids` in the
     * `AcknowledgeRequest`. The Pub/Sub system can remove the relevant messages
     * from the subscription.
     *
     * Acknowledging a message whose ack deadline has expired may succeed,
     * but such a message may be redelivered later. Acknowledging a message more
     * than once will not result in an error.
     *
     * @param {Object} request
     *   The request object that will be sent.
     * @param {string} request.subscription
     *   Required. The subscription whose message is being acknowledged.
     *   Format is `projects/{project}/subscriptions/{sub}`.
     * @param {string[]} request.ackIds
     *   Required. The acknowledgment ID for the messages being acknowledged that
     *   was returned by the Pub/Sub system in the `Pull` response. Must not be
     *   empty.
     * @param {object} [options]
     *   Call options. See {@link https://googleapis.dev/nodejs/google-gax/latest/interfaces/CallOptions.html|CallOptions} for more details.
     * @returns {Promise} - The promise which resolves to an array.
     *   The first element of the array is an object representing {@link protos.google.protobuf.Empty|Empty}.
     *   Please see the {@link https://github.com/googleapis/gax-nodejs/blob/master/client-libraries.md#regular-methods | documentation }
     *   for more details and examples.
     */
    acknowledge(request?: protos.google.pubsub.v1.IAcknowledgeRequest, options?: CallOptions): Promise<[
        protos.google.protobuf.IEmpty,
        protos.google.pubsub.v1.IAcknowledgeRequest | undefined,
        {} | undefined
    ]>;
    acknowledge(request: protos.google.pubsub.v1.IAcknowledgeRequest, options: CallOptions, callback: Callback<protos.google.protobuf.IEmpty, protos.google.pubsub.v1.IAcknowledgeRequest | null | undefined, {} | null | undefined>): void;
    acknowledge(request: protos.google.pubsub.v1.IAcknowledgeRequest, callback: Callback<protos.google.protobuf.IEmpty, protos.google.pubsub.v1.IAcknowledgeRequest | null | undefined, {} | null | undefined>): void;
    /**
     * Pulls messages from the server.
     *
     * @param {Object} request
     *   The request object that will be sent.
     * @param {string} request.subscription
     *   Required. The subscription from which messages should be pulled.
     *   Format is `projects/{project}/subscriptions/{sub}`.
     * @param {boolean} [request.returnImmediately]
     *   Optional. If this field set to true, the system will respond immediately
     *   even if it there are no messages available to return in the `Pull`
     *   response. Otherwise, the system may wait (for a bounded amount of time)
     *   until at least one message is available, rather than returning no messages.
     *   Warning: setting this field to `true` is discouraged because it adversely
     *   impacts the performance of `Pull` operations. We recommend that users do
     *   not set this field.
     * @param {number} request.maxMessages
     *   Required. The maximum number of messages to return for this request. Must
     *   be a positive integer. The Pub/Sub system may return fewer than the number
     *   specified.
     * @param {object} [options]
     *   Call options. See {@link https://googleapis.dev/nodejs/google-gax/latest/interfaces/CallOptions.html|CallOptions} for more details.
     * @returns {Promise} - The promise which resolves to an array.
     *   The first element of the array is an object representing {@link protos.google.pubsub.v1.PullResponse|PullResponse}.
     *   Please see the {@link https://github.com/googleapis/gax-nodejs/blob/master/client-libraries.md#regular-methods | documentation }
     *   for more details and examples.
     */
    pull(request?: protos.google.pubsub.v1.IPullRequest, options?: CallOptions): Promise<[
        protos.google.pubsub.v1.IPullResponse,
        protos.google.pubsub.v1.IPullRequest | undefined,
        {} | undefined
    ]>;
    pull(request: protos.google.pubsub.v1.IPullRequest, options: CallOptions, callback: Callback<protos.google.pubsub.v1.IPullResponse, protos.google.pubsub.v1.IPullRequest | null | undefined, {} | null | undefined>): void;
    pull(request: protos.google.pubsub.v1.IPullRequest, callback: Callback<protos.google.pubsub.v1.IPullResponse, protos.google.pubsub.v1.IPullRequest | null | undefined, {} | null | undefined>): void;
    /**
     * Modifies the `PushConfig` for a specified subscription.
     *
     * This may be used to change a push subscription to a pull one (signified by
     * an empty `PushConfig`) or vice versa, or change the endpoint URL and other
     * attributes of a push subscription. Messages will accumulate for delivery
     * continuously through the call regardless of changes to the `PushConfig`.
     *
     * @param {Object} request
     *   The request object that will be sent.
     * @param {string} request.subscription
     *   Required. The name of the subscription.
     *   Format is `projects/{project}/subscriptions/{sub}`.
     * @param {google.pubsub.v1.PushConfig} request.pushConfig
     *   Required. The push configuration for future deliveries.
     *
     *   An empty `pushConfig` indicates that the Pub/Sub system should
     *   stop pushing messages from the given subscription and allow
     *   messages to be pulled and acknowledged - effectively pausing
     *   the subscription if `Pull` or `StreamingPull` is not called.
     * @param {object} [options]
     *   Call options. See {@link https://googleapis.dev/nodejs/google-gax/latest/interfaces/CallOptions.html|CallOptions} for more details.
     * @returns {Promise} - The promise which resolves to an array.
     *   The first element of the array is an object representing {@link protos.google.protobuf.Empty|Empty}.
     *   Please see the {@link https://github.com/googleapis/gax-nodejs/blob/master/client-libraries.md#regular-methods | documentation }
     *   for more details and examples.
     */
    modifyPushConfig(request?: protos.google.pubsub.v1.IModifyPushConfigRequest, options?: CallOptions): Promise<[
        protos.google.protobuf.IEmpty,
        protos.google.pubsub.v1.IModifyPushConfigRequest | undefined,
        {} | undefined
    ]>;
    modifyPushConfig(request: protos.google.pubsub.v1.IModifyPushConfigRequest, options: CallOptions, callback: Callback<protos.google.protobuf.IEmpty, protos.google.pubsub.v1.IModifyPushConfigRequest | null | undefined, {} | null | undefined>): void;
    modifyPushConfig(request: protos.google.pubsub.v1.IModifyPushConfigRequest, callback: Callback<protos.google.protobuf.IEmpty, protos.google.pubsub.v1.IModifyPushConfigRequest | null | undefined, {} | null | undefined>): void;
    /**
     * Gets the configuration details of a snapshot. Snapshots are used in
     * [Seek](https://cloud.google.com/pubsub/docs/replay-overview) operations,
     * which allow you to manage message acknowledgments in bulk. That is, you can
     * set the acknowledgment state of messages in an existing subscription to the
     * state captured by a snapshot.
     *
     * @param {Object} request
     *   The request object that will be sent.
     * @param {string} request.snapshot
     *   Required. The name of the snapshot to get.
     *   Format is `projects/{project}/snapshots/{snap}`.
     * @param {object} [options]
     *   Call options. See {@link https://googleapis.dev/nodejs/google-gax/latest/interfaces/CallOptions.html|CallOptions} for more details.
     * @returns {Promise} - The promise which resolves to an array.
     *   The first element of the array is an object representing {@link protos.google.pubsub.v1.Snapshot|Snapshot}.
     *   Please see the {@link https://github.com/googleapis/gax-nodejs/blob/master/client-libraries.md#regular-methods | documentation }
     *   for more details and examples.
     */
    getSnapshot(request?: protos.google.pubsub.v1.IGetSnapshotRequest, options?: CallOptions): Promise<[
        protos.google.pubsub.v1.ISnapshot,
        protos.google.pubsub.v1.IGetSnapshotRequest | undefined,
        {} | undefined
    ]>;
    getSnapshot(request: protos.google.pubsub.v1.IGetSnapshotRequest, options: CallOptions, callback: Callback<protos.google.pubsub.v1.ISnapshot, protos.google.pubsub.v1.IGetSnapshotRequest | null | undefined, {} | null | undefined>): void;
    getSnapshot(request: protos.google.pubsub.v1.IGetSnapshotRequest, callback: Callback<protos.google.pubsub.v1.ISnapshot, protos.google.pubsub.v1.IGetSnapshotRequest | null | undefined, {} | null | undefined>): void;
    /**
     * Creates a snapshot from the requested subscription. Snapshots are used in
     * [Seek](https://cloud.google.com/pubsub/docs/replay-overview) operations,
     * which allow you to manage message acknowledgments in bulk. That is, you can
     * set the acknowledgment state of messages in an existing subscription to the
     * state captured by a snapshot.
     * If the snapshot already exists, returns `ALREADY_EXISTS`.
     * If the requested subscription doesn't exist, returns `NOT_FOUND`.
     * If the backlog in the subscription is too old -- and the resulting snapshot
     * would expire in less than 1 hour -- then `FAILED_PRECONDITION` is returned.
     * See also the `Snapshot.expire_time` field. If the name is not provided in
     * the request, the server will assign a random
     * name for this snapshot on the same project as the subscription, conforming
     * to the [resource name format]
     * (https://cloud.google.com/pubsub/docs/pubsub-basics#resource_names). The
     * generated name is populated in the returned Snapshot object. Note that for
     * REST API requests, you must specify a name in the request.
     *
     * @param {Object} request
     *   The request object that will be sent.
     * @param {string} request.name
     *   Required. User-provided name for this snapshot. If the name is not provided
     *   in the request, the server will assign a random name for this snapshot on
     *   the same project as the subscription. Note that for REST API requests, you
     *   must specify a name.  See the [resource name
     *   rules](https://cloud.google.com/pubsub/docs/pubsub-basics#resource_names).
     *   Format is `projects/{project}/snapshots/{snap}`.
     * @param {string} request.subscription
     *   Required. The subscription whose backlog the snapshot retains.
     *   Specifically, the created snapshot is guaranteed to retain:
     *    (a) The existing backlog on the subscription. More precisely, this is
     *        defined as the messages in the subscription's backlog that are
     *        unacknowledged upon the successful completion of the
     *        `CreateSnapshot` request; as well as:
     *    (b) Any messages published to the subscription's topic following the
     *        successful completion of the CreateSnapshot request.
     *   Format is `projects/{project}/subscriptions/{sub}`.
     * @param {number[]} [request.labels]
     *   Optional. See [Creating and managing
     *   labels](https://cloud.google.com/pubsub/docs/labels).
     * @param {object} [options]
     *   Call options. See {@link https://googleapis.dev/nodejs/google-gax/latest/interfaces/CallOptions.html|CallOptions} for more details.
     * @returns {Promise} - The promise which resolves to an array.
     *   The first element of the array is an object representing {@link protos.google.pubsub.v1.Snapshot|Snapshot}.
     *   Please see the {@link https://github.com/googleapis/gax-nodejs/blob/master/client-libraries.md#regular-methods | documentation }
     *   for more details and examples.
     */
    createSnapshot(request?: protos.google.pubsub.v1.ICreateSnapshotRequest, options?: CallOptions): Promise<[
        protos.google.pubsub.v1.ISnapshot,
        protos.google.pubsub.v1.ICreateSnapshotRequest | undefined,
        {} | undefined
    ]>;
    createSnapshot(request: protos.google.pubsub.v1.ICreateSnapshotRequest, options: CallOptions, callback: Callback<protos.google.pubsub.v1.ISnapshot, protos.google.pubsub.v1.ICreateSnapshotRequest | null | undefined, {} | null | undefined>): void;
    createSnapshot(request: protos.google.pubsub.v1.ICreateSnapshotRequest, callback: Callback<protos.google.pubsub.v1.ISnapshot, protos.google.pubsub.v1.ICreateSnapshotRequest | null | undefined, {} | null | undefined>): void;
    /**
     * Updates an existing snapshot by updating the fields specified in the update
     * mask. Snapshots are used in
     * [Seek](https://cloud.google.com/pubsub/docs/replay-overview) operations,
     * which allow you to manage message acknowledgments in bulk. That is, you can
     * set the acknowledgment state of messages in an existing subscription to the
     * state captured by a snapshot.
     *
     * @param {Object} request
     *   The request object that will be sent.
     * @param {google.pubsub.v1.Snapshot} request.snapshot
     *   Required. The updated snapshot object.
     * @param {google.protobuf.FieldMask} request.updateMask
     *   Required. Indicates which fields in the provided snapshot to update.
     *   Must be specified and non-empty.
     * @param {object} [options]
     *   Call options. See {@link https://googleapis.dev/nodejs/google-gax/latest/interfaces/CallOptions.html|CallOptions} for more details.
     * @returns {Promise} - The promise which resolves to an array.
     *   The first element of the array is an object representing {@link protos.google.pubsub.v1.Snapshot|Snapshot}.
     *   Please see the {@link https://github.com/googleapis/gax-nodejs/blob/master/client-libraries.md#regular-methods | documentation }
     *   for more details and examples.
     */
    updateSnapshot(request?: protos.google.pubsub.v1.IUpdateSnapshotRequest, options?: CallOptions): Promise<[
        protos.google.pubsub.v1.ISnapshot,
        protos.google.pubsub.v1.IUpdateSnapshotRequest | undefined,
        {} | undefined
    ]>;
    updateSnapshot(request: protos.google.pubsub.v1.IUpdateSnapshotRequest, options: CallOptions, callback: Callback<protos.google.pubsub.v1.ISnapshot, protos.google.pubsub.v1.IUpdateSnapshotRequest | null | undefined, {} | null | undefined>): void;
    updateSnapshot(request: protos.google.pubsub.v1.IUpdateSnapshotRequest, callback: Callback<protos.google.pubsub.v1.ISnapshot, protos.google.pubsub.v1.IUpdateSnapshotRequest | null | undefined, {} | null | undefined>): void;
    /**
     * Removes an existing snapshot. Snapshots are used in [Seek]
     * (https://cloud.google.com/pubsub/docs/replay-overview) operations, which
     * allow you to manage message acknowledgments in bulk. That is, you can set
     * the acknowledgment state of messages in an existing subscription to the
     * state captured by a snapshot.
     * When the snapshot is deleted, all messages retained in the snapshot
     * are immediately dropped. After a snapshot is deleted, a new one may be
     * created with the same name, but the new one has no association with the old
     * snapshot or its subscription, unless the same subscription is specified.
     *
     * @param {Object} request
     *   The request object that will be sent.
     * @param {string} request.snapshot
     *   Required. The name of the snapshot to delete.
     *   Format is `projects/{project}/snapshots/{snap}`.
     * @param {object} [options]
     *   Call options. See {@link https://googleapis.dev/nodejs/google-gax/latest/interfaces/CallOptions.html|CallOptions} for more details.
     * @returns {Promise} - The promise which resolves to an array.
     *   The first element of the array is an object representing {@link protos.google.protobuf.Empty|Empty}.
     *   Please see the {@link https://github.com/googleapis/gax-nodejs/blob/master/client-libraries.md#regular-methods | documentation }
     *   for more details and examples.
     */
    deleteSnapshot(request?: protos.google.pubsub.v1.IDeleteSnapshotRequest, options?: CallOptions): Promise<[
        protos.google.protobuf.IEmpty,
        protos.google.pubsub.v1.IDeleteSnapshotRequest | undefined,
        {} | undefined
    ]>;
    deleteSnapshot(request: protos.google.pubsub.v1.IDeleteSnapshotRequest, options: CallOptions, callback: Callback<protos.google.protobuf.IEmpty, protos.google.pubsub.v1.IDeleteSnapshotRequest | null | undefined, {} | null | undefined>): void;
    deleteSnapshot(request: protos.google.pubsub.v1.IDeleteSnapshotRequest, callback: Callback<protos.google.protobuf.IEmpty, protos.google.pubsub.v1.IDeleteSnapshotRequest | null | undefined, {} | null | undefined>): void;
    /**
     * Seeks an existing subscription to a point in time or to a given snapshot,
     * whichever is provided in the request. Snapshots are used in [Seek]
     * (https://cloud.google.com/pubsub/docs/replay-overview) operations, which
     * allow you to manage message acknowledgments in bulk. That is, you can set
     * the acknowledgment state of messages in an existing subscription to the
     * state captured by a snapshot. Note that both the subscription and the
     * snapshot must be on the same topic.
     *
     * @param {Object} request
     *   The request object that will be sent.
     * @param {string} request.subscription
     *   Required. The subscription to affect.
     * @param {google.protobuf.Timestamp} [request.time]
     *   Optional. The time to seek to.
     *   Messages retained in the subscription that were published before this
     *   time are marked as acknowledged, and messages retained in the
     *   subscription that were published after this time are marked as
     *   unacknowledged. Note that this operation affects only those messages
     *   retained in the subscription (configured by the combination of
     *   `message_retention_duration` and `retain_acked_messages`). For example,
     *   if `time` corresponds to a point before the message retention
     *   window (or to a point before the system's notion of the subscription
     *   creation time), only retained messages will be marked as unacknowledged,
     *   and already-expunged messages will not be restored.
     * @param {string} [request.snapshot]
     *   Optional. The snapshot to seek to. The snapshot's topic must be the same
     *   as that of the provided subscription. Format is
     *   `projects/{project}/snapshots/{snap}`.
     * @param {object} [options]
     *   Call options. See {@link https://googleapis.dev/nodejs/google-gax/latest/interfaces/CallOptions.html|CallOptions} for more details.
     * @returns {Promise} - The promise which resolves to an array.
     *   The first element of the array is an object representing {@link protos.google.pubsub.v1.SeekResponse|SeekResponse}.
     *   Please see the {@link https://github.com/googleapis/gax-nodejs/blob/master/client-libraries.md#regular-methods | documentation }
     *   for more details and examples.
     */
    seek(request?: protos.google.pubsub.v1.ISeekRequest, options?: CallOptions): Promise<[
        protos.google.pubsub.v1.ISeekResponse,
        protos.google.pubsub.v1.ISeekRequest | undefined,
        {} | undefined
    ]>;
    seek(request: protos.google.pubsub.v1.ISeekRequest, options: CallOptions, callback: Callback<protos.google.pubsub.v1.ISeekResponse, protos.google.pubsub.v1.ISeekRequest | null | undefined, {} | null | undefined>): void;
    seek(request: protos.google.pubsub.v1.ISeekRequest, callback: Callback<protos.google.pubsub.v1.ISeekResponse, protos.google.pubsub.v1.ISeekRequest | null | undefined, {} | null | undefined>): void;
    /**
     * Establishes a stream with the server, which sends messages down to the
     * client. The client streams acknowledgments and ack deadline modifications
     * back to the server. The server will close the stream and return the status
     * on any error. The server may close the stream with status `UNAVAILABLE` to
     * reassign server-side resources, in which case, the client should
     * re-establish the stream. Flow control can be achieved by configuring the
     * underlying RPC channel.
     *
     * @param {object} [options]
     *   Call options. See {@link https://googleapis.dev/nodejs/google-gax/latest/interfaces/CallOptions.html|CallOptions} for more details.
     * @returns {Stream}
     *   An object stream which is both readable and writable. It accepts objects
     *   representing {@link protos.google.pubsub.v1.StreamingPullRequest|StreamingPullRequest} for write() method, and
     *   will emit objects representing {@link protos.google.pubsub.v1.StreamingPullResponse|StreamingPullResponse} on 'data' event asynchronously.
     *   Please see the {@link https://github.com/googleapis/gax-nodejs/blob/master/client-libraries.md#bi-directional-streaming | documentation }
     *   for more details and examples.
     */
    streamingPull(options?: CallOptions): gax.CancellableStream;
    /**
     * Lists matching subscriptions.
     *
     * @param {Object} request
     *   The request object that will be sent.
     * @param {string} request.project
     *   Required. The name of the project in which to list subscriptions.
     *   Format is `projects/{project-id}`.
     * @param {number} [request.pageSize]
     *   Optional. Maximum number of subscriptions to return.
     * @param {string} [request.pageToken]
     *   Optional. The value returned by the last `ListSubscriptionsResponse`;
     *   indicates that this is a continuation of a prior `ListSubscriptions` call,
     *   and that the system should return the next page of data.
     * @param {object} [options]
     *   Call options. See {@link https://googleapis.dev/nodejs/google-gax/latest/interfaces/CallOptions.html|CallOptions} for more details.
     * @returns {Promise} - The promise which resolves to an array.
     *   The first element of the array is Array of {@link protos.google.pubsub.v1.Subscription|Subscription}.
     *   The client library will perform auto-pagination by default: it will call the API as many
     *   times as needed and will merge results from all the pages into this array.
     *   Note that it can affect your quota.
     *   We recommend using `listSubscriptionsAsync()`
     *   method described below for async iteration which you can stop as needed.
     *   Please see the {@link https://github.com/googleapis/gax-nodejs/blob/master/client-libraries.md#auto-pagination | documentation }
     *   for more details and examples.
     */
    listSubscriptions(request?: protos.google.pubsub.v1.IListSubscriptionsRequest, options?: CallOptions): Promise<[
        protos.google.pubsub.v1.ISubscription[],
        protos.google.pubsub.v1.IListSubscriptionsRequest | null,
        protos.google.pubsub.v1.IListSubscriptionsResponse
    ]>;
    listSubscriptions(request: protos.google.pubsub.v1.IListSubscriptionsRequest, options: CallOptions, callback: PaginationCallback<protos.google.pubsub.v1.IListSubscriptionsRequest, protos.google.pubsub.v1.IListSubscriptionsResponse | null | undefined, protos.google.pubsub.v1.ISubscription>): void;
    listSubscriptions(request: protos.google.pubsub.v1.IListSubscriptionsRequest, callback: PaginationCallback<protos.google.pubsub.v1.IListSubscriptionsRequest, protos.google.pubsub.v1.IListSubscriptionsResponse | null | undefined, protos.google.pubsub.v1.ISubscription>): void;
    /**
     * Equivalent to `listSubscriptions`, but returns a NodeJS Stream object.
     * @param {Object} request
     *   The request object that will be sent.
     * @param {string} request.project
     *   Required. The name of the project in which to list subscriptions.
     *   Format is `projects/{project-id}`.
     * @param {number} [request.pageSize]
     *   Optional. Maximum number of subscriptions to return.
     * @param {string} [request.pageToken]
     *   Optional. The value returned by the last `ListSubscriptionsResponse`;
     *   indicates that this is a continuation of a prior `ListSubscriptions` call,
     *   and that the system should return the next page of data.
     * @param {object} [options]
     *   Call options. See {@link https://googleapis.dev/nodejs/google-gax/latest/interfaces/CallOptions.html|CallOptions} for more details.
     * @returns {Stream}
     *   An object stream which emits an object representing {@link protos.google.pubsub.v1.Subscription|Subscription} on 'data' event.
     *   The client library will perform auto-pagination by default: it will call the API as many
     *   times as needed. Note that it can affect your quota.
     *   We recommend using `listSubscriptionsAsync()`
     *   method described below for async iteration which you can stop as needed.
     *   Please see the {@link https://github.com/googleapis/gax-nodejs/blob/master/client-libraries.md#auto-pagination | documentation }
     *   for more details and examples.
     */
    listSubscriptionsStream(request?: protos.google.pubsub.v1.IListSubscriptionsRequest, options?: CallOptions): Transform;
    /**
     * Equivalent to `listSubscriptions`, but returns an iterable object.
     *
     * `for`-`await`-`of` syntax is used with the iterable to get response elements on-demand.
     * @param {Object} request
     *   The request object that will be sent.
     * @param {string} request.project
     *   Required. The name of the project in which to list subscriptions.
     *   Format is `projects/{project-id}`.
     * @param {number} [request.pageSize]
     *   Optional. Maximum number of subscriptions to return.
     * @param {string} [request.pageToken]
     *   Optional. The value returned by the last `ListSubscriptionsResponse`;
     *   indicates that this is a continuation of a prior `ListSubscriptions` call,
     *   and that the system should return the next page of data.
     * @param {object} [options]
     *   Call options. See {@link https://googleapis.dev/nodejs/google-gax/latest/interfaces/CallOptions.html|CallOptions} for more details.
     * @returns {Object}
     *   An iterable Object that allows {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Iteration_protocols | async iteration }.
     *   When you iterate the returned iterable, each element will be an object representing
     *   {@link protos.google.pubsub.v1.Subscription|Subscription}. The API will be called under the hood as needed, once per the page,
     *   so you can stop the iteration when you don't need more results.
     *   Please see the {@link https://github.com/googleapis/gax-nodejs/blob/master/client-libraries.md#auto-pagination | documentation }
     *   for more details and examples.
     */
    listSubscriptionsAsync(request?: protos.google.pubsub.v1.IListSubscriptionsRequest, options?: CallOptions): AsyncIterable<protos.google.pubsub.v1.ISubscription>;
    /**
     * Lists the existing snapshots. Snapshots are used in [Seek](
     * https://cloud.google.com/pubsub/docs/replay-overview) operations, which
     * allow you to manage message acknowledgments in bulk. That is, you can set
     * the acknowledgment state of messages in an existing subscription to the
     * state captured by a snapshot.
     *
     * @param {Object} request
     *   The request object that will be sent.
     * @param {string} request.project
     *   Required. The name of the project in which to list snapshots.
     *   Format is `projects/{project-id}`.
     * @param {number} [request.pageSize]
     *   Optional. Maximum number of snapshots to return.
     * @param {string} [request.pageToken]
     *   Optional. The value returned by the last `ListSnapshotsResponse`; indicates
     *   that this is a continuation of a prior `ListSnapshots` call, and that the
     *   system should return the next page of data.
     * @param {object} [options]
     *   Call options. See {@link https://googleapis.dev/nodejs/google-gax/latest/interfaces/CallOptions.html|CallOptions} for more details.
     * @returns {Promise} - The promise which resolves to an array.
     *   The first element of the array is Array of {@link protos.google.pubsub.v1.Snapshot|Snapshot}.
     *   The client library will perform auto-pagination by default: it will call the API as many
     *   times as needed and will merge results from all the pages into this array.
     *   Note that it can affect your quota.
     *   We recommend using `listSnapshotsAsync()`
     *   method described below for async iteration which you can stop as needed.
     *   Please see the {@link https://github.com/googleapis/gax-nodejs/blob/master/client-libraries.md#auto-pagination | documentation }
     *   for more details and examples.
     */
    listSnapshots(request?: protos.google.pubsub.v1.IListSnapshotsRequest, options?: CallOptions): Promise<[
        protos.google.pubsub.v1.ISnapshot[],
        protos.google.pubsub.v1.IListSnapshotsRequest | null,
        protos.google.pubsub.v1.IListSnapshotsResponse
    ]>;
    listSnapshots(request: protos.google.pubsub.v1.IListSnapshotsRequest, options: CallOptions, callback: PaginationCallback<protos.google.pubsub.v1.IListSnapshotsRequest, protos.google.pubsub.v1.IListSnapshotsResponse | null | undefined, protos.google.pubsub.v1.ISnapshot>): void;
    listSnapshots(request: protos.google.pubsub.v1.IListSnapshotsRequest, callback: PaginationCallback<protos.google.pubsub.v1.IListSnapshotsRequest, protos.google.pubsub.v1.IListSnapshotsResponse | null | undefined, protos.google.pubsub.v1.ISnapshot>): void;
    /**
     * Equivalent to `listSnapshots`, but returns a NodeJS Stream object.
     * @param {Object} request
     *   The request object that will be sent.
     * @param {string} request.project
     *   Required. The name of the project in which to list snapshots.
     *   Format is `projects/{project-id}`.
     * @param {number} [request.pageSize]
     *   Optional. Maximum number of snapshots to return.
     * @param {string} [request.pageToken]
     *   Optional. The value returned by the last `ListSnapshotsResponse`; indicates
     *   that this is a continuation of a prior `ListSnapshots` call, and that the
     *   system should return the next page of data.
     * @param {object} [options]
     *   Call options. See {@link https://googleapis.dev/nodejs/google-gax/latest/interfaces/CallOptions.html|CallOptions} for more details.
     * @returns {Stream}
     *   An object stream which emits an object representing {@link protos.google.pubsub.v1.Snapshot|Snapshot} on 'data' event.
     *   The client library will perform auto-pagination by default: it will call the API as many
     *   times as needed. Note that it can affect your quota.
     *   We recommend using `listSnapshotsAsync()`
     *   method described below for async iteration which you can stop as needed.
     *   Please see the {@link https://github.com/googleapis/gax-nodejs/blob/master/client-libraries.md#auto-pagination | documentation }
     *   for more details and examples.
     */
    listSnapshotsStream(request?: protos.google.pubsub.v1.IListSnapshotsRequest, options?: CallOptions): Transform;
    /**
     * Equivalent to `listSnapshots`, but returns an iterable object.
     *
     * `for`-`await`-`of` syntax is used with the iterable to get response elements on-demand.
     * @param {Object} request
     *   The request object that will be sent.
     * @param {string} request.project
     *   Required. The name of the project in which to list snapshots.
     *   Format is `projects/{project-id}`.
     * @param {number} [request.pageSize]
     *   Optional. Maximum number of snapshots to return.
     * @param {string} [request.pageToken]
     *   Optional. The value returned by the last `ListSnapshotsResponse`; indicates
     *   that this is a continuation of a prior `ListSnapshots` call, and that the
     *   system should return the next page of data.
     * @param {object} [options]
     *   Call options. See {@link https://googleapis.dev/nodejs/google-gax/latest/interfaces/CallOptions.html|CallOptions} for more details.
     * @returns {Object}
     *   An iterable Object that allows {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Iteration_protocols | async iteration }.
     *   When you iterate the returned iterable, each element will be an object representing
     *   {@link protos.google.pubsub.v1.Snapshot|Snapshot}. The API will be called under the hood as needed, once per the page,
     *   so you can stop the iteration when you don't need more results.
     *   Please see the {@link https://github.com/googleapis/gax-nodejs/blob/master/client-libraries.md#auto-pagination | documentation }
     *   for more details and examples.
     */
    listSnapshotsAsync(request?: protos.google.pubsub.v1.IListSnapshotsRequest, options?: CallOptions): AsyncIterable<protos.google.pubsub.v1.ISnapshot>;
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
