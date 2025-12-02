"use strict";
// Copyright Datastax, Inc
// SPDX-License-Identifier: Apache-2.0
Object.defineProperty(exports, "__esModule", { value: true });
exports.TokenProvider = void 0;
const common_1 = require("../../common");
class TokenProvider {
        static parseToken(token) {
        if (typeof token === 'string' || (0, common_1.isNullish)(token)) {
            return new common_1.StaticTokenProvider(token);
        }
        if (token instanceof TokenProvider) {
            return token;
        }
        throw new TypeError('Expected token to be type string | TokenProvider | nullish');
    }
}
exports.TokenProvider = TokenProvider;
