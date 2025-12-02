"use strict";
// Copyright 2022 Google LLC
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
exports.processAckErrorInfo = processAckErrorInfo;
exports.processAckRpcError = processAckRpcError;
const google_gax_1 = require("google-gax");
const subscriber_1 = require("./subscriber");
const permanentFailureInvalidAckId = 'PERMANENT_FAILURE_INVALID_ACK_ID';
const transientFailurePrefix = 'TRANSIENT_';
// If we get these as RPC errors, they will trigger a retry.
const exactlyOnceDeliveryTemporaryRetryErrors = [
    google_gax_1.Status.DEADLINE_EXCEEDED,
    google_gax_1.Status.RESOURCE_EXHAUSTED,
    google_gax_1.Status.ABORTED,
    google_gax_1.Status.INTERNAL,
    google_gax_1.Status.UNAVAILABLE,
];
/**
 * Processes the raw RPC information when sending a batch of acks
 * to the Pub/Sub service.
 *
 * @private
 */
function processAckErrorInfo(rpcError) {
    const ret = new Map();
    if (!rpcError.errorInfoMetadata) {
        return ret;
    }
    // The typing for errorInfoMetadata is currently incorrect.
    const metadata = rpcError.errorInfoMetadata;
    for (const ackId of Object.getOwnPropertyNames(metadata)) {
        const code = metadata[ackId];
        if (code === permanentFailureInvalidAckId) {
            ret.set(ackId, {
                transient: false,
                response: subscriber_1.AckResponses.Invalid,
                rawErrorCode: code,
            });
        }
        else if (code.startsWith(transientFailurePrefix)) {
            ret.set(ackId, {
                transient: true,
                rawErrorCode: code,
            });
        }
        else {
            ret.set(ackId, {
                transient: false,
                response: subscriber_1.AckResponses.Other,
                rawErrorCode: code,
            });
        }
    }
    return ret;
}
/**
 * For a completely failed RPC call, this will find the appropriate
 * error information to return to an ack() caller.
 *
 * @private
 */
function processAckRpcError(grpcCode) {
    const ackError = {
        transient: exactlyOnceDeliveryTemporaryRetryErrors.includes(grpcCode),
        grpcErrorCode: grpcCode,
    };
    switch (grpcCode) {
        case google_gax_1.Status.PERMISSION_DENIED:
            ackError.response = subscriber_1.AckResponses.PermissionDenied;
            break;
        case google_gax_1.Status.FAILED_PRECONDITION:
            ackError.response = subscriber_1.AckResponses.FailedPrecondition;
            break;
        default:
            ackError.response = subscriber_1.AckResponses.Other;
            break;
    }
    return ackError;
}
//# sourceMappingURL=ack-metadata.js.map