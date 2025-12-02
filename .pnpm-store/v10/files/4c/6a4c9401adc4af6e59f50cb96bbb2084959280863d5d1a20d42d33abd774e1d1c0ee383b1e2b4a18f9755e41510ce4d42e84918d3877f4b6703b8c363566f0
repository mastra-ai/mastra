"use strict";
/**
 * Copyright 2021 Google LLC
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
exports.generateServiceStub = generateServiceStub;
const serializer = __importStar(require("proto3-json-serializer"));
const featureDetection_1 = require("./featureDetection");
const streamArrayParser_1 = require("./streamArrayParser");
const fallback_1 = require("./fallback");
const stream_1 = require("stream");
// Node.js before v19 does not enable keepalive by default.
// We'll try to enable it very carefully to make sure we don't break possible non-Node use cases.
// TODO: remove this after Node 18 is EOL.
// More info:
// - https://github.com/node-fetch/node-fetch#custom-agent
// - https://github.com/googleapis/gax-nodejs/pull/1534
let agentOption = null;
if ((0, featureDetection_1.isNodeJS)()) {
    const http = require('http');
    const https = require('https');
    const httpAgent = new http.Agent({ keepAlive: true });
    const httpsAgent = new https.Agent({ keepAlive: true });
    agentOption = (parsedUrl) => {
        if (parsedUrl.protocol === 'http:') {
            return httpAgent;
        }
        return httpsAgent;
    };
}
// helper function used to properly format empty responses
// when the response code is 204
function _formatEmptyResponse(rpc) {
    // format the empty response the same way we format non-empty responses in fallbackRest.ts
    const emptyMessage = serializer.fromProto3JSON(rpc.resolvedResponseType, JSON.parse('{}'));
    const resp = rpc.resolvedResponseType.toObject(emptyMessage, fallback_1.defaultToObjectOptions);
    return resp;
}
function generateServiceStub(rpcs, protocol, servicePath, servicePort, auth, requestEncoder, responseDecoder, numericEnums, minifyJson) {
    const serviceStub = {
        // close method should close all cancel controllers. If this feature request in the future, we can have a cancelControllerFactory that tracks created cancel controllers, and abort them all in close method.
        close: () => {
            return { cancel: () => { } };
        },
    };
    for (const [rpcName, rpc] of Object.entries(rpcs)) {
        serviceStub[rpcName] = (request, options, _metadata, callback) => {
            options ??= {};
            // We cannot use async-await in this function because we need to return the canceller object as soon as possible.
            // Using plain old promises instead.
            let fetchParameters;
            try {
                fetchParameters = requestEncoder(rpc, protocol, servicePath, servicePort, request, numericEnums, minifyJson);
            }
            catch (err) {
                // we could not encode parameters; pass error to the callback
                // and return a no-op canceler object.
                if (callback) {
                    callback(err);
                }
                return {
                    cancel() { },
                };
            }
            const cancelController = new AbortController();
            const cancelSignal = cancelController.signal;
            let cancelRequested = false;
            const url = fetchParameters.url;
            const headers = new Headers(fetchParameters.headers);
            for (const key of Object.keys(options)) {
                headers.set(key, options[key][0]);
            }
            const streamArrayParser = new streamArrayParser_1.StreamArrayParser(rpc);
            let response204Ok = false;
            const fetchRequest = {
                headers: headers,
                body: fetchParameters.body,
                method: fetchParameters.method,
                signal: cancelSignal,
                responseType: 'stream', // ensure gaxios returns the data directly so that it handle data/streams itself
                agent: agentOption || undefined,
            };
            if (fetchParameters.method === 'GET' ||
                fetchParameters.method === 'DELETE') {
                delete fetchRequest['body'];
            }
            auth
                .fetch(url, fetchRequest)
                .then((response) => {
                // There is a legacy Apiary configuration that some services
                // use which allows 204 empty responses on success instead of
                // a 200 OK. This most commonly is seen in delete RPCs,
                // but does occasionally show up in other endpoints. We
                // need to allow this behavior so that these clients do not throw an error
                // when the call actually succeeded
                // See b/411675301 for more context
                if (response.status === 204 && response.ok) {
                    response204Ok = true;
                }
                if (response.ok && rpc.responseStream) {
                    (0, stream_1.pipeline)(response.body, streamArrayParser, (err) => {
                        if (err &&
                            (!cancelRequested ||
                                (err instanceof Error && err.name !== 'AbortError'))) {
                            if (callback) {
                                callback(err);
                            }
                            streamArrayParser.emit('error', err);
                        }
                    });
                    return;
                }
                else {
                    return Promise.all([
                        Promise.resolve(response.ok),
                        response.arrayBuffer(),
                    ])
                        .then(([ok, buffer]) => {
                        const response = responseDecoder(rpc, ok, buffer);
                        callback(null, response);
                    })
                        .catch((err) => {
                        if (!cancelRequested || err.name !== 'AbortError') {
                            if (rpc.responseStream) {
                                if (callback) {
                                    callback(err);
                                }
                                streamArrayParser.emit('error', err);
                            }
                            else {
                                // This supports a legacy Apiary behavior that allows
                                // empty 204 responses. If we do not intercept this potential error
                                // from decodeResponse in fallbackRest
                                // it will cause libraries to erroneously throw an
                                // error when the call succeeded. This error cannot be checked in
                                // fallbackRest.ts because decodeResponse does not have the necessary
                                // context about the response to validate the status code + ok-ness
                                if (!response204Ok) {
                                    // by this point, we're guaranteed to have added a callback
                                    // it is added in the library before calling this.innerApiCalls
                                    callback(err);
                                }
                                else {
                                    const resp = _formatEmptyResponse(rpc);
                                    // by this point, we're guaranteed to have added a callback
                                    // it is added in the library before calling this.innerApiCalls
                                    callback(null, resp);
                                }
                            }
                        }
                    });
                }
            })
                .catch((err) => {
                if (rpc.responseStream) {
                    if (callback) {
                        callback(err);
                    }
                    streamArrayParser.emit('error', err);
                }
                else if (callback) {
                    callback(err);
                }
                else {
                    throw err;
                }
            });
            if (rpc.responseStream) {
                return streamArrayParser;
            }
            return {
                cancel: () => {
                    cancelRequested = true;
                    cancelController.abort();
                },
            };
        };
    }
    return serviceStub;
}
//# sourceMappingURL=fallbackServiceStub.js.map