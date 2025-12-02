"use strict";
/*!
 * Copyright 2020 Google LLC
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
exports.defaultOptions = void 0;
const temporal_1 = require("./temporal");
// These options will be used library-wide. They're specified here so that
// they can be changed easily in the future.
exports.defaultOptions = {
    subscription: {
        // The maximum number of messages that may be queued for receiving,
        // with the default lease manager.
        maxOutstandingMessages: 1000,
        // The maximum amount of message data that may be queued for receiving,
        // in bytes, with the default lease manager.
        maxOutstandingBytes: 100 * 1024 * 1024,
        // The minimum length of time a message's lease will be extended by.
        minAckDeadline: undefined,
        // The maximum length of time a message's lease will be extended by.
        maxAckDeadline: temporal_1.Duration.from({ minutes: 10 }),
        // The maximum amount of time that a message's lease will ever
        // be extended.
        maxExtensionTime: temporal_1.Duration.from({ minutes: 60 }),
        // The maximum number of subscription streams/threads that will ever
        // be opened.
        maxStreams: 5,
        // The starting number of seconds that ack deadlines will be extended.
        startingAckDeadline: temporal_1.Duration.from({ seconds: 10 }),
    },
    publish: {
        // The maximum number of messages we'll batch up for publish().
        maxOutstandingMessages: 100,
        // The maximum size of the total batched up messages for publish().
        maxOutstandingBytes: 1 * 1024 * 1024,
        // The maximum time we'll wait to send batched messages, in milliseconds.
        maxDelayMillis: 10,
    },
};
//# sourceMappingURL=default-options.js.map