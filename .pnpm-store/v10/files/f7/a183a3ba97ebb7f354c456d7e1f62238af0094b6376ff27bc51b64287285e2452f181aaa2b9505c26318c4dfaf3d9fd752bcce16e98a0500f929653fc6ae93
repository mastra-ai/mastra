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
import { TimestampSchema } from "./gen/google/protobuf/timestamp_pb.js";
import { create } from "../create.js";
import { protoInt64 } from "../proto-int64.js";
/**
 * Create a google.protobuf.Timestamp for the current time.
 */
export function timestampNow() {
    return timestampFromDate(new Date());
}
/**
 * Create a google.protobuf.Timestamp message from an ECMAScript Date.
 */
export function timestampFromDate(date) {
    return timestampFromMs(date.getTime());
}
/**
 * Convert a google.protobuf.Timestamp message to an ECMAScript Date.
 */
export function timestampDate(timestamp) {
    return new Date(timestampMs(timestamp));
}
/**
 * Create a google.protobuf.Timestamp message from a Unix timestamp in milliseconds.
 */
export function timestampFromMs(timestampMs) {
    const seconds = Math.floor(timestampMs / 1000);
    return create(TimestampSchema, {
        seconds: protoInt64.parse(seconds),
        nanos: (timestampMs - seconds * 1000) * 1000000,
    });
}
/**
 * Convert a google.protobuf.Timestamp to a Unix timestamp in milliseconds.
 */
export function timestampMs(timestamp) {
    return (Number(timestamp.seconds) * 1000 + Math.round(timestamp.nanos / 1000000));
}
