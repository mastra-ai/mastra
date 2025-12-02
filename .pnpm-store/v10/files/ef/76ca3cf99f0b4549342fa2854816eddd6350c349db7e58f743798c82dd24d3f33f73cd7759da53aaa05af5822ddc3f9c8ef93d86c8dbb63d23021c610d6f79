"use strict";
/*!
 * This source file is part of the Gel open source project.
 *
 * Copyright 2019-present MagicStack Inc. and the Gel authors.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.saslprep = saslprep;
exports.getSCRAM = getSCRAM;
const buffer_1 = require("./primitives/buffer");
const errors_1 = require("./errors");
const RAW_NONCE_LENGTH = 18;
function saslprep(str) {
    return str.normalize("NFKC");
}
function getSCRAM({ randomBytes, H, HMAC, makeKey }) {
    function bufferEquals(a, b) {
        if (a.length !== b.length) {
            return false;
        }
        for (let i = 0, len = a.length; i < len; i++) {
            if (a[i] !== b[i]) {
                return false;
            }
        }
        return true;
    }
    function generateNonce(length = RAW_NONCE_LENGTH) {
        return randomBytes(length);
    }
    function buildClientFirstMessage(clientNonce, username) {
        const bare = `n=${saslprep(username)},r=${(0, buffer_1.encodeB64)(clientNonce)}`;
        return [`n,,${bare}`, bare];
    }
    function parseServerFirstMessage(msg) {
        const attrs = msg.split(",");
        if (attrs.length < 3) {
            throw new errors_1.ProtocolError("malformed SCRAM message");
        }
        const nonceAttr = attrs[0];
        if (!nonceAttr || nonceAttr[0] !== "r") {
            throw new errors_1.ProtocolError("malformed SCRAM message");
        }
        const nonceB64 = nonceAttr.split("=", 2)[1];
        if (!nonceB64) {
            throw new errors_1.ProtocolError("malformed SCRAM message");
        }
        const nonce = (0, buffer_1.decodeB64)(nonceB64);
        const saltAttr = attrs[1];
        if (!saltAttr || saltAttr[0] !== "s") {
            throw new errors_1.ProtocolError("malformed SCRAM message");
        }
        const saltB64 = saltAttr.split("=", 2)[1];
        if (!saltB64) {
            throw new errors_1.ProtocolError("malformed SCRAM message");
        }
        const salt = (0, buffer_1.decodeB64)(saltB64);
        const iterAttr = attrs[2];
        if (!iterAttr || iterAttr[0] !== "i") {
            throw new errors_1.ProtocolError("malformed SCRAM message");
        }
        const iter = iterAttr.split("=", 2)[1];
        if (!iter || !iter.match(/^[0-9]*$/)) {
            throw new errors_1.ProtocolError("malformed SCRAM message");
        }
        const iterCount = parseInt(iter, 10);
        if (iterCount <= 0) {
            throw new errors_1.ProtocolError("malformed SCRAM message");
        }
        return [nonce, salt, iterCount];
    }
    function parseServerFinalMessage(msg) {
        const attrs = msg.split(",");
        if (attrs.length < 1) {
            throw new errors_1.ProtocolError("malformed SCRAM message");
        }
        const nonceAttr = attrs[0];
        if (!nonceAttr || nonceAttr[0] !== "v") {
            throw new errors_1.ProtocolError("malformed SCRAM message");
        }
        const signatureB64 = nonceAttr.split("=", 2)[1];
        if (!signatureB64) {
            throw new errors_1.ProtocolError("malformed SCRAM message");
        }
        return (0, buffer_1.decodeB64)(signatureB64);
    }
    async function buildClientFinalMessage(password, salt, iterations, clientFirstBare, serverFirst, serverNonce) {
        const clientFinal = `c=biws,r=${(0, buffer_1.encodeB64)(serverNonce)}`;
        const authMessage = buffer_1.utf8Encoder.encode(`${clientFirstBare},${serverFirst},${clientFinal}`);
        const saltedPassword = await _getSaltedPassword(buffer_1.utf8Encoder.encode(saslprep(password)), salt, iterations);
        const clientKey = await _getClientKey(saltedPassword);
        const storedKey = await H(clientKey);
        const clientSignature = await HMAC(storedKey, authMessage);
        const clientProof = _XOR(clientKey, clientSignature);
        const serverKey = await _getServerKey(saltedPassword);
        const serverProof = await HMAC(serverKey, authMessage);
        return [`${clientFinal},p=${(0, buffer_1.encodeB64)(clientProof)}`, serverProof];
    }
    async function _getSaltedPassword(password, salt, iterations) {
        const msg = new Uint8Array(salt.length + 4);
        msg.set(salt);
        msg.set([0, 0, 0, 1], salt.length);
        const keyFromPassword = await makeKey(password);
        let Hi = await HMAC(keyFromPassword, msg);
        let Ui = Hi;
        for (let _ = 0; _ < iterations - 1; _++) {
            Ui = await HMAC(keyFromPassword, Ui);
            Hi = _XOR(Hi, Ui);
        }
        return Hi;
    }
    function _getClientKey(saltedPassword) {
        return HMAC(saltedPassword, buffer_1.utf8Encoder.encode("Client Key"));
    }
    function _getServerKey(saltedPassword) {
        return HMAC(saltedPassword, buffer_1.utf8Encoder.encode("Server Key"));
    }
    function _XOR(a, b) {
        const len = a.length;
        if (len !== b.length) {
            throw new errors_1.ProtocolError("scram.XOR: buffers are of different lengths");
        }
        const res = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            res[i] = a[i] ^ b[i];
        }
        return res;
    }
    return {
        bufferEquals,
        generateNonce,
        buildClientFirstMessage,
        parseServerFirstMessage,
        parseServerFinalMessage,
        buildClientFinalMessage,
        _getSaltedPassword,
        _getClientKey,
        _getServerKey,
        _XOR,
    };
}
