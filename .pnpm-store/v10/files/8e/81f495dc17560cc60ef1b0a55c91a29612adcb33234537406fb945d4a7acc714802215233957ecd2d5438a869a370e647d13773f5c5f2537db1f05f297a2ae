"use strict";
/**
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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.GoogleErrorDecoder = exports.GoogleError = void 0;
const status_1 = require("./status");
const protobuf = __importStar(require("protobufjs"));
const serializer = __importStar(require("proto3-json-serializer"));
const fallback_1 = require("./fallback");
const PROTO_TYPE_PREFIX = 'type.googleapis.com/';
const RESOURCE_INFO_TYPE = 'type.googleapis.com/google.rpc.ResourceInfo';
const DEFAULT_RESOURCE_TYPE_NAME_FOR_UNKNOWN_TYPES = 'Unknown type';
const ANY_PROTO_TYPE_NAME = 'google.protobuf.Any';
const UNKNOWN_TYPE_ENCONDED_ERROR_PREFIX = 'Unknown type encoded in';
const UNKNOWN_TYPE_NO_SUCH_TYPE = 'no such type';
const NUM_OF_PARTS_IN_PROTO_TYPE_NAME = 2;
class GoogleError extends Error {
    code;
    note;
    metadata;
    statusDetails;
    reason;
    domain;
    errorInfoMetadata;
    // Parse details field in google.rpc.status wire over gRPC medatadata.
    // Promote google.rpc.ErrorInfo if exist.
    static parseGRPCStatusDetails(err) {
        const decoder = new GoogleErrorDecoder();
        try {
            if (err.metadata && err.metadata.get('grpc-status-details-bin')) {
                const statusDetailsObj = decoder.decodeGRPCStatusDetails(err.metadata.get('grpc-status-details-bin'));
                if (statusDetailsObj &&
                    statusDetailsObj.details &&
                    statusDetailsObj.details.length > 0) {
                    err.statusDetails = statusDetailsObj.details;
                }
                if (statusDetailsObj && statusDetailsObj.errorInfo) {
                    err.reason = statusDetailsObj.errorInfo.reason;
                    err.domain = statusDetailsObj.errorInfo.domain;
                    err.errorInfoMetadata = statusDetailsObj.errorInfo.metadata;
                }
            }
        }
        catch (decodeErr) {
            // ignoring the error
        }
        return err;
    }
    // Parse http JSON error and promote google.rpc.ErrorInfo if exist.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    static parseHttpError(json) {
        if (Array.isArray(json)) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            json = json.find((obj) => {
                return 'error' in obj;
            });
        }
        // fallback logic.
        // related issue: https://github.com/googleapis/gax-nodejs/issues/1303
        // google error mapping: https://cloud.google.com/apis/design/errors
        // if input json doesn't have 'error' fields, wrap the whole object with 'error' field
        if (!json['error']) {
            json['error'] = {};
            Object.keys(json)
                .filter(key => key !== 'error')
                .forEach(key => {
                json['error'][key] = json[key];
                delete json[key];
            });
        }
        const decoder = new GoogleErrorDecoder();
        const proto3Error = decoder.decodeHTTPError(json['error']);
        const error = Object.assign(new GoogleError(json['error']['message']), proto3Error);
        // Get gRPC Status Code
        if (json['error']['status'] &&
            status_1.Status[json['error']['status']]) {
            error.code = status_1.Status[json['error']['status']];
        }
        else if (json['error']['code']) {
            // Map Http Status Code to gRPC Status Code
            error.code = (0, status_1.rpcCodeFromHttpStatusCode)(json['error']['code']);
        }
        else {
            // If error code is absent, proto3 message default value is 0. We should
            // keep error code as undefined.
            delete error.code;
        }
        // Keep consistency with gRPC statusDetails fields. gRPC details has been occupied before.
        // Rename "details" to "statusDetails".
        if (error.details) {
            try {
                const statusDetailsObj = decoder.decodeHttpStatusDetails(error.details);
                if (statusDetailsObj &&
                    statusDetailsObj.details &&
                    statusDetailsObj.details.length > 0) {
                    error.statusDetails = statusDetailsObj.details;
                }
                if (statusDetailsObj && statusDetailsObj.errorInfo) {
                    error.reason = statusDetailsObj.errorInfo.reason;
                    error.domain = statusDetailsObj.errorInfo.domain;
                    // error.metadata has been occupied for gRPC metadata, so we use
                    // errorInfoMetadata to represent ErrorInfo' metadata field. Keep
                    // consistency with gRPC ErrorInfo metadata field name.
                    error.errorInfoMetadata = statusDetailsObj.errorInfo.metadata;
                }
            }
            catch (decodeErr) {
                // ignoring the error
            }
        }
        return error;
    }
}
exports.GoogleError = GoogleError;
// Get proto type name removing the prefix. For example full type name: type.googleapis.com/google.rpc.Help, the function returns google.rpc.Help.
const getProtoTypeNameFromFullNameType = (fullTypeName) => {
    const parts = fullTypeName.split(PROTO_TYPE_PREFIX);
    if (parts.length !== NUM_OF_PARTS_IN_PROTO_TYPE_NAME) {
        throw Error("Can't convert full type name");
    }
    return parts[1];
};
// Return true if proto is known in protobuf.
const isDetailKnownProto = (protobuf, detail) => {
    try {
        const typeName = getProtoTypeNameFromFullNameType(detail['@type']);
        if (typeName === ANY_PROTO_TYPE_NAME) {
            return isDetailKnownProto(protobuf, detail.value);
        }
        const proto = protobuf.lookup(typeName);
        if (!proto) {
            return false;
        }
        return true;
    }
    catch (e) {
        return false;
    }
};
// Check if error is unknown type encoded.
const isUnknownTypeEncodedError = (error) => {
    if (typeof error === 'object' && error && 'message' in error) {
        return (error.message.includes(UNKNOWN_TYPE_ENCONDED_ERROR_PREFIX) ||
            error.message.includes(UNKNOWN_TYPE_NO_SUCH_TYPE));
    }
    return false;
};
// Build unknown proto as protobuf.Message<{}>.
const buildUnknownProtoAsAny = (unknownProto, anyProto) => {
    return anyProto.create({
        type_url: unknownProto.type_url,
        value: unknownProto.value,
    });
};
// Given a protobuf with rpc status protos and a json response value, generate ErrorDetails.
// Function will traverse trough all the details of the json value and split them based on ErrorDetails.
const getErrorDetails = (protobuf, json) => {
    const error_details = {
        knownDetails: [],
        unknownDetails: [],
    };
    if (typeof json === 'object' && json !== null && 'details' in json) {
        const details = json['details'];
        for (const detail of details) {
            if (isDetailKnownProto(protobuf, detail)) {
                error_details.knownDetails.push(detail);
            }
            else {
                error_details.unknownDetails.push(detail);
            }
        }
    }
    return error_details;
};
const makeResourceInfoError = (resourceType, description) => {
    return {
        '@type': RESOURCE_INFO_TYPE,
        resourceType,
        description,
    };
};
// Convert unknownDetails to rpc.ResourceInfo. The JSONValue is converted to string and returned as description.
const convertUnknownDetailsToResourceInfoError = (unknownDetails) => {
    const unknownDetailsAsResourceInfoError = [];
    for (const unknownDetail of unknownDetails) {
        try {
            let resourceType = DEFAULT_RESOURCE_TYPE_NAME_FOR_UNKNOWN_TYPES;
            if (typeof unknownDetail === 'object' &&
                unknownDetail !== null &&
                '@type' in unknownDetail) {
                const unknownType = unknownDetail['@type'];
                resourceType = unknownType;
            }
            // We don't know the proto, so we convert the object to string and assign it as description.
            const description = JSON.stringify(unknownDetail);
            unknownDetailsAsResourceInfoError.push(makeResourceInfoError(resourceType, description));
        }
        catch (e) {
            // Failed convert to string, ignore it.
        }
    }
    return unknownDetailsAsResourceInfoError;
};
class GoogleErrorDecoder {
    root;
    anyType;
    statusType;
    constructor() {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const errorProtoJson = require('../../build/protos/status.json');
        this.root = protobuf.Root.fromJSON(errorProtoJson);
        this.anyType = this.root.lookupType('google.protobuf.Any');
        this.statusType = this.root.lookupType('google.rpc.Status');
    }
    decodeProtobufAny(anyValue) {
        const match = anyValue.type_url.match(/^type.googleapis.com\/(.*)/);
        if (!match) {
            throw new Error(`Unknown type encoded in google.protobuf.any: ${anyValue.type_url}`);
        }
        const typeName = match[1];
        const type = this.root.lookupType(typeName);
        if (!type) {
            throw new Error(`Cannot lookup type ${typeName}`);
        }
        return type.decode(anyValue.value);
    }
    // Decodes gRPC-fallback error which is an instance of google.rpc.Status.
    decodeRpcStatus(buffer) {
        const uint8array = new Uint8Array(buffer);
        const status = this.statusType.decode(uint8array);
        // google.rpc.Status contains an array of google.protobuf.Any
        // which need a special treatment
        const details = [];
        let errorInfo;
        for (const detail of status.details) {
            try {
                const decodedDetail = this.decodeProtobufAny(detail);
                details.push(decodedDetail);
                if (detail.type_url === 'type.googleapis.com/google.rpc.ErrorInfo') {
                    errorInfo = decodedDetail;
                }
            }
            catch (err) {
                // cannot decode detail, likely because of the unknown type - just skip it
            }
        }
        const result = {
            code: status.code,
            message: status.message,
            statusDetails: details,
            reason: errorInfo?.reason,
            domain: errorInfo?.domain,
            errorInfoMetadata: errorInfo?.metadata,
        };
        return result;
    }
    // Construct an Error from a StatusObject.
    // Adapted from https://github.com/grpc/grpc-node/blob/main/packages/grpc-js/src/call.ts#L79
    callErrorFromStatus(status) {
        status.message = `${status.code} ${status_1.Status[status.code]}: ${status.message}`;
        return Object.assign(new GoogleError(status.message), status);
    }
    // Decodes gRPC-fallback error which is an instance of google.rpc.Status,
    // and puts it into the object similar to gRPC ServiceError object.
    decodeErrorFromBuffer(buffer) {
        return this.callErrorFromStatus(this.decodeRpcStatus(buffer));
    }
    // Decodes gRPC metadata error details which is an instance of google.rpc.Status.
    decodeGRPCStatusDetails(bufferArr) {
        const details = [];
        let errorInfo;
        bufferArr.forEach(buffer => {
            const uint8array = new Uint8Array(buffer);
            const rpcStatus = this.statusType.decode(uint8array);
            for (const detail of rpcStatus.details) {
                try {
                    const decodedDetail = this.decodeProtobufAny(detail);
                    details.push(decodedDetail);
                    if (detail.type_url === 'type.googleapis.com/google.rpc.ErrorInfo') {
                        errorInfo = decodedDetail;
                    }
                }
                catch (error) {
                    if (isUnknownTypeEncodedError(error)) {
                        const customErrorAsAny = buildUnknownProtoAsAny(detail, this.anyType);
                        details.push(customErrorAsAny);
                    }
                    // cannot decode detail - just skip it
                }
            }
        });
        const result = {
            details,
            errorInfo,
        };
        return result;
    }
    // Decodes http error which is an instance of google.rpc.Status.
    decodeHTTPError(json) {
        const errorDetails = getErrorDetails(this.root, json);
        let details = [];
        if (typeof json === 'object' && json !== null && 'details' in json) {
            if (errorDetails.knownDetails.length) {
                details = errorDetails.knownDetails;
            }
            if (errorDetails.unknownDetails.length) {
                const unknowDetailsAsResourceInfo = convertUnknownDetailsToResourceInfoError(errorDetails.unknownDetails);
                details = [...details, ...unknowDetailsAsResourceInfo];
            }
            if (details.length) {
                json.details = details;
            }
        }
        const errorMessage = serializer.fromProto3JSON(this.statusType, json);
        if (!errorMessage) {
            throw new Error(`Received error message ${json}, but failed to serialize as proto3 message`);
        }
        return this.statusType.toObject(errorMessage, fallback_1.defaultToObjectOptions);
    }
    // Decodes http error details which is an instance of Array<google.protobuf.Any>.
    decodeHttpStatusDetails(rawDetails) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const details = [];
        let errorInfo;
        for (const detail of rawDetails) {
            try {
                const decodedDetail = this.decodeProtobufAny(detail);
                details.push(decodedDetail);
                if (detail.type_url === 'type.googleapis.com/google.rpc.ErrorInfo') {
                    errorInfo = decodedDetail;
                }
            }
            catch (err) {
                // cannot decode detail, likely because of the unknown type - just skip it
            }
        }
        return { details, errorInfo };
    }
}
exports.GoogleErrorDecoder = GoogleErrorDecoder;
//# sourceMappingURL=googleError.js.map