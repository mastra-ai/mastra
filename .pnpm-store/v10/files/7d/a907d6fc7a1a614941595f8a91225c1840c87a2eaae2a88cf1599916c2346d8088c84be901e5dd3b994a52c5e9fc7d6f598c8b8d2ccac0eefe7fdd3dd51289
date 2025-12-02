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
import { DurationSchema } from "./gen/google/protobuf/duration_pb.js";
import { create } from "../create.js";
import { protoInt64 } from "../proto-int64.js";
/**
 * Create a google.protobuf.Duration message from a Unix timestamp in milliseconds.
 */
export function durationFromMs(durationMs) {
    const sign = durationMs < 0 ? -1 : 1;
    const absDurationMs = Math.abs(durationMs);
    const absSeconds = Math.floor(absDurationMs / 1000);
    const absNanos = (absDurationMs - absSeconds * 1000) * 1000000;
    return create(DurationSchema, {
        seconds: protoInt64.parse(absSeconds * sign),
        nanos: absNanos === 0 ? 0 : absNanos * sign, // deliberately avoid signed 0 - it does not serialize
    });
}
/**
 * Convert a google.protobuf.Duration to a Unix timestamp in milliseconds.
 */
export function durationMs(duration) {
    return Number(duration.seconds) * 1000 + Math.round(duration.nanos / 1000000);
}
