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
exports.Snapshot = void 0;
const subscription_1 = require("./subscription");
const util_1 = require("./util");
/**
 * A Snapshot object will give you access to your Cloud Pub/Sub snapshot.
 *
 * Snapshots are sometimes retrieved when using various methods:
 *
 * - {@link PubSub#getSnapshots}
 * - {@link PubSub#getSnapshotsStream}
 * - {@link PubSub#snapshot}
 *
 * Snapshots may be created with:
 *
 * - {@link Subscription#createSnapshot}
 *
 * You can use snapshots to seek a subscription to a specific point in time.
 *
 * - {@link Subscription#seek}
 *
 * @class
 *
 * @example
 * ```
 * //-
 * // From {@link PubSub#getSnapshots}:
 * //-
 * pubsub.getSnapshots((err, snapshots) => {
 *   // `snapshots` is an array of Snapshot objects.
 * });
 *
 * //-
 * // From {@link PubSub#getSnapshotsStream}:
 * //-
 * pubsub.getSnapshotsStream()
 *   .on('error', console.error)
 *   .on('data', (snapshot) => {
 *     // `snapshot` is a Snapshot object.
 *   });
 *
 * //-
 * // From {@link PubSub#snapshot}:
 * //-
 * const snapshot = pubsub.snapshot('my-snapshot');
 * // snapshot is a Snapshot object.
 *
 * //-
 * // Create a snapshot with {module:pubsub/subscription#createSnapshot}:
 * //-
 * const subscription = pubsub.subscription('my-subscription');
 *
 * subscription.createSnapshot('my-snapshot', (err, snapshot) => {
 *   if (!err) {
 *     // `snapshot` is a Snapshot object.
 *   }
 * });
 *
 * //-
 * // Seek to your snapshot:
 * //-
 * const subscription = pubsub.subscription('my-subscription');
 *
 * subscription.seek('my-snapshot', (err) => {
 *   if (err) {
 *     // Error handling omitted.
 *   }
 * });
 * ```
 */
class Snapshot {
    parent;
    name;
    metadata;
    constructor(parent, name) {
        this.parent = parent;
        this.name = Snapshot.formatName_(parent.projectId, name);
    }
    delete(callback) {
        const reqOpts = {
            snapshot: this.name,
        };
        this.parent.request({
            client: 'SubscriberClient',
            method: 'deleteSnapshot',
            reqOpts,
        }, callback);
    }
    /*@
     * Format the name of a snapshot. A snapshot's full name is in the format of
     * projects/{projectId}/snapshots/{snapshotName}
     *
     * @private
     */
    static formatName_(projectId, name) {
        return 'projects/' + projectId + '/snapshots/' + name.split('/').pop();
    }
    create(optsOrCallback, callback) {
        if (!(this.parent instanceof subscription_1.Subscription)) {
            throw new Error('This is only available if you accessed this object through Subscription#snapshot');
        }
        const options = typeof optsOrCallback === 'object' ? optsOrCallback : {};
        callback = typeof optsOrCallback === 'function' ? optsOrCallback : callback;
        return this.parent.createSnapshot(this.name, options, (err, snapshot, resp) => {
            if (err) {
                callback(err, null, resp);
                return;
            }
            Object.assign(this, snapshot);
            callback(null, this, resp);
        });
    }
    seek(gaxOpts, callback) {
        if (!(this.parent instanceof subscription_1.Subscription)) {
            throw new Error('This is only available if you accessed this object through Subscription#snapshot');
        }
        return this.parent.seek(this.name, gaxOpts, callback);
    }
}
exports.Snapshot = Snapshot;
/*! Developer Documentation
 *
 * Existing async methods (except for streams) will return a Promise in the event
 * that a callback is omitted. Future methods will not allow for a callback.
 * (Use .then() on the returned Promise instead.)
 */
(0, util_1.promisifySome)(Snapshot, Snapshot.prototype, ['delete', 'create', 'seek']);
//# sourceMappingURL=snapshot.js.map