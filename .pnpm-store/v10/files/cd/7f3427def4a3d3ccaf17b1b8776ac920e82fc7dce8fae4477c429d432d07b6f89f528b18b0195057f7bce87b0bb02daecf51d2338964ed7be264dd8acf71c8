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
var _UsernamePasswordTokenProvider_token;
Object.defineProperty(exports, "__esModule", { value: true });
exports.UsernamePasswordTokenProvider = void 0;
const token_provider_1 = require("../../common/token-providers/token-provider");
class UsernamePasswordTokenProvider extends token_provider_1.TokenProvider {
        constructor(username, password) {
        super();
        _UsernamePasswordTokenProvider_token.set(this, void 0);
        __classPrivateFieldSet(this, _UsernamePasswordTokenProvider_token, `Cassandra:${this._encodeB64(username)}:${this._encodeB64(password)}`, "f");
    }
        getToken() {
        return __classPrivateFieldGet(this, _UsernamePasswordTokenProvider_token, "f");
    }
    _encodeB64(input) {
        if (typeof window !== 'undefined' && typeof window.btoa === 'function') {
            return window.btoa(input);
        }
        else if (typeof Buffer === 'function') {
            return Buffer.from(input, 'utf-8').toString('base64');
        }
        else {
            throw new Error('Unable to encode username/password to base64... please provide the "Cassandra:[username_b64]:[password_b64]" token manually');
        }
    }
}
exports.UsernamePasswordTokenProvider = UsernamePasswordTokenProvider;
_UsernamePasswordTokenProvider_token = new WeakMap();
