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
exports.Subscription = exports.SubscriptionCloseBehaviors = exports.AckResponses = exports.AckError = void 0;
const extend = require("extend");
const snakeCase = require("lodash.snakecase");
const iam_1 = require("./iam");
const snapshot_1 = require("./snapshot");
const subscriber_1 = require("./subscriber");
const util_1 = require("./util");
const stream_1 = require("stream");
var subscriber_2 = require("./subscriber");
Object.defineProperty(exports, "AckError", { enumerable: true, get: function () { return subscriber_2.AckError; } });
Object.defineProperty(exports, "AckResponses", { enumerable: true, get: function () { return subscriber_2.AckResponses; } });
exports.SubscriptionCloseBehaviors = subscriber_1.SubscriberCloseBehaviors;
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
class Subscription extends stream_1.EventEmitter {
    // Note: WrappingEmitter is used here to wrap user processing callbacks.
    // We do this to be able to build telemetry spans around them.
    pubsub;
    iam;
    topic;
    metadata;
    request;
    _subscriber;
    constructor(pubsub, name, options) {
        super();
        options = options || {};
        this.pubsub = pubsub;
        this.request = pubsub.request.bind(pubsub);
        this.id_ = name;
        this.topic = options.topic;
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
         * @name Subscription#iam
         * @mixes IAM
         *
         * @see [Access Control Overview]{@link https://cloud.google.com/pubsub/access_control}
         * @see [What is Cloud IAM?]{@link https://cloud.google.com/iam/}
         *
         * @example
         * ```
         * //-
         * // Get the IAM policy for your subscription.
         * //-
         * subscription.iam.getPolicy((err, policy) => {
         *   console.log(policy);
         * });
         *
         * //-
         * // If the callback is omitted, we'll return a Promise.
         * //-
         * subscription.iam.getPolicy().then((data) => {
         *   const policy = data[0];
         *   const apiResponse = data[1];
         * });
         * ```
         */
        this.iam = new iam_1.IAM(pubsub, this);
        this._subscriber = new subscriber_1.Subscriber(this, options);
        this._subscriber
            .on('error', err => this.emit('error', err))
            .on('debug', msg => this.emit('debug', msg))
            .on('message', message => this.emit('message', message))
            .on('close', () => this.emit('close'));
        this._listen();
    }
    id_;
    get name() {
        return Subscription.formatName_(this.pubsub.projectId, this.id_);
    }
    /**
     * Indicates if the Subscription is open and receiving messages.
     *
     * @type {boolean}
     */
    get isOpen() {
        return !!(this._subscriber && this._subscriber.isOpen);
    }
    /**
     * @type {string}
     */
    get projectId() {
        return (this.pubsub && this.pubsub.projectId) || '{{projectId}}';
    }
    close(callback) {
        this._subscriber.close().then(() => callback(), callback);
    }
    create(optsOrCallback, callback) {
        if (!this.topic) {
            throw new Error('Subscriptions can only be created when accessed through Topics');
        }
        const name = this.name.split('/').pop();
        const options = typeof optsOrCallback === 'object' ? optsOrCallback : {};
        callback = typeof optsOrCallback === 'function' ? optsOrCallback : callback;
        this.pubsub.createSubscription(this.topic, name, options, (err, sub, resp) => {
            if (err) {
                callback(err, null, resp);
                return;
            }
            Object.assign(this, sub);
            callback(null, this, resp);
        });
    }
    createSnapshot(name, optsOrCallback, callback) {
        if (typeof name !== 'string') {
            throw new Error('A name is required to create a snapshot.');
        }
        const gaxOpts = typeof optsOrCallback === 'object' ? optsOrCallback : {};
        callback = typeof optsOrCallback === 'function' ? optsOrCallback : callback;
        const snapshot = this.snapshot(name);
        const reqOpts = {
            name: snapshot.name,
            subscription: this.name,
        };
        this.request({
            client: 'SubscriberClient',
            method: 'createSnapshot',
            reqOpts,
            gaxOpts,
        }, (err, resp) => {
            if (err) {
                callback(err, null, resp);
                return;
            }
            snapshot.metadata = resp;
            callback(null, snapshot, resp);
        });
    }
    delete(optsOrCallback, callback) {
        const gaxOpts = typeof optsOrCallback === 'object' ? optsOrCallback : {};
        callback = typeof optsOrCallback === 'function' ? optsOrCallback : callback;
        const reqOpts = {
            subscription: this.name,
        };
        if (this.isOpen) {
            void this._subscriber.close();
        }
        this.request({
            client: 'SubscriberClient',
            method: 'deleteSubscription',
            reqOpts,
            gaxOpts,
        }, callback);
    }
    detached(callback) {
        this.getMetadata((err, metadata) => {
            if (err) {
                callback(err);
            }
            else {
                callback(null, metadata.detached);
            }
        });
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
        const autoCreate = !!gaxOpts.autoCreate && this.topic;
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
            this.create({ gaxOpts }, callback);
        });
    }
    getMetadata(optsOrCallback, callback) {
        const gaxOpts = typeof optsOrCallback === 'object' ? optsOrCallback : {};
        callback = typeof optsOrCallback === 'function' ? optsOrCallback : callback;
        const reqOpts = {
            subscription: this.name,
        };
        this.request({
            client: 'SubscriberClient',
            method: 'getSubscription',
            reqOpts,
            gaxOpts,
        }, (err, apiResponse) => {
            if (!err) {
                this.metadata = apiResponse;
            }
            callback(err, apiResponse);
        });
    }
    modifyPushConfig(config, optsOrCallback, callback) {
        const gaxOpts = typeof optsOrCallback === 'object' ? optsOrCallback : {};
        callback = typeof optsOrCallback === 'function' ? optsOrCallback : callback;
        const reqOpts = {
            subscription: this.name,
            pushConfig: config,
        };
        this.request({
            client: 'SubscriberClient',
            method: 'modifyPushConfig',
            reqOpts,
            gaxOpts,
        }, callback);
    }
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
    open() {
        if (!this._subscriber.isOpen) {
            this._subscriber.open();
        }
    }
    seek(snapshot, optsOrCallback, callback) {
        const gaxOpts = typeof optsOrCallback === 'object' ? optsOrCallback : {};
        callback = typeof optsOrCallback === 'function' ? optsOrCallback : callback;
        const reqOpts = {
            subscription: this.name,
        };
        if (typeof snapshot === 'string') {
            reqOpts.snapshot = snapshot_1.Snapshot.formatName_(this.pubsub.projectId, snapshot);
        }
        else if (Object.prototype.toString.call(snapshot) === '[object Date]') {
            const dateMillis = snapshot.getTime();
            reqOpts.time = {
                seconds: Math.floor(dateMillis / 1000),
                nanos: Math.floor(dateMillis % 1000) * 1000,
            };
        }
        else {
            throw new Error('Either a snapshot name or Date is needed to seek to.');
        }
        this.request({
            client: 'SubscriberClient',
            method: 'seek',
            reqOpts,
            gaxOpts,
        }, callback);
    }
    setMetadata(metadata, optsOrCallback, callback) {
        const gaxOpts = typeof optsOrCallback === 'object' ? optsOrCallback : {};
        callback = typeof optsOrCallback === 'function' ? optsOrCallback : callback;
        const subscription = Subscription.formatMetadata_(metadata);
        const fields = Object.keys(subscription).map(snakeCase);
        subscription.name = this.name;
        const reqOpts = {
            subscription,
            updateMask: {
                paths: fields,
            },
        };
        this.request({
            client: 'SubscriberClient',
            method: 'updateSubscription',
            reqOpts,
            gaxOpts,
        }, callback);
    }
    /**
     * Sets the Subscription options.
     *
     * @param {SubscriberOptions} options The options.
     */
    setOptions(options) {
        this._subscriber.setOptions(options);
    }
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
    snapshot(name) {
        return this.pubsub.snapshot.call(this, name);
    }
    /**
     * Watches for incoming message event handlers and open/closes the
     * subscriber as needed.
     *
     * @private
     */
    _listen() {
        this.on('newListener', event => {
            if (!this.isOpen && event === 'message') {
                this._subscriber.open();
            }
        });
        this.on('removeListener', () => {
            if (this.isOpen && this.listenerCount('message') === 0) {
                void this._subscriber.close();
            }
        });
    }
    /*!
     * Formats Subscription metadata.
     *
     * @private
     */
    static formatMetadata_(metadata) {
        const formatted = extend(true, {}, metadata);
        if (typeof metadata.messageRetentionDuration === 'number') {
            formatted.messageRetentionDuration = {
                seconds: metadata.messageRetentionDuration,
                nanos: 0,
            };
        }
        if (metadata.pushEndpoint) {
            formatted.pushConfig = {
                pushEndpoint: metadata.pushEndpoint,
            };
            delete formatted.pushEndpoint;
        }
        if (metadata.oidcToken) {
            formatted.pushConfig = {
                ...formatted.pushConfig,
                oidcToken: metadata.oidcToken,
            };
            delete formatted.oidcToken;
        }
        return formatted;
    }
    /*!
     * Format the name of a subscription. A subscription's full name is in the
     * format of projects/{projectId}/subscriptions/{subName}.
     *
     * @private
     */
    static formatName_(projectId, name) {
        // Simple check if the name is already formatted.
        if (name.indexOf('/') > -1) {
            return name;
        }
        return 'projects/' + projectId + '/subscriptions/' + name;
    }
}
exports.Subscription = Subscription;
/*! Developer Documentation
 *
 * All async methods (except for streams) will return a Promise in the event
 * that a callback is omitted.
 */
(0, util_1.promisifySome)(Subscription, Subscription.prototype, [
    'close',
    'create',
    'createSnapshot',
    'delete',
    'detached',
    'exists',
    'get',
    'getMetadata',
    'modifyPushConfig',
    'seek',
    'setMetadata',
]);
//# sourceMappingURL=subscription.js.map