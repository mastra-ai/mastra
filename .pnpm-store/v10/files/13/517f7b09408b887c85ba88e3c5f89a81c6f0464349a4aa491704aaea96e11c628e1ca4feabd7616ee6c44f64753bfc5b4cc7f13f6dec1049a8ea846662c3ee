"use strict";
// Copyright 2021-2025 Buf Technologies, Inc.
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
exports.timestampNow = timestampNow;
exports.timestampFromDate = timestampFromDate;
exports.timestampDate = timestampDate;
exports.timestampFromMs = timestampFromMs;
exports.timestampMs = timestampMs;
const timestamp_pb_js_1 = require("./gen/google/protobuf/timestamp_pb.js");
const create_js_1 = require("../create.js");
const proto_int64_js_1 = require("../proto-int64.js");
/**
 * Create a google.protobuf.Timestamp for the current time.
 */
function timestampNow() {
    return timestampFromDate(new Date());
}
/**
 * Create a google.protobuf.Timestamp message from an ECMAScript Date.
 */
function timestampFromDate(date) {
    return timestampFromMs(date.getTime());
}
/**
 * Convert a google.protobuf.Timestamp message to an ECMAScript Date.
 */
function timestampDate(timestamp) {
    return new Date(timestampMs(timestamp));
}
/**
 * Create a google.protobuf.Timestamp message from a Unix timestamp in milliseconds.
 */
function timestampFromMs(timestampMs) {
    const seconds = Math.floor(timestampMs / 1000);
    return (0, create_js_1.create)(timestamp_pb_js_1.TimestampSchema, {
        seconds: proto_int64_js_1.protoInt64.parse(seconds),
        nanos: (timestampMs - seconds * 1000) * 1000000,
    });
}
/**
 * Convert a google.protobuf.Timestamp to a Unix timestamp in milliseconds.
 */
function timestampMs(timestamp) {
    return (Number(timestamp.seconds) * 1000 + Math.round(timestamp.nanos / 1000000));
}
