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
var _StaticTokenProvider_token;
Object.defineProperty(exports, "__esModule", { value: true });
exports.StaticTokenProvider = void 0;
const token_provider_1 = require("../../common/token-providers/token-provider");
class StaticTokenProvider extends token_provider_1.TokenProvider {
        constructor(token) {
        super();
        _StaticTokenProvider_token.set(this, void 0);
        __classPrivateFieldSet(this, _StaticTokenProvider_token, token, "f");
    }
        getToken() {
        return __classPrivateFieldGet(this, _StaticTokenProvider_token, "f");
    }
}
exports.StaticTokenProvider = StaticTokenProvider;
_StaticTokenProvider_token = new WeakMap();
