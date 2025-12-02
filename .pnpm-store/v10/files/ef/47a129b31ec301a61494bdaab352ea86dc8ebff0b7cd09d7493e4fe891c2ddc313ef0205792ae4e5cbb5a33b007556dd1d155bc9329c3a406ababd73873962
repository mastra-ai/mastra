/*! firebase-admin v13.5.0 */
"use strict";
/*!
 * @license
 * Copyright 2022 Google Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.Channel = exports.Eventarc = void 0;
const validator = require("../utils/validator");
const eventarc_utils_1 = require("./eventarc-utils");
const eventarc_client_internal_1 = require("./eventarc-client-internal");
/**
 * Eventarc service bound to the provided app.
 */
class Eventarc {
    /**
     * @internal
     */
    constructor(app) {
        if (!validator.isNonNullObject(app) || !('options' in app)) {
            throw new eventarc_utils_1.FirebaseEventarcError('invalid-argument', 'First argument passed to Eventarc() must be a valid Firebase app instance.');
        }
        this.appInternal = app;
    }
    /**
     * The {@link firebase-admin.app#App} associated with the current Eventarc service
     * instance.
     *
     * @example
     * ```javascript
     * var app = eventarc.app;
     * ```
     */
    get app() {
        return this.appInternal;
    }
    channel(nameOrOptions, options) {
        let channel;
        let opts;
        if (validator.isNonEmptyString(nameOrOptions)) {
            channel = nameOrOptions;
        }
        else {
            channel = 'locations/us-central1/channels/firebase';
        }
        if (validator.isNonNullObject(nameOrOptions)) {
            opts = nameOrOptions;
        }
        else {
            opts = options;
        }
        let allowedEventTypes = undefined;
        if (typeof opts?.allowedEventTypes === 'string') {
            allowedEventTypes = opts.allowedEventTypes.split(',');
        }
        else if (validator.isArray(opts?.allowedEventTypes)) {
            allowedEventTypes = opts?.allowedEventTypes;
        }
        else if (typeof opts?.allowedEventTypes !== 'undefined') {
            throw new eventarc_utils_1.FirebaseEventarcError('invalid-argument', 'AllowedEventTypes must be either an array of strings or a comma separated string.');
        }
        return new Channel(this, channel, allowedEventTypes);
    }
}
exports.Eventarc = Eventarc;
/**
 * Eventarc Channel.
 */
class Channel {
    /**
     * @internal
     */
    constructor(eventarc, name, allowedEventTypes) {
        if (!validator.isNonNullObject(eventarc)) {
            throw new eventarc_utils_1.FirebaseEventarcError('invalid-argument', 'First argument passed to Channel() must be a valid Eventarc service instance.');
        }
        if (!validator.isNonEmptyString(name)) {
            throw new eventarc_utils_1.FirebaseEventarcError('invalid-argument', 'name is required.');
        }
        this.nameInternal = name;
        this.eventarcInternal = eventarc;
        this.allowedEventTypes = allowedEventTypes;
        this.client = new eventarc_client_internal_1.EventarcApiClient(eventarc.app, this);
    }
    /**
     * The {@link firebase-admin.eventarc#Eventarc} service instance associated with the current `Channel`.
     *
     * @example
     * ```javascript
     * var app = channel.eventarc;
     * ```
     */
    get eventarc() {
        return this.eventarcInternal;
    }
    /**
     * The channel name as provided during channel creation. If it was not specifed, the default channel name is returned
     * ('locations/us-central1/channels/firebase').
     */
    get name() {
        return this.nameInternal;
    }
    /**
     * Publishes provided events to this channel. If channel was created with `allowedEventTypes` and event type is not
     * on that list, the event is ignored.
     *
     * @param events - CloudEvent to publish to the channel.
     */
    publish(events) {
        return this.client.publish(events);
    }
}
exports.Channel = Channel;
