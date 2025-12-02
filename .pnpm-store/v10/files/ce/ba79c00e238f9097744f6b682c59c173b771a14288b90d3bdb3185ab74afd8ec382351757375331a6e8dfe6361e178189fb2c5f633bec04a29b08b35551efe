"use strict";
// Copyright 2016 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Operation = void 0;
/*!
 * @module common/operation
 */
const service_object_1 = require("./service-object");
const util_1 = require("util");
// eslint-disable-next-line @typescript-eslint/no-explicit-any
class Operation extends service_object_1.ServiceObject {
    /**
     * An Operation object allows you to interact with APIs that take longer to
     * process things.
     *
     * @constructor
     * @alias module:common/operation
     *
     * @param {object} config - Configuration object.
     * @param {module:common/service|module:common/serviceObject|module:common/grpcService|module:common/grpcServiceObject} config.parent - The parent object.
     */
    constructor(config) {
        const methods = {
            /**
             * Checks to see if an operation exists.
             */
            exists: true,
            /**
             * Retrieves the operation.
             */
            get: true,
            /**
             * Retrieves metadata for the operation.
             */
            getMetadata: {
                reqOpts: {
                    name: config.id,
                },
            },
        };
        config = Object.assign({
            baseUrl: '',
        }, config);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        config.methods = (config.methods || methods);
        super(config);
        this.completeListeners = 0;
        this.hasActiveListeners = false;
        this.listenForEvents_();
    }
    /**
     * Wraps the `complete` and `error` events in a Promise.
     *
     * @return {Promise}
     */
    promise() {
        return new Promise((resolve, reject) => {
            this.on('error', reject).on('complete', (metadata) => {
                resolve([metadata]);
            });
        });
    }
    /**
     * Begin listening for events on the operation. This method keeps track of how
     * many "complete" listeners are registered and removed, making sure polling
     * is handled automatically.
     *
     * As long as there is one active "complete" listener, the connection is open.
     * When there are no more listeners, the polling stops.
     *
     * @private
     */
    listenForEvents_() {
        this.on('newListener', (event) => {
            if (event === 'complete') {
                this.completeListeners++;
                if (!this.hasActiveListeners) {
                    this.hasActiveListeners = true;
                    this.startPolling_();
                }
            }
        });
        this.on('removeListener', (event) => {
            if (event === 'complete' && --this.completeListeners === 0) {
                this.hasActiveListeners = false;
            }
        });
    }
    /**
     * Poll for a status update. Returns null for an incomplete
     * status, and metadata for a complete status.
     *
     * @private
     */
    poll_(callback) {
        this.getMetadata((err, body) => {
            if (err || body.error) {
                callback(err || body.error);
                return;
            }
            if (!body.done) {
                callback(null);
                return;
            }
            callback(null, body);
        });
    }
    /**
     * Poll `getMetadata` to check the operation's status. This runs a loop to
     * ping the API on an interval.
     *
     * Note: This method is automatically called once a "complete" event handler
     * is registered on the operation.
     *
     * @private
     */
    async startPolling_() {
        if (!this.hasActiveListeners) {
            return;
        }
        try {
            const metadata = await (0, util_1.promisify)(this.poll_.bind(this))();
            if (!metadata) {
                setTimeout(this.startPolling_.bind(this), this.pollIntervalMs || 500);
                return;
            }
            this.emit('complete', metadata);
        }
        catch (err) {
            this.emit('error', err);
        }
    }
}
exports.Operation = Operation;
//# sourceMappingURL=operation.js.map