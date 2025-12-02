"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.Topic = void 0;
const paginator_1 = require("@google-cloud/paginator");
const iam_1 = require("./iam");
const publisher_1 = require("./publisher");
const flow_publisher_1 = require("./publisher/flow-publisher");
const util_1 = require("./util");
const snakeCase = require("lodash.snakecase");
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
class Topic {
    parent;
    pubsub;
    request;
    iam;
    metadata;
    publisher;
    getSubscriptionsStream = paginator_1.paginator.streamify('getSubscriptions');
    constructor(pubsub, name, options) {
        /**
         * The fully qualified name of this topic. May have a placeholder for
         * the projectId if it's not been resolved.
         * @name Topic#name
         * @type {string}
         */
        this.id_ = name;
        /**
         * The parent {@link PubSub} instance of this topic instance.
         * @name Topic#pubsub
         * @type {PubSub}
         */
        /**
         * The parent {@link PubSub} instance of this topic instance.
         * @name Topic#parent
         * @type {PubSub}
         */
        this.parent = this.pubsub = pubsub;
        this.publisher = new publisher_1.Publisher(this, options);
        this.request = pubsub.request.bind(pubsub);
        /**
         * [IAM (Identity and Access
         * Management)](https://cloud.google.com/pubsub/access_control) allows you
         * to set permissions on individual resources and offers a wider range of
         * roles: editor, owner, publisher, subscriber, and viewer. This gives you
         * greater flexibility and allows you to set more fine-grained access
         * control.
         *
         * *The IAM access control features described in this document are Beta,
         * including the API methods to get and set IAM policies, and to test IAM
         * permissions. Cloud Pub/Sub's use of IAM features is not covered by
         * any SLA or deprecation policy, and may be subject to
         * backward-incompatible changes.*
         *
         * @name Topic#iam
         * @mixes IAM
         *
         * @see [Access Control Overview]{@link https://cloud.google.com/pubsub/access_control}
         * @see [What is Cloud IAM?]{@link https://cloud.google.com/iam/}
         *
         * @example
         * ```
         * const {PubSub} = require('@google-cloud/pubsub');
         * const pubsub = new PubSub();
         *
         * const topic = pubsub.topic('my-topic');
         *
         * //-
         * // Get the IAM policy for your topic.
         * //-
         * topic.iam.getPolicy((err, policy) => {
         *   console.log(policy);
         * });
         *
         * //-
         * // If the callback is omitted, we'll return a Promise.
         * //-
         * topic.iam.getPolicy().then((data) => {
         *   const policy = data[0];
         *   const apiResponse = data[1];
         * });
         * ```
         */
        this.iam = new iam_1.IAM(pubsub, this);
    }
    id_;
    get name() {
        return Topic.formatName_(this.parent.projectId, this.id_);
    }
    flush(callback) {
        // It doesn't matter here if callback is undefined; the Publisher
        // flush() will handle it.
        this.publisher.flush(callback);
    }
    create(optsOrCallback, callback) {
        const gaxOpts = typeof optsOrCallback === 'object' ? optsOrCallback : {};
        callback = typeof optsOrCallback === 'function' ? optsOrCallback : callback;
        this.pubsub.createTopic(this.name, gaxOpts, callback);
    }
    createSubscription(name, optsOrCallback, callback) {
        const options = typeof optsOrCallback === 'object' ? optsOrCallback : {};
        callback = typeof optsOrCallback === 'function' ? optsOrCallback : callback;
        this.pubsub.createSubscription(this, name, options, callback);
    }
    delete(optsOrCallback, callback) {
        const gaxOpts = typeof optsOrCallback === 'object' ? optsOrCallback : {};
        callback = typeof optsOrCallback === 'function' ? optsOrCallback : callback;
        const reqOpts = {
            topic: this.name,
        };
        this.request({
            client: 'PublisherClient',
            method: 'deleteTopic',
            reqOpts,
            gaxOpts: gaxOpts,
        }, callback);
    }
    exists(callback) {
        this.getMetadata(err => {
            if (!err) {
                callback(null, true);
                return;
            }
            if (err.code === 5) {
                callback(null, false);
                return;
            }
            callback(err);
        });
    }
    get(optsOrCallback, callback) {
        const gaxOpts = typeof optsOrCallback === 'object' ? optsOrCallback : {};
        callback = typeof optsOrCallback === 'function' ? optsOrCallback : callback;
        const autoCreate = !!gaxOpts.autoCreate;
        delete gaxOpts.autoCreate;
        this.getMetadata(gaxOpts, (err, apiResponse) => {
            if (!err) {
                callback(null, this, apiResponse);
                return;
            }
            if (err.code !== 5 || !autoCreate) {
                callback(err, null, apiResponse);
                return;
            }
            this.create(gaxOpts, callback);
        });
    }
    getMetadata(optsOrCallback, callback) {
        const gaxOpts = typeof optsOrCallback === 'object' ? optsOrCallback : {};
        callback = typeof optsOrCallback === 'function' ? optsOrCallback : callback;
        const reqOpts = {
            topic: this.name,
        };
        this.request({
            client: 'PublisherClient',
            method: 'getTopic',
            reqOpts,
            gaxOpts: gaxOpts,
        }, (err, apiResponse) => {
            if (!err) {
                this.metadata = apiResponse;
            }
            callback(err, apiResponse);
        });
    }
    getSubscriptions(optsOrCallback, callback) {
        const options = typeof optsOrCallback === 'object' ? optsOrCallback : {};
        callback = typeof optsOrCallback === 'function' ? optsOrCallback : callback;
        const reqOpts = Object.assign({
            topic: this.name,
        }, options);
        delete reqOpts.gaxOpts;
        delete reqOpts.autoPaginate;
        const gaxOpts = Object.assign({
            autoPaginate: options.autoPaginate,
        }, options.gaxOpts);
        this.request({
            client: 'PublisherClient',
            method: 'listTopicSubscriptions',
            reqOpts,
            gaxOpts,
        }, (err, subNames, ...args) => {
            let subscriptions;
            if (subNames) {
                subscriptions = subNames.map((sub) => this.subscription(sub));
            }
            callback(err, subscriptions, ...args);
        });
    }
    publish(data, attrsOrCb, callback) {
        const attributes = typeof attrsOrCb === 'object' ? attrsOrCb : {};
        callback = typeof attrsOrCb === 'function' ? attrsOrCb : callback;
        return this.publishMessage({ data, attributes }, callback);
    }
    publishJSON(json, attrsOrCb, callback) {
        if (!json || typeof json !== 'object') {
            throw new Error('First parameter should be an object.');
        }
        const attributes = typeof attrsOrCb === 'object' ? attrsOrCb : {};
        callback = typeof attrsOrCb === 'function' ? attrsOrCb : callback;
        return this.publishMessage({ json, attributes }, callback);
    }
    publishMessage(message, callback) {
        // Make a copy to ensure that any changes we make to it will not
        // propagate up to the user's data.
        message = Object.assign({}, message);
        if (message.json && typeof message.json === 'object') {
            message.data = Buffer.from(JSON.stringify(message.json));
            delete message.json;
        }
        return this.publisher.publishMessage(message, callback);
    }
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
    flowControlled() {
        return new flow_publisher_1.FlowControlledPublisher(this.publisher);
    }
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
    resumePublishing(orderingKey) {
        this.publisher.resumePublishing(orderingKey);
    }
    setMetadata(options, optsOrCallback, callback) {
        const gaxOpts = typeof optsOrCallback === 'object' ? optsOrCallback : {};
        callback = typeof optsOrCallback === 'function' ? optsOrCallback : callback;
        const topic = Object.assign({ name: this.name }, options);
        const updateMask = { paths: Object.keys(options).map(snakeCase) };
        const reqOpts = { topic, updateMask };
        this.request({
            client: 'PublisherClient',
            method: 'updateTopic',
            reqOpts,
            gaxOpts,
        }, callback);
    }
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
    setPublishOptions(options) {
        this.publisher.setOptions(options);
    }
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
    getPublishOptionDefaults() {
        // Generally I'd leave this as a static, but it'll be easier for users to
        // get at when they're using the veneer objects.
        return this.publisher.getOptionDefaults();
    }
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
    subscription(name, options) {
        options = options || {};
        options.topic = this;
        return this.pubsub.subscription(name, options);
    }
    /**
     * Format the name of a topic. A Topic's full name is in the format of
     * 'projects/{projectId}/topics/{topicName}'.
     *
     * @private
     *
     * @return {string}
     */
    static formatName_(projectId, name) {
        // Simple check if the name is already formatted.
        if (name.indexOf('/') > -1) {
            return name;
        }
        return 'projects/' + projectId + '/topics/' + name;
    }
}
exports.Topic = Topic;
/**
 * Get a list of the {module:pubsub/subscription} objects registered to this
 * topic as a readable object stream.
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
 * const topic = pubsub.topic('my-topic');
 *
 * topic.getSubscriptionsStream()
 *   .on('error', console.error)
 *   .on('data', (subscription) => {
 *     // subscription is a Subscription object.
 *   })
 *   .on('end', () => {
 *     // All subscriptions retrieved.
 *   });
 *
 * //-
 * // If you anticipate many results, you can end a stream early to prevent
 * // unnecessary processing and API requests.
 * //-
 * topic.getSubscriptionsStream()
 *   .on('data', function(subscription) {
 *     this.end();
 *   });
 * ```
 */
/*! Developer Documentation
 *
 * These methods can be agto-paginated.
 */
paginator_1.paginator.extend(Topic, ['getSubscriptions']);
/*! Developer Documentation
 *
 * Existing async methods (except for streams) will return a Promise in the event
 * that a callback is omitted. Future methods will not allow for a callback.
 * (Use .then() on the returned Promise instead.)
 */
(0, util_1.promisifySome)(Topic, Topic.prototype, [
    'flush',
    'create',
    'createSubscription',
    'delete',
    'exists',
    'get',
    'getMetadata',
    'getSubscriptions',
    'setMetadata',
]);
//# sourceMappingURL=topic.js.map