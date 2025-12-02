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
exports.IAM = void 0;
/*!
 * @module pubsub/iam
 */
const arrify = require("arrify");
const util_1 = require("./util");
/**
 * [IAM (Identity and Access
 * Management)](https://cloud.google.com/pubsub/access_control) allows you to
 * set permissions on individual resources and offers a wider range of roles:
 * editor, owner, publisher, subscriber, and viewer. This gives you greater
 * flexibility and allows you to set more fine-grained access control.
 *
 * For example:
 *   * Grant access on a per-topic or per-subscription basis, rather than for
 *     the whole Cloud project.
 *   * Grant access with limited capabilities, such as to only publish messages
 *     to a topic, or to only to consume messages from a subscription, but not
 *     to delete the topic or subscription.
 *
 *
 * *The IAM access control features described in this document are Beta,
 * including the API methods to get and set IAM policies, and to test IAM
 * permissions. Cloud Pub/Sub's use of IAM features is not covered by any
 * SLA or deprecation policy, and may be subject to backward-incompatible
 * changes.*
 *
 * @class
 * @param {PubSub} pubsub PubSub Object.
 * @param {string} id The name of the topic or subscription.
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
 * // topic.iam
 *
 * const subscription = pubsub.subscription('my-subscription');
 * // subscription.iam
 * ```
 */
class IAM {
    pubsub;
    request;
    nameable_;
    constructor(pubsub, nameOrNameable) {
        this.pubsub = pubsub;
        this.request = pubsub.request.bind(pubsub);
        if (typeof nameOrNameable === 'string') {
            this.nameable_ = {
                name: nameOrNameable,
            };
        }
        else {
            this.nameable_ = nameOrNameable;
        }
    }
    get id() {
        return this.nameable_.name;
    }
    getPolicy(optsOrCallback, callback) {
        const gaxOpts = typeof optsOrCallback === 'object' ? optsOrCallback : {};
        callback = typeof optsOrCallback === 'function' ? optsOrCallback : callback;
        const reqOpts = {
            resource: this.id,
        };
        this.request({
            client: 'SubscriberClient',
            method: 'getIamPolicy',
            reqOpts,
            gaxOpts,
        }, callback);
    }
    setPolicy(policy, optsOrCallback, callback) {
        if (!(typeof policy === 'object')) {
            throw new Error('A policy object is required.');
        }
        const gaxOpts = typeof optsOrCallback === 'object' ? optsOrCallback : {};
        callback = typeof optsOrCallback === 'function' ? optsOrCallback : callback;
        const reqOpts = {
            resource: this.id,
            policy,
        };
        this.request({
            client: 'SubscriberClient',
            method: 'setIamPolicy',
            reqOpts,
            gaxOpts,
        }, callback);
    }
    testPermissions(permissions, optsOrCallback, callback) {
        if (!Array.isArray(permissions) && !(typeof permissions === 'string')) {
            throw new Error('Permissions are required.');
        }
        const gaxOpts = typeof optsOrCallback === 'object' ? optsOrCallback : {};
        callback = typeof optsOrCallback === 'function' ? optsOrCallback : callback;
        const reqOpts = {
            resource: this.id,
            permissions: arrify(permissions),
        };
        this.request({
            client: 'SubscriberClient',
            method: 'testIamPermissions',
            reqOpts,
            gaxOpts,
        }, (err, resp) => {
            if (err) {
                callback(err, null, resp);
                return;
            }
            const availablePermissions = arrify(resp.permissions);
            const permissionHash = permissions.reduce((acc, permission) => {
                acc[permission] = availablePermissions.indexOf(permission) > -1;
                return acc;
            }, {});
            callback(null, permissionHash, resp);
        });
    }
}
exports.IAM = IAM;
/*! Developer Documentation
 *
 * Existing async methods (except for streams) will return a Promise in the event
 * that a callback is omitted. Future methods will not allow for a callback.
 * (Use .then() on the returned Promise instead.)
 */
(0, util_1.promisifySome)(IAM, IAM.prototype, [
    'getPolicy',
    'setPolicy',
    'testPermissions',
]);
//# sourceMappingURL=iam.js.map