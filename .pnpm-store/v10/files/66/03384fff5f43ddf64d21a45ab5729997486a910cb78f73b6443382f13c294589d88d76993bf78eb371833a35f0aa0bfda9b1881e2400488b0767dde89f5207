"use strict";
// Copyright Datastax, Inc
// SPDX-License-Identifier: Apache-2.0
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmbeddingHeadersProvider = void 0;
const common_1 = require("../../common");
const embedding_providers_1 = require("../../data-api/embedding-providers");
class EmbeddingHeadersProvider {
        static parseHeaders(token) {
        if (typeof token === 'string' || (0, common_1.isNullish)(token)) {
            return new embedding_providers_1.EmbeddingAPIKeyHeaderProvider(token);
        }
        if (token instanceof EmbeddingHeadersProvider) {
            return token;
        }
        throw new TypeError('Expected embeddingApiKey to be type string | EmbeddingHeadersProvider | nullish');
    }
}
exports.EmbeddingHeadersProvider = EmbeddingHeadersProvider;
