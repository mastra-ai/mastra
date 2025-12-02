"use strict";
// Copyright Datastax, Inc
// SPDX-License-Identifier: Apache-2.0
var __classPrivateFieldSet = (this && this.__classPrivateFieldSet) || function (receiver, state, value, kind, f) {
    if (kind === "m") throw new TypeError("Private method is not writable");
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
    return (kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value)), value;
};
var __classPrivateFieldGet = (this && this.__classPrivateFieldGet) || function (receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var _AWSEmbeddingHeadersProvider_headers;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AWSEmbeddingHeadersProvider = void 0;
const embedding_headers_provider_1 = require("../../data-api/embedding-providers/embedding-headers-provider");
class AWSEmbeddingHeadersProvider extends embedding_headers_provider_1.EmbeddingHeadersProvider {
        constructor(accessKeyId, secretAccessKey) {
        super();
        _AWSEmbeddingHeadersProvider_headers.set(this, void 0);
        __classPrivateFieldSet(this, _AWSEmbeddingHeadersProvider_headers, {
            'x-embedding-access-id': accessKeyId,
            'x-embedding-secret-id': secretAccessKey,
        }, "f");
    }
        getHeaders() {
        return __classPrivateFieldGet(this, _AWSEmbeddingHeadersProvider_headers, "f");
    }
}
exports.AWSEmbeddingHeadersProvider = AWSEmbeddingHeadersProvider;
_AWSEmbeddingHeadersProvider_headers = new WeakMap();
