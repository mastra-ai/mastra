"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.PubSub = void 0;
const paginator_1 = require("@google-cloud/paginator");
const projectify_1 = require("@google-cloud/projectify");
const extend = require("extend");
const google_auth_library_1 = require("google-auth-library");
const gax = require("google-gax");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const PKG = require('../../package.json');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const v1 = require('./v1');
const util_1 = require("./util");
const schema_1 = require("./schema");
const snapshot_1 = require("./snapshot");
const subscription_1 = require("./subscription");
const topic_1 = require("./topic");
const tracing = require("./telemetry-tracing");
/**
 * Project ID placeholder.
 * @type {string}
 * @private
 */
const PROJECT_ID_PLACEHOLDER = '{{projectId}}';
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
class PubSub {
    options;
    isEmulator;
    api;
    auth;
    projectId;
    name;
    // tslint:disable-next-line variable-name
    Promise;
    getSubscriptionsStream = paginator_1.paginator.streamify('getSubscriptions');
    getSnapshotsStream = paginator_1.paginator.streamify('getSnapshots');
    getTopicsStream = paginator_1.paginator.streamify('getTopics');
    isOpen = true;
    schemaClient;
    constructor(options) {
        // Needed for potentially large responses that may come from using exactly-once delivery,
        // as well as trying to work around silent connection failures.
        //
        // These will get passed down to grpc client objects. User values will overwrite these.
        const grpcDefaults = {
            'grpc.max_metadata_size': 4 * 1024 * 1024, // 4 MiB
            'grpc.keepalive_time_ms': 300000, // 5 minutes
            'grpc.keepalive_timeout_ms': 20000, // 20 seconds
        };
        options = Object.assign(grpcDefaults, options || {});
        // Determine what scopes are needed.
        // It is the union of the scopes on both clients.
        const clientClasses = [v1.SubscriberClient, v1.PublisherClient];
        const allScopes = {};
        for (const clientClass of clientClasses) {
            for (const scope of clientClass.scopes) {
                allScopes[scope] = true;
            }
        }
        this.options = Object.assign({
            libName: 'gccl',
            libVersion: PKG.version,
            scopes: Object.keys(allScopes),
        }, options);
        if (this.options.enableOpenTelemetryTracing) {
            tracing.setGloballyEnabled(true);
        }
        /**
         * @name PubSub#isEmulator
         * @type {boolean}
         */
        this.isEmulator = false;
        this.determineBaseUrl_();
        this.api = {};
        this.auth = new google_auth_library_1.GoogleAuth(this.options);
        this.projectId = this.options.projectId || PROJECT_ID_PLACEHOLDER;
        if (this.projectId !== PROJECT_ID_PLACEHOLDER) {
            this.name = PubSub.formatName_(this.projectId);
        }
    }
    /**
     * Returns true if we have actually resolved the full project name.
     *
     * @returns {boolean} true if the name is resolved.
     */
    get isIdResolved() {
        return this.projectId.indexOf(PROJECT_ID_PLACEHOLDER) < 0;
    }
    close(callback) {
        const definedCallback = callback || (() => { });
        if (this.isOpen) {
            this.isOpen = false;
            this.closeAllClients_()
                .then(() => this.schemaClient?.close())
                .then(() => {
                definedCallback(null);
            })
                .catch(definedCallback);
        }
        else {
            definedCallback(null);
        }
    }
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
    async createSchema(schemaId, type, definition, gaxOpts) {
        // This populates projectId for us.
        await this.getClientConfig();
        const schemaName = schema_1.Schema.formatName_(this.projectId, schemaId);
        const request = {
            parent: this.name,
            schemaId,
            schema: {
                name: schemaName,
                type,
                definition,
            },
        };
        const client = await this.getSchemaClient();
        await client.createSchema(request, gaxOpts);
        return new schema_1.Schema(this, schemaName);
    }
    createSubscription(topic, name, optionsOrCallback, callback) {
        if (typeof topic !== 'string' && !(topic instanceof topic_1.Topic)) {
            throw new Error('A Topic is required for a new subscription.');
        }
        if (typeof name !== 'string') {
            throw new Error('A subscription name is required.');
        }
        if (typeof topic === 'string') {
            topic = this.topic(topic);
        }
        let options = typeof optionsOrCallback === 'object'
            ? optionsOrCallback
            : {};
        callback =
            typeof optionsOrCallback === 'function' ? optionsOrCallback : callback;
        // Make a deep copy of options to not pollute caller object.
        options = extend(true, {}, options);
        const gaxOpts = options.gaxOpts;
        const flowControl = options.flowControl;
        delete options.gaxOpts;
        delete options.flowControl;
        const metadata = subscription_1.Subscription.formatMetadata_(options);
        let subscriptionCtorOptions = flowControl ? { flowControl } : {};
        subscriptionCtorOptions = Object.assign(subscriptionCtorOptions, metadata);
        const subscription = this.subscription(name, subscriptionCtorOptions);
        const reqOpts = Object.assign(metadata, {
            topic: topic.name,
            name: subscription.name,
        });
        this.request({
            client: 'SubscriberClient',
            method: 'createSubscription',
            reqOpts,
            gaxOpts,
        }, (err, resp) => {
            if (err) {
                callback(err, null, resp);
                return;
            }
            subscription.metadata = resp;
            callback(null, subscription, resp);
        });
    }
    createTopic(name, optsOrCallback, callback) {
        const reqOpts = typeof name === 'string'
            ? {
                name,
            }
            : name;
        // We don't allow a blank name, but this will let topic() handle that case.
        const topic = this.topic(reqOpts.name || '');
        // Topic#constructor might have canonicalized the name.
        reqOpts.name = topic.name;
        const gaxOpts = typeof optsOrCallback === 'object' ? optsOrCallback : {};
        callback = typeof optsOrCallback === 'function' ? optsOrCallback : callback;
        this.request({
            client: 'PublisherClient',
            method: 'createTopic',
            reqOpts,
            gaxOpts,
        }, (err, resp) => {
            if (err) {
                callback(err, null, resp);
                return;
            }
            topic.metadata = resp;
            callback(null, topic, resp);
        });
    }
    detachSubscription(name, optsOrCallback, callback) {
        if (typeof name !== 'string') {
            throw new Error('A subscription name is required.');
        }
        const sub = this.subscription(name);
        const reqOpts = {
            subscription: sub.name,
        };
        const gaxOpts = typeof optsOrCallback === 'object' ? optsOrCallback : {};
        callback = typeof optsOrCallback === 'function' ? optsOrCallback : callback;
        this.request({
            client: 'PublisherClient',
            method: 'detachSubscription',
            reqOpts,
            gaxOpts: gaxOpts,
        }, callback);
    }
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
    determineBaseUrl_() {
        // We allow an override from the client object options, or from
        // one of these variables. The CLOUDSDK variable is provided for
        // compatibility with the `gcloud alpha` utility.
        const gcloudVarName = 'CLOUDSDK_API_ENDPOINT_OVERRIDES_PUBSUB';
        const emulatorVarName = 'PUBSUB_EMULATOR_HOST';
        const apiEndpoint = this.options.apiEndpoint ||
            process.env[emulatorVarName] ||
            process.env[gcloudVarName];
        if (!apiEndpoint) {
            return;
        }
        // Parse the URL into a hostname and port, if possible.
        const leadingProtocol = new RegExp('^https?://');
        const trailingSlashes = new RegExp('/*$');
        const baseUrlParts = apiEndpoint
            .replace(leadingProtocol, '')
            .replace(trailingSlashes, '')
            .split(':');
        this.options.servicePath = baseUrlParts[0];
        if (!baseUrlParts[1]) {
            // No port was given -- figure it out from the protocol.
            if (apiEndpoint.startsWith('https')) {
                this.options.port = 443;
            }
            else if (apiEndpoint.startsWith('http')) {
                this.options.port = 80;
            }
            else {
                this.options.port = undefined;
            }
        }
        else {
            this.options.port = parseInt(baseUrlParts[1], 10);
        }
        // If this looks like a GCP URL of some kind, don't go into emulator
        // mode. Otherwise, supply a fake SSL provider so a real cert isn't
        // required for running the emulator.
        //
        // Note that users can provide their own URL here, especially with
        // TPC, so the emulatorMode flag lets them override this behaviour.
        const officialUrlMatch = this.options.servicePath.endsWith('.googleapis.com') ||
            this.options.universeDomain;
        if ((!officialUrlMatch && this.options.emulatorMode !== false) ||
            this.options.emulatorMode === true) {
            const grpcInstance = this.options.grpc || gax.grpc;
            this.options.sslCreds = grpcInstance.credentials.createInsecure();
            this.isEmulator = true;
        }
        if (!this.options.projectId && process.env.PUBSUB_PROJECT_ID) {
            this.options.projectId = process.env.PUBSUB_PROJECT_ID;
        }
    }
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
    async *listSchemas(view = schema_1.SchemaViews.Basic, options) {
        const client = await this.getSchemaClient();
        const query = {
            parent: this.name,
            view,
        };
        for await (const s of client.listSchemasAsync(query, options)) {
            yield s;
        }
    }
    getSnapshots(optsOrCallback, callback) {
        const options = typeof optsOrCallback === 'object' ? optsOrCallback : {};
        callback = typeof optsOrCallback === 'function' ? optsOrCallback : callback;
        const reqOpts = Object.assign({
            project: PubSub.formatName_(this.projectId),
        }, options);
        delete reqOpts.gaxOpts;
        delete reqOpts.autoPaginate;
        const gaxOpts = Object.assign({
            autoPaginate: options.autoPaginate,
        }, options.gaxOpts);
        this.request({
            client: 'SubscriberClient',
            method: 'listSnapshots',
            reqOpts,
            gaxOpts,
        }, (err, rawSnapshots, ...args) => {
            let snapshots;
            if (rawSnapshots) {
                snapshots = rawSnapshots.map((snapshot) => {
                    const snapshotInstance = this.snapshot(snapshot.name);
                    snapshotInstance.metadata = snapshot;
                    return snapshotInstance;
                });
            }
            callback(err, snapshots, ...args);
        });
    }
    getSubscriptions(optsOrCallback, callback) {
        const options = typeof optsOrCallback === 'object' ? optsOrCallback : {};
        callback = typeof optsOrCallback === 'function' ? optsOrCallback : callback;
        let topic = options.topic;
        if (topic) {
            if (!(topic instanceof topic_1.Topic)) {
                topic = this.topic(topic);
            }
            return topic.getSubscriptions(options, callback);
        }
        const reqOpts = Object.assign({}, options);
        reqOpts.project = 'projects/' + this.projectId;
        delete reqOpts.gaxOpts;
        delete reqOpts.autoPaginate;
        const gaxOpts = Object.assign({
            autoPaginate: options.autoPaginate,
        }, options.gaxOpts);
        this.request({
            client: 'SubscriberClient',
            method: 'listSubscriptions',
            reqOpts,
            gaxOpts,
        }, (err, rawSubs, ...args) => {
            let subscriptions;
            if (rawSubs) {
                subscriptions = rawSubs.map((sub) => {
                    const subscriptionInstance = this.subscription(sub.name);
                    subscriptionInstance.metadata = sub;
                    return subscriptionInstance;
                });
            }
            callback(err, subscriptions, ...args);
        });
    }
    getTopics(optsOrCallback, callback) {
        const options = typeof optsOrCallback === 'object' ? optsOrCallback : {};
        callback = typeof optsOrCallback === 'function' ? optsOrCallback : callback;
        const reqOpts = Object.assign({
            project: 'projects/' + this.projectId,
        }, options);
        delete reqOpts.gaxOpts;
        delete reqOpts.autoPaginate;
        const gaxOpts = Object.assign({
            autoPaginate: options.autoPaginate,
        }, options.gaxOpts);
        this.request({
            client: 'PublisherClient',
            method: 'listTopics',
            reqOpts,
            gaxOpts,
        }, (err, rawTopics, ...args) => {
            let topics;
            if (rawTopics) {
                topics = rawTopics.map(topic => {
                    const topicInstance = this.topic(topic.name);
                    topicInstance.metadata = topic;
                    return topicInstance;
                });
            }
            callback(err, topics, ...args);
        });
    }
    /**
     * Retrieve a client configuration, suitable for passing into a GAPIC
     * 'v1' class constructor. This will fill out projectId, emulator URLs,
     * and so forth.
     *
     * @returns {Promise<ClientConfig>} the filled client configuration.
     */
    async getClientConfig() {
        if (!this.projectId || this.projectId === PROJECT_ID_PLACEHOLDER) {
            let projectId;
            try {
                projectId = await this.auth.getProjectId();
            }
            catch (e) {
                if (!this.isEmulator) {
                    throw e;
                }
                projectId = '';
            }
            this.projectId = projectId;
            this.name = PubSub.formatName_(this.projectId);
            this.options.projectId = projectId;
        }
        return this.options;
    }
    /**
     * Gets a schema client, creating one if needed. This is a shortcut for
     * `new v1.SchemaServiceClient(await pubsub.getClientConfig())`.
     *
     * @returns {Promise<SchemaServiceClient>}
     */
    async getSchemaClient() {
        if (!this.schemaClient) {
            const options = await this.getClientConfig();
            this.schemaClient = new v1.SchemaServiceClient(options);
        }
        return this.schemaClient;
    }
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
    getClient_(config, callback) {
        this.getClientAsync_(config).then(client => callback(null, client), callback);
    }
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
    async getClientAsync_(config) {
        // Make sure we've got a fully created config with projectId and such.
        const options = await this.getClientConfig();
        let gaxClient = this.api[config.client];
        if (!gaxClient) {
            // Lazily instantiate client.
            gaxClient = new v1[config.client](options);
            this.api[config.client] = gaxClient;
        }
        return gaxClient;
    }
    /**
     * Close all open client objects.
     *
     * @private
     *
     * @returns {Promise}
     */
    async closeAllClients_() {
        const promises = [];
        for (const clientConfig of Object.keys(this.api)) {
            const gaxClient = this.api[clientConfig];
            promises.push(gaxClient.close());
            delete this.api[clientConfig];
        }
        await Promise.all(promises);
    }
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
    request(config, callback) {
        // This prevents further requests, in case any publishers were hanging around.
        if (!this.isOpen) {
            const statusObject = {
                code: 0,
                details: 'Cannot use a closed PubSub object.',
                metadata: null,
            };
            const err = new Error(statusObject.details);
            Object.assign(err, statusObject);
            callback(err);
            return;
        }
        this.getClient_(config, (err, client) => {
            if (err) {
                callback(err);
                return;
            }
            let reqOpts = extend(true, {}, config.reqOpts);
            reqOpts = (0, projectify_1.replaceProjectIdToken)(reqOpts, this.projectId);
            client[config.method](reqOpts, config.gaxOpts, callback);
        });
    }
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
    schema(idOrName) {
        return new schema_1.Schema(this, idOrName);
    }
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
    snapshot(name) {
        if (typeof name !== 'string') {
            throw new Error('You must supply a valid name for the snapshot.');
        }
        return new snapshot_1.Snapshot(this, name);
    }
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
    subscription(name, options) {
        if (!name) {
            throw new Error('A name must be specified for a subscription.');
        }
        return new subscription_1.Subscription(this, name, options);
    }
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
    topic(name, options) {
        if (!name) {
            throw new Error('A name must be specified for a topic.');
        }
        return new topic_1.Topic(this, name, options);
    }
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
    async validateSchema(schema, gaxOpts) {
        const client = await this.getSchemaClient();
        await client.validateSchema({
            parent: this.name,
            schema,
        }, gaxOpts);
    }
    /*!
     * Format the name of a project. A project's full name is in the
     * format of projects/{projectId}.
     *
     * The GAPIC client should do this for us, but since we maintain
     * names rather than IDs, this is simpler.
     *
     * @private
     */
    static formatName_(name) {
        if (typeof name !== 'string') {
            throw new Error('A name is required to identify a project.');
        }
        // Simple check if the name is already formatted.
        if (name.indexOf('/') > -1) {
            return name;
        }
        return `projects/${name}`;
    }
}
exports.PubSub = PubSub;
/**
 * Get a list of the {@link Snapshot} objects as a readable object stream.
 *
 * @method PubSub#getSnapshotsStream
 * @param {GetSnapshotsRequest} [options] Configuration object. See
 *     {@link PubSub#getSnapshots} for a complete list of options.
 * @returns {ReadableStream} A readable stream of {@link Snapshot} instances.
 *
 * @example
 * ```
 * const {PubSub} = require('@google-cloud/pubsub');
 * const pubsub = new PubSub();
 *
 * pubsub.getSnapshotsStream()
 *   .on('error', console.error)
 *   .on('data', function(snapshot) {
 *     // snapshot is a Snapshot object.
 *   })
 *   .on('end', function() {
 *     // All snapshots retrieved.
 *   });
 *
 * //-
 * // If you anticipate many results, you can end a stream early to prevent
 * // unnecessary processing and API requests.
 * //-
 * pubsub.getSnapshotsStream()
 *   .on('data', function(snapshot) {
 *     this.end();
 *   });
 * ```
 */
/**
 * Get a list of the {@link Subscription} objects registered to all of
 * your project's topics as a readable object stream.
 *
 * @method PubSub#getSubscriptionsStream
 * @param {GetSubscriptionsRequest} [options] Configuration object. See
 *     {@link PubSub#getSubscriptions} for a complete list of options.
 * @returns {ReadableStream} A readable stream of {@link Subscription} instances.
 *
 * @example
 * ```
 * const {PubSub} = require('@google-cloud/pubsub');
 * const pubsub = new PubSub();
 *
 * pubsub.getSubscriptionsStream()
 *   .on('error', console.error)
 *   .on('data', function(subscription) {
 *     // subscription is a Subscription object.
 *   })
 *   .on('end', function() {
 *     // All subscriptions retrieved.
 *   });
 *
 * //-
 * // If you anticipate many results, you can end a stream early to prevent
 * // unnecessary processing and API requests.
 * //-
 * pubsub.getSubscriptionsStream()
 *   .on('data', function(subscription) {
 *     this.end();
 *   });
 * ```
 */
/**
 * Get a list of the {module:pubsub/topic} objects registered to your project as
 * a readable object stream.
 *
 * @method PubSub#getTopicsStream
 * @param {GetTopicsRequest} [options] Configuration object. See
 *     {@link PubSub#getTopics} for a complete list of options.
 * @returns {ReadableStream} A readable stream of {@link Topic} instances.
 *
 * @example
 * ```
 * const {PubSub} = require('@google-cloud/pubsub');
 * const pubsub = new PubSub();
 *
 * pubsub.getTopicsStream()
 *   .on('error', console.error)
 *   .on('data', function(topic) {
 *     // topic is a Topic object.
 *   })
 *   .on('end', function() {
 *     // All topics retrieved.
 *   });
 *
 * //-
 * // If you anticipate many results, you can end a stream early to prevent
 * // unnecessary processing and API requests.
 * //-
 * pubsub.getTopicsStream()
 *   .on('data', function(topic) {
 *     this.end();
 *   });
 * ```
 */
/*! Developer Documentation
 *
 * These methods can be auto-paginated.
 */
paginator_1.paginator.extend(PubSub, ['getSnapshots', 'getSubscriptions', 'getTopics']);
/*! Developer Documentation
 *
 * Existing async methods (except for streams) will return a Promise in the event
 * that a callback is omitted. Future methods will not allow for a callback.
 * (Use .then() on the returned Promise instead.)
 */
(0, util_1.promisifySome)(PubSub, PubSub.prototype, [
    'close',
    'createSubscription',
    'createTopic',
    'detachSubscription',
    'getSnapshots',
    'getSubscriptions',
    'getTopics',
]);
//# sourceMappingURL=pubsub.js.map