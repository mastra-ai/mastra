module.exports = {

"[project]/node_modules/.pnpm/google-auth-library@9.15.0_encoding@0.1.13/node_modules/google-auth-library/build/src/crypto/browser/crypto.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
// Copyright 2019 Google LLC
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
/* global window */ Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.BrowserCrypto = void 0;
// This file implements crypto functions we need using in-browser
// SubtleCrypto interface `window.crypto.subtle`.
const base64js = __turbopack_require__("[project]/node_modules/.pnpm/base64-js@1.5.1/node_modules/base64-js/index.js [app-rsc] (ecmascript)");
const crypto_1 = __turbopack_require__("[project]/node_modules/.pnpm/google-auth-library@9.15.0_encoding@0.1.13/node_modules/google-auth-library/build/src/crypto/crypto.js [app-rsc] (ecmascript)");
class BrowserCrypto {
    constructor(){
        if ("TURBOPACK compile-time truthy", 1) {
            throw new Error("SubtleCrypto not found. Make sure it's an https:// website.");
        }
    }
    async sha256DigestBase64(str) {
        // SubtleCrypto digest() method is async, so we must make
        // this method async as well.
        // To calculate SHA256 digest using SubtleCrypto, we first
        // need to convert an input string to an ArrayBuffer:
        const inputBuffer = new TextEncoder().encode(str);
        // Result is ArrayBuffer as well.
        const outputBuffer = await window.crypto.subtle.digest('SHA-256', inputBuffer);
        return base64js.fromByteArray(new Uint8Array(outputBuffer));
    }
    randomBytesBase64(count) {
        const array = new Uint8Array(count);
        window.crypto.getRandomValues(array);
        return base64js.fromByteArray(array);
    }
    static padBase64(base64) {
        // base64js requires padding, so let's add some '='
        while(base64.length % 4 !== 0){
            base64 += '=';
        }
        return base64;
    }
    async verify(pubkey, data, signature) {
        const algo = {
            name: 'RSASSA-PKCS1-v1_5',
            hash: {
                name: 'SHA-256'
            }
        };
        const dataArray = new TextEncoder().encode(data);
        const signatureArray = base64js.toByteArray(BrowserCrypto.padBase64(signature));
        const cryptoKey = await window.crypto.subtle.importKey('jwk', pubkey, algo, true, [
            'verify'
        ]);
        // SubtleCrypto's verify method is async so we must make
        // this method async as well.
        const result = await window.crypto.subtle.verify(algo, cryptoKey, signatureArray, dataArray);
        return result;
    }
    async sign(privateKey, data) {
        const algo = {
            name: 'RSASSA-PKCS1-v1_5',
            hash: {
                name: 'SHA-256'
            }
        };
        const dataArray = new TextEncoder().encode(data);
        const cryptoKey = await window.crypto.subtle.importKey('jwk', privateKey, algo, true, [
            'sign'
        ]);
        // SubtleCrypto's sign method is async so we must make
        // this method async as well.
        const result = await window.crypto.subtle.sign(algo, cryptoKey, dataArray);
        return base64js.fromByteArray(new Uint8Array(result));
    }
    decodeBase64StringUtf8(base64) {
        const uint8array = base64js.toByteArray(BrowserCrypto.padBase64(base64));
        const result = new TextDecoder().decode(uint8array);
        return result;
    }
    encodeBase64StringUtf8(text) {
        const uint8array = new TextEncoder().encode(text);
        const result = base64js.fromByteArray(uint8array);
        return result;
    }
    /**
     * Computes the SHA-256 hash of the provided string.
     * @param str The plain text string to hash.
     * @return A promise that resolves with the SHA-256 hash of the provided
     *   string in hexadecimal encoding.
     */ async sha256DigestHex(str) {
        // SubtleCrypto digest() method is async, so we must make
        // this method async as well.
        // To calculate SHA256 digest using SubtleCrypto, we first
        // need to convert an input string to an ArrayBuffer:
        const inputBuffer = new TextEncoder().encode(str);
        // Result is ArrayBuffer as well.
        const outputBuffer = await window.crypto.subtle.digest('SHA-256', inputBuffer);
        return (0, crypto_1.fromArrayBufferToHex)(outputBuffer);
    }
    /**
     * Computes the HMAC hash of a message using the provided crypto key and the
     * SHA-256 algorithm.
     * @param key The secret crypto key in utf-8 or ArrayBuffer format.
     * @param msg The plain text message.
     * @return A promise that resolves with the HMAC-SHA256 hash in ArrayBuffer
     *   format.
     */ async signWithHmacSha256(key, msg) {
        // Convert key, if provided in ArrayBuffer format, to string.
        const rawKey = typeof key === 'string' ? key : String.fromCharCode(...new Uint16Array(key));
        const enc = new TextEncoder();
        const cryptoKey = await window.crypto.subtle.importKey('raw', enc.encode(rawKey), {
            name: 'HMAC',
            hash: {
                name: 'SHA-256'
            }
        }, false, [
            'sign'
        ]);
        return window.crypto.subtle.sign('HMAC', cryptoKey, enc.encode(msg));
    }
}
exports.BrowserCrypto = BrowserCrypto;
}}),
"[project]/node_modules/.pnpm/google-auth-library@9.15.0_encoding@0.1.13/node_modules/google-auth-library/build/src/crypto/node/crypto.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
// Copyright 2019 Google LLC
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
Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.NodeCrypto = void 0;
const crypto = __turbopack_require__("[externals]/ [external] (crypto, cjs)");
class NodeCrypto {
    async sha256DigestBase64(str) {
        return crypto.createHash('sha256').update(str).digest('base64');
    }
    randomBytesBase64(count) {
        return crypto.randomBytes(count).toString('base64');
    }
    async verify(pubkey, data, signature) {
        const verifier = crypto.createVerify('RSA-SHA256');
        verifier.update(data);
        verifier.end();
        return verifier.verify(pubkey, signature, 'base64');
    }
    async sign(privateKey, data) {
        const signer = crypto.createSign('RSA-SHA256');
        signer.update(data);
        signer.end();
        return signer.sign(privateKey, 'base64');
    }
    decodeBase64StringUtf8(base64) {
        return Buffer.from(base64, 'base64').toString('utf-8');
    }
    encodeBase64StringUtf8(text) {
        return Buffer.from(text, 'utf-8').toString('base64');
    }
    /**
     * Computes the SHA-256 hash of the provided string.
     * @param str The plain text string to hash.
     * @return A promise that resolves with the SHA-256 hash of the provided
     *   string in hexadecimal encoding.
     */ async sha256DigestHex(str) {
        return crypto.createHash('sha256').update(str).digest('hex');
    }
    /**
     * Computes the HMAC hash of a message using the provided crypto key and the
     * SHA-256 algorithm.
     * @param key The secret crypto key in utf-8 or ArrayBuffer format.
     * @param msg The plain text message.
     * @return A promise that resolves with the HMAC-SHA256 hash in ArrayBuffer
     *   format.
     */ async signWithHmacSha256(key, msg) {
        const cryptoKey = typeof key === 'string' ? key : toBuffer(key);
        return toArrayBuffer(crypto.createHmac('sha256', cryptoKey).update(msg).digest());
    }
}
exports.NodeCrypto = NodeCrypto;
/**
 * Converts a Node.js Buffer to an ArrayBuffer.
 * https://stackoverflow.com/questions/8609289/convert-a-binary-nodejs-buffer-to-javascript-arraybuffer
 * @param buffer The Buffer input to covert.
 * @return The ArrayBuffer representation of the input.
 */ function toArrayBuffer(buffer) {
    return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}
/**
 * Converts an ArrayBuffer to a Node.js Buffer.
 * @param arrayBuffer The ArrayBuffer input to covert.
 * @return The Buffer representation of the input.
 */ function toBuffer(arrayBuffer) {
    return Buffer.from(arrayBuffer);
}
}}),
"[project]/node_modules/.pnpm/google-auth-library@9.15.0_encoding@0.1.13/node_modules/google-auth-library/build/src/crypto/crypto.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
// Copyright 2019 Google LLC
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
/* global window */ Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.createCrypto = createCrypto;
exports.hasBrowserCrypto = hasBrowserCrypto;
exports.fromArrayBufferToHex = fromArrayBufferToHex;
const crypto_1 = __turbopack_require__("[project]/node_modules/.pnpm/google-auth-library@9.15.0_encoding@0.1.13/node_modules/google-auth-library/build/src/crypto/browser/crypto.js [app-rsc] (ecmascript)");
const crypto_2 = __turbopack_require__("[project]/node_modules/.pnpm/google-auth-library@9.15.0_encoding@0.1.13/node_modules/google-auth-library/build/src/crypto/node/crypto.js [app-rsc] (ecmascript)");
function createCrypto() {
    if ("TURBOPACK compile-time falsy", 0) {
        "TURBOPACK unreachable";
    }
    return new crypto_2.NodeCrypto();
}
function hasBrowserCrypto() {
    return "undefined" !== 'undefined' && typeof window.crypto !== 'undefined' && typeof window.crypto.subtle !== 'undefined';
}
/**
 * Converts an ArrayBuffer to a hexadecimal string.
 * @param arrayBuffer The ArrayBuffer to convert to hexadecimal string.
 * @return The hexadecimal encoding of the ArrayBuffer.
 */ function fromArrayBufferToHex(arrayBuffer) {
    // Convert buffer to byte array.
    const byteArray = Array.from(new Uint8Array(arrayBuffer));
    // Convert bytes to hex string.
    return byteArray.map((byte)=>{
        return byte.toString(16).padStart(2, '0');
    }).join('');
}
}}),
"[project]/node_modules/.pnpm/google-auth-library@9.15.0_encoding@0.1.13/node_modules/google-auth-library/build/src/options.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
// Copyright 2017 Google LLC
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
Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.validate = validate;
// Accepts an options object passed from the user to the API.  In the
// previous version of the API, it referred to a `Request` options object.
// Now it refers to an Axiox Request Config object.  This is here to help
// ensure users don't pass invalid options when they upgrade from 0.x to 1.x.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function validate(options) {
    const vpairs = [
        {
            invalid: 'uri',
            expected: 'url'
        },
        {
            invalid: 'json',
            expected: 'data'
        },
        {
            invalid: 'qs',
            expected: 'params'
        }
    ];
    for (const pair of vpairs){
        if (options[pair.invalid]) {
            const e = `'${pair.invalid}' is not a valid configuration option. Please use '${pair.expected}' instead. This library is using Axios for requests. Please see https://github.com/axios/axios to learn more about the valid request options.`;
            throw new Error(e);
        }
    }
}
}}),
"[project]/node_modules/.pnpm/google-auth-library@9.15.0_encoding@0.1.13/node_modules/google-auth-library/package.json (json)": ((__turbopack_context__) => {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, t: require } = __turbopack_context__;
{
__turbopack_export_value__(JSON.parse("{\"name\":\"google-auth-library\",\"version\":\"9.15.0\",\"author\":\"Google Inc.\",\"description\":\"Google APIs Authentication Client Library for Node.js\",\"engines\":{\"node\":\">=14\"},\"main\":\"./build/src/index.js\",\"types\":\"./build/src/index.d.ts\",\"repository\":\"googleapis/google-auth-library-nodejs.git\",\"keywords\":[\"google\",\"api\",\"google apis\",\"client\",\"client library\"],\"dependencies\":{\"base64-js\":\"^1.3.0\",\"ecdsa-sig-formatter\":\"^1.0.11\",\"gaxios\":\"^6.1.1\",\"gcp-metadata\":\"^6.1.0\",\"gtoken\":\"^7.0.0\",\"jws\":\"^4.0.0\"},\"devDependencies\":{\"@types/base64-js\":\"^1.2.5\",\"@types/chai\":\"^4.1.7\",\"@types/jws\":\"^3.1.0\",\"@types/mocha\":\"^9.0.0\",\"@types/mv\":\"^2.1.0\",\"@types/ncp\":\"^2.0.1\",\"@types/node\":\"^20.4.2\",\"@types/sinon\":\"^17.0.0\",\"assert-rejects\":\"^1.0.0\",\"c8\":\"^8.0.0\",\"chai\":\"^4.2.0\",\"cheerio\":\"1.0.0-rc.12\",\"codecov\":\"^3.0.2\",\"execa\":\"^5.0.0\",\"gts\":\"^5.0.0\",\"is-docker\":\"^2.0.0\",\"jsdoc\":\"^4.0.0\",\"jsdoc-fresh\":\"^3.0.0\",\"jsdoc-region-tag\":\"^3.0.0\",\"karma\":\"^6.0.0\",\"karma-chrome-launcher\":\"^3.0.0\",\"karma-coverage\":\"^2.0.0\",\"karma-firefox-launcher\":\"^2.0.0\",\"karma-mocha\":\"^2.0.0\",\"karma-sourcemap-loader\":\"^0.4.0\",\"karma-webpack\":\"5.0.0\",\"keypair\":\"^1.0.4\",\"linkinator\":\"^4.0.0\",\"mocha\":\"^9.2.2\",\"mv\":\"^2.1.1\",\"ncp\":\"^2.0.0\",\"nock\":\"^13.0.0\",\"null-loader\":\"^4.0.0\",\"pdfmake\":\"0.2.12\",\"puppeteer\":\"^21.0.0\",\"sinon\":\"^18.0.0\",\"ts-loader\":\"^8.0.0\",\"typescript\":\"^5.1.6\",\"webpack\":\"^5.21.2\",\"webpack-cli\":\"^4.0.0\"},\"files\":[\"build/src\",\"!build/src/**/*.map\"],\"scripts\":{\"test\":\"c8 mocha build/test\",\"clean\":\"gts clean\",\"prepare\":\"npm run compile\",\"lint\":\"gts check\",\"compile\":\"tsc -p .\",\"fix\":\"gts fix\",\"pretest\":\"npm run compile -- --sourceMap\",\"docs\":\"jsdoc -c .jsdoc.json\",\"samples-setup\":\"cd samples/ && npm link ../ && npm run setup && cd ../\",\"samples-test\":\"cd samples/ && npm link ../ && npm test && cd ../\",\"system-test\":\"mocha build/system-test --timeout 60000\",\"presystem-test\":\"npm run compile -- --sourceMap\",\"webpack\":\"webpack\",\"browser-test\":\"karma start\",\"docs-test\":\"linkinator docs\",\"predocs-test\":\"npm run docs\",\"prelint\":\"cd samples; npm link ../; npm install\",\"precompile\":\"gts clean\"},\"license\":\"Apache-2.0\"}"));}}),
"[project]/node_modules/.pnpm/google-auth-library@9.15.0_encoding@0.1.13/node_modules/google-auth-library/build/src/transporters.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
// Copyright 2019 Google LLC
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
Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.DefaultTransporter = void 0;
const gaxios_1 = __turbopack_require__("[project]/node_modules/.pnpm/gaxios@6.7.1_encoding@0.1.13/node_modules/gaxios/build/src/index.js [app-rsc] (ecmascript)");
const options_1 = __turbopack_require__("[project]/node_modules/.pnpm/google-auth-library@9.15.0_encoding@0.1.13/node_modules/google-auth-library/build/src/options.js [app-rsc] (ecmascript)");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pkg = __turbopack_require__("[project]/node_modules/.pnpm/google-auth-library@9.15.0_encoding@0.1.13/node_modules/google-auth-library/package.json (json)");
const PRODUCT_NAME = 'google-api-nodejs-client';
class DefaultTransporter {
    constructor(){
        /**
         * A configurable, replacable `Gaxios` instance.
         */ this.instance = new gaxios_1.Gaxios();
    }
    /**
     * Configures request options before making a request.
     * @param opts GaxiosOptions options.
     * @return Configured options.
     */ configure(opts = {}) {
        opts.headers = opts.headers || {};
        if ("TURBOPACK compile-time truthy", 1) {
            // set transporter user agent if not in browser
            const uaValue = opts.headers['User-Agent'];
            if (!uaValue) {
                opts.headers['User-Agent'] = DefaultTransporter.USER_AGENT;
            } else if (!uaValue.includes(`${PRODUCT_NAME}/`)) {
                opts.headers['User-Agent'] = `${uaValue} ${DefaultTransporter.USER_AGENT}`;
            }
            // track google-auth-library-nodejs version:
            if (!opts.headers['x-goog-api-client']) {
                const nodeVersion = process.version.replace(/^v/, '');
                opts.headers['x-goog-api-client'] = `gl-node/${nodeVersion}`;
            }
        }
        return opts;
    }
    /**
     * Makes a request using Gaxios with given options.
     * @param opts GaxiosOptions options.
     * @param callback optional callback that contains GaxiosResponse object.
     * @return GaxiosPromise, assuming no callback is passed.
     */ request(opts) {
        // ensure the user isn't passing in request-style options
        opts = this.configure(opts);
        (0, options_1.validate)(opts);
        return this.instance.request(opts).catch((e)=>{
            throw this.processError(e);
        });
    }
    get defaults() {
        return this.instance.defaults;
    }
    set defaults(opts) {
        this.instance.defaults = opts;
    }
    /**
     * Changes the error to include details from the body.
     */ processError(e) {
        const res = e.response;
        const err = e;
        const body = res ? res.data : null;
        if (res && body && body.error && res.status !== 200) {
            if (typeof body.error === 'string') {
                err.message = body.error;
                err.status = res.status;
            } else if (Array.isArray(body.error.errors)) {
                err.message = body.error.errors.map((err2)=>err2.message).join('\n');
                err.code = body.error.code;
                err.errors = body.error.errors;
            } else {
                err.message = body.error.message;
                err.code = body.error.code;
            }
        } else if (res && res.status >= 400) {
            // Consider all 4xx and 5xx responses errors.
            err.message = body;
            err.status = res.status;
        }
        return err;
    }
}
exports.DefaultTransporter = DefaultTransporter;
/**
 * Default user agent.
 */ DefaultTransporter.USER_AGENT = `${PRODUCT_NAME}/${pkg.version}`;
}}),
"[project]/node_modules/.pnpm/google-auth-library@9.15.0_encoding@0.1.13/node_modules/google-auth-library/build/src/util.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
// Copyright 2023 Google LLC
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
var __classPrivateFieldGet = this && this.__classPrivateFieldGet || function(receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var _LRUCache_instances, _LRUCache_cache, _LRUCache_moveToEnd, _LRUCache_evict;
Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.LRUCache = void 0;
exports.snakeToCamel = snakeToCamel;
exports.originalOrCamelOptions = originalOrCamelOptions;
/**
 * Returns the camel case of a provided string.
 *
 * @remarks
 *
 * Match any `_` and not `_` pair, then return the uppercase of the not `_`
 * character.
 *
 * @internal
 *
 * @param str the string to convert
 * @returns the camelCase'd string
 */ function snakeToCamel(str) {
    return str.replace(/([_][^_])/g, (match)=>match.slice(1).toUpperCase());
}
/**
 * Get the value of `obj[key]` or `obj[camelCaseKey]`, with a preference
 * for original, non-camelCase key.
 *
 * @param obj object to lookup a value in
 * @returns a `get` function for getting `obj[key || snakeKey]`, if available
 */ function originalOrCamelOptions(obj) {
    /**
     *
     * @param key an index of object, preferably snake_case
     * @returns the value `obj[key || snakeKey]`, if available
     */ function get(key) {
        var _a;
        const o = obj || {};
        return (_a = o[key]) !== null && _a !== void 0 ? _a : o[snakeToCamel(key)];
    }
    return {
        get
    };
}
/**
 * A simple LRU cache utility.
 * Not meant for external usage.
 *
 * @experimental
 * @internal
 */ class LRUCache {
    constructor(options){
        _LRUCache_instances.add(this);
        /**
         * Maps are in order. Thus, the older item is the first item.
         *
         * {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map}
         */ _LRUCache_cache.set(this, new Map());
        this.capacity = options.capacity;
        this.maxAge = options.maxAge;
    }
    /**
     * Add an item to the cache.
     *
     * @param key the key to upsert
     * @param value the value of the key
     */ set(key, value) {
        __classPrivateFieldGet(this, _LRUCache_instances, "m", _LRUCache_moveToEnd).call(this, key, value);
        __classPrivateFieldGet(this, _LRUCache_instances, "m", _LRUCache_evict).call(this);
    }
    /**
     * Get an item from the cache.
     *
     * @param key the key to retrieve
     */ get(key) {
        const item = __classPrivateFieldGet(this, _LRUCache_cache, "f").get(key);
        if (!item) return;
        __classPrivateFieldGet(this, _LRUCache_instances, "m", _LRUCache_moveToEnd).call(this, key, item.value);
        __classPrivateFieldGet(this, _LRUCache_instances, "m", _LRUCache_evict).call(this);
        return item.value;
    }
}
exports.LRUCache = LRUCache;
_LRUCache_cache = new WeakMap(), _LRUCache_instances = new WeakSet(), _LRUCache_moveToEnd = function _LRUCache_moveToEnd(key, value) {
    __classPrivateFieldGet(this, _LRUCache_cache, "f").delete(key);
    __classPrivateFieldGet(this, _LRUCache_cache, "f").set(key, {
        value,
        lastAccessed: Date.now()
    });
}, _LRUCache_evict = function _LRUCache_evict() {
    const cutoffDate = this.maxAge ? Date.now() - this.maxAge : 0;
    /**
     * Because we know Maps are in order, this item is both the
     * last item in the list (capacity) and oldest (maxAge).
     */ let oldestItem = __classPrivateFieldGet(this, _LRUCache_cache, "f").entries().next();
    while(!oldestItem.done && (__classPrivateFieldGet(this, _LRUCache_cache, "f").size > this.capacity || // too many
    oldestItem.value[1].lastAccessed < cutoffDate) // too old
    ){
        __classPrivateFieldGet(this, _LRUCache_cache, "f").delete(oldestItem.value[0]);
        oldestItem = __classPrivateFieldGet(this, _LRUCache_cache, "f").entries().next();
    }
};
}}),
"[project]/node_modules/.pnpm/google-auth-library@9.15.0_encoding@0.1.13/node_modules/google-auth-library/build/src/auth/authclient.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
// Copyright 2012 Google LLC
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
Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.AuthClient = exports.DEFAULT_EAGER_REFRESH_THRESHOLD_MILLIS = exports.DEFAULT_UNIVERSE = void 0;
const events_1 = __turbopack_require__("[externals]/ [external] (events, cjs)");
const gaxios_1 = __turbopack_require__("[project]/node_modules/.pnpm/gaxios@6.7.1_encoding@0.1.13/node_modules/gaxios/build/src/index.js [app-rsc] (ecmascript)");
const transporters_1 = __turbopack_require__("[project]/node_modules/.pnpm/google-auth-library@9.15.0_encoding@0.1.13/node_modules/google-auth-library/build/src/transporters.js [app-rsc] (ecmascript)");
const util_1 = __turbopack_require__("[project]/node_modules/.pnpm/google-auth-library@9.15.0_encoding@0.1.13/node_modules/google-auth-library/build/src/util.js [app-rsc] (ecmascript)");
/**
 * The default cloud universe
 *
 * @see {@link AuthJSONOptions.universe_domain}
 */ exports.DEFAULT_UNIVERSE = 'googleapis.com';
/**
 * The default {@link AuthClientOptions.eagerRefreshThresholdMillis}
 */ exports.DEFAULT_EAGER_REFRESH_THRESHOLD_MILLIS = 5 * 60 * 1000;
class AuthClient extends events_1.EventEmitter {
    constructor(opts = {}){
        var _a, _b, _c, _d, _e;
        super();
        this.credentials = {};
        this.eagerRefreshThresholdMillis = exports.DEFAULT_EAGER_REFRESH_THRESHOLD_MILLIS;
        this.forceRefreshOnFailure = false;
        this.universeDomain = exports.DEFAULT_UNIVERSE;
        const options = (0, util_1.originalOrCamelOptions)(opts);
        // Shared auth options
        this.apiKey = opts.apiKey;
        this.projectId = (_a = options.get('project_id')) !== null && _a !== void 0 ? _a : null;
        this.quotaProjectId = options.get('quota_project_id');
        this.credentials = (_b = options.get('credentials')) !== null && _b !== void 0 ? _b : {};
        this.universeDomain = (_c = options.get('universe_domain')) !== null && _c !== void 0 ? _c : exports.DEFAULT_UNIVERSE;
        // Shared client options
        this.transporter = (_d = opts.transporter) !== null && _d !== void 0 ? _d : new transporters_1.DefaultTransporter();
        if (opts.transporterOptions) {
            this.transporter.defaults = opts.transporterOptions;
        }
        if (opts.eagerRefreshThresholdMillis) {
            this.eagerRefreshThresholdMillis = opts.eagerRefreshThresholdMillis;
        }
        this.forceRefreshOnFailure = (_e = opts.forceRefreshOnFailure) !== null && _e !== void 0 ? _e : false;
    }
    /**
     * Return the {@link Gaxios `Gaxios`} instance from the {@link AuthClient.transporter}.
     *
     * @expiremental
     */ get gaxios() {
        if (this.transporter instanceof gaxios_1.Gaxios) {
            return this.transporter;
        } else if (this.transporter instanceof transporters_1.DefaultTransporter) {
            return this.transporter.instance;
        } else if ('instance' in this.transporter && this.transporter.instance instanceof gaxios_1.Gaxios) {
            return this.transporter.instance;
        }
        return null;
    }
    /**
     * Sets the auth credentials.
     */ setCredentials(credentials) {
        this.credentials = credentials;
    }
    /**
     * Append additional headers, e.g., x-goog-user-project, shared across the
     * classes inheriting AuthClient. This method should be used by any method
     * that overrides getRequestMetadataAsync(), which is a shared helper for
     * setting request information in both gRPC and HTTP API calls.
     *
     * @param headers object to append additional headers to.
     */ addSharedMetadataHeaders(headers) {
        // quota_project_id, stored in application_default_credentials.json, is set in
        // the x-goog-user-project header, to indicate an alternate account for
        // billing and quota:
        if (!headers['x-goog-user-project'] && // don't override a value the user sets.
        this.quotaProjectId) {
            headers['x-goog-user-project'] = this.quotaProjectId;
        }
        return headers;
    }
    /**
     * Retry config for Auth-related requests.
     *
     * @remarks
     *
     * This is not a part of the default {@link AuthClient.transporter transporter/gaxios}
     * config as some downstream APIs would prefer if customers explicitly enable retries,
     * such as GCS.
     */ static get RETRY_CONFIG() {
        return {
            retry: true,
            retryConfig: {
                httpMethodsToRetry: [
                    'GET',
                    'PUT',
                    'POST',
                    'HEAD',
                    'OPTIONS',
                    'DELETE'
                ]
            }
        };
    }
}
exports.AuthClient = AuthClient;
}}),
"[project]/node_modules/.pnpm/google-auth-library@9.15.0_encoding@0.1.13/node_modules/google-auth-library/build/src/auth/loginticket.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
// Copyright 2014 Google LLC
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
Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.LoginTicket = void 0;
class LoginTicket {
    /**
     * Create a simple class to extract user ID from an ID Token
     *
     * @param {string} env Envelope of the jwt
     * @param {TokenPayload} pay Payload of the jwt
     * @constructor
     */ constructor(env, pay){
        this.envelope = env;
        this.payload = pay;
    }
    getEnvelope() {
        return this.envelope;
    }
    getPayload() {
        return this.payload;
    }
    /**
     * Create a simple class to extract user ID from an ID Token
     *
     * @return The user ID
     */ getUserId() {
        const payload = this.getPayload();
        if (payload && payload.sub) {
            return payload.sub;
        }
        return null;
    }
    /**
     * Returns attributes from the login ticket.  This can contain
     * various information about the user session.
     *
     * @return The envelope and payload
     */ getAttributes() {
        return {
            envelope: this.getEnvelope(),
            payload: this.getPayload()
        };
    }
}
exports.LoginTicket = LoginTicket;
}}),
"[project]/node_modules/.pnpm/google-auth-library@9.15.0_encoding@0.1.13/node_modules/google-auth-library/build/src/auth/oauth2client.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
// Copyright 2019 Google LLC
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
Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.OAuth2Client = exports.ClientAuthentication = exports.CertificateFormat = exports.CodeChallengeMethod = void 0;
const gaxios_1 = __turbopack_require__("[project]/node_modules/.pnpm/gaxios@6.7.1_encoding@0.1.13/node_modules/gaxios/build/src/index.js [app-rsc] (ecmascript)");
const querystring = __turbopack_require__("[externals]/ [external] (querystring, cjs)");
const stream = __turbopack_require__("[externals]/ [external] (stream, cjs)");
const formatEcdsa = __turbopack_require__("[project]/node_modules/.pnpm/ecdsa-sig-formatter@1.0.11/node_modules/ecdsa-sig-formatter/src/ecdsa-sig-formatter.js [app-rsc] (ecmascript)");
const crypto_1 = __turbopack_require__("[project]/node_modules/.pnpm/google-auth-library@9.15.0_encoding@0.1.13/node_modules/google-auth-library/build/src/crypto/crypto.js [app-rsc] (ecmascript)");
const authclient_1 = __turbopack_require__("[project]/node_modules/.pnpm/google-auth-library@9.15.0_encoding@0.1.13/node_modules/google-auth-library/build/src/auth/authclient.js [app-rsc] (ecmascript)");
const loginticket_1 = __turbopack_require__("[project]/node_modules/.pnpm/google-auth-library@9.15.0_encoding@0.1.13/node_modules/google-auth-library/build/src/auth/loginticket.js [app-rsc] (ecmascript)");
var CodeChallengeMethod;
(function(CodeChallengeMethod) {
    CodeChallengeMethod["Plain"] = "plain";
    CodeChallengeMethod["S256"] = "S256";
})(CodeChallengeMethod || (exports.CodeChallengeMethod = CodeChallengeMethod = {}));
var CertificateFormat;
(function(CertificateFormat) {
    CertificateFormat["PEM"] = "PEM";
    CertificateFormat["JWK"] = "JWK";
})(CertificateFormat || (exports.CertificateFormat = CertificateFormat = {}));
/**
 * The client authentication type. Supported values are basic, post, and none.
 * https://datatracker.ietf.org/doc/html/rfc7591#section-2
 */ var ClientAuthentication;
(function(ClientAuthentication) {
    ClientAuthentication["ClientSecretPost"] = "ClientSecretPost";
    ClientAuthentication["ClientSecretBasic"] = "ClientSecretBasic";
    ClientAuthentication["None"] = "None";
})(ClientAuthentication || (exports.ClientAuthentication = ClientAuthentication = {}));
class OAuth2Client extends authclient_1.AuthClient {
    constructor(optionsOrClientId, clientSecret, redirectUri){
        const opts = optionsOrClientId && typeof optionsOrClientId === 'object' ? optionsOrClientId : {
            clientId: optionsOrClientId,
            clientSecret,
            redirectUri
        };
        super(opts);
        this.certificateCache = {};
        this.certificateExpiry = null;
        this.certificateCacheFormat = CertificateFormat.PEM;
        this.refreshTokenPromises = new Map();
        this._clientId = opts.clientId;
        this._clientSecret = opts.clientSecret;
        this.redirectUri = opts.redirectUri;
        this.endpoints = {
            tokenInfoUrl: 'https://oauth2.googleapis.com/tokeninfo',
            oauth2AuthBaseUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
            oauth2TokenUrl: 'https://oauth2.googleapis.com/token',
            oauth2RevokeUrl: 'https://oauth2.googleapis.com/revoke',
            oauth2FederatedSignonPemCertsUrl: 'https://www.googleapis.com/oauth2/v1/certs',
            oauth2FederatedSignonJwkCertsUrl: 'https://www.googleapis.com/oauth2/v3/certs',
            oauth2IapPublicKeyUrl: 'https://www.gstatic.com/iap/verify/public_key',
            ...opts.endpoints
        };
        this.clientAuthentication = opts.clientAuthentication || ClientAuthentication.ClientSecretPost;
        this.issuers = opts.issuers || [
            'accounts.google.com',
            'https://accounts.google.com',
            this.universeDomain
        ];
    }
    /**
     * Generates URL for consent page landing.
     * @param opts Options.
     * @return URL to consent page.
     */ generateAuthUrl(opts = {}) {
        if (opts.code_challenge_method && !opts.code_challenge) {
            throw new Error('If a code_challenge_method is provided, code_challenge must be included.');
        }
        opts.response_type = opts.response_type || 'code';
        opts.client_id = opts.client_id || this._clientId;
        opts.redirect_uri = opts.redirect_uri || this.redirectUri;
        // Allow scopes to be passed either as array or a string
        if (Array.isArray(opts.scope)) {
            opts.scope = opts.scope.join(' ');
        }
        const rootUrl = this.endpoints.oauth2AuthBaseUrl.toString();
        return rootUrl + '?' + querystring.stringify(opts);
    }
    generateCodeVerifier() {
        // To make the code compatible with browser SubtleCrypto we need to make
        // this method async.
        throw new Error('generateCodeVerifier is removed, please use generateCodeVerifierAsync instead.');
    }
    /**
     * Convenience method to automatically generate a code_verifier, and its
     * resulting SHA256. If used, this must be paired with a S256
     * code_challenge_method.
     *
     * For a full example see:
     * https://github.com/googleapis/google-auth-library-nodejs/blob/main/samples/oauth2-codeVerifier.js
     */ async generateCodeVerifierAsync() {
        // base64 encoding uses 6 bits per character, and we want to generate128
        // characters. 6*128/8 = 96.
        const crypto = (0, crypto_1.createCrypto)();
        const randomString = crypto.randomBytesBase64(96);
        // The valid characters in the code_verifier are [A-Z]/[a-z]/[0-9]/
        // "-"/"."/"_"/"~". Base64 encoded strings are pretty close, so we're just
        // swapping out a few chars.
        const codeVerifier = randomString.replace(/\+/g, '~').replace(/=/g, '_').replace(/\//g, '-');
        // Generate the base64 encoded SHA256
        const unencodedCodeChallenge = await crypto.sha256DigestBase64(codeVerifier);
        // We need to use base64UrlEncoding instead of standard base64
        const codeChallenge = unencodedCodeChallenge.split('=')[0].replace(/\+/g, '-').replace(/\//g, '_');
        return {
            codeVerifier,
            codeChallenge
        };
    }
    getToken(codeOrOptions, callback) {
        const options = typeof codeOrOptions === 'string' ? {
            code: codeOrOptions
        } : codeOrOptions;
        if (callback) {
            this.getTokenAsync(options).then((r)=>callback(null, r.tokens, r.res), (e)=>callback(e, null, e.response));
        } else {
            return this.getTokenAsync(options);
        }
    }
    async getTokenAsync(options) {
        const url = this.endpoints.oauth2TokenUrl.toString();
        const headers = {
            'Content-Type': 'application/x-www-form-urlencoded'
        };
        const values = {
            client_id: options.client_id || this._clientId,
            code_verifier: options.codeVerifier,
            code: options.code,
            grant_type: 'authorization_code',
            redirect_uri: options.redirect_uri || this.redirectUri
        };
        if (this.clientAuthentication === ClientAuthentication.ClientSecretBasic) {
            const basic = Buffer.from(`${this._clientId}:${this._clientSecret}`);
            headers['Authorization'] = `Basic ${basic.toString('base64')}`;
        }
        if (this.clientAuthentication === ClientAuthentication.ClientSecretPost) {
            values.client_secret = this._clientSecret;
        }
        const res = await this.transporter.request({
            ...OAuth2Client.RETRY_CONFIG,
            method: 'POST',
            url,
            data: querystring.stringify(values),
            headers
        });
        const tokens = res.data;
        if (res.data && res.data.expires_in) {
            tokens.expiry_date = new Date().getTime() + res.data.expires_in * 1000;
            delete tokens.expires_in;
        }
        this.emit('tokens', tokens);
        return {
            tokens,
            res
        };
    }
    /**
     * Refreshes the access token.
     * @param refresh_token Existing refresh token.
     * @private
     */ async refreshToken(refreshToken) {
        if (!refreshToken) {
            return this.refreshTokenNoCache(refreshToken);
        }
        // If a request to refresh using the same token has started,
        // return the same promise.
        if (this.refreshTokenPromises.has(refreshToken)) {
            return this.refreshTokenPromises.get(refreshToken);
        }
        const p = this.refreshTokenNoCache(refreshToken).then((r)=>{
            this.refreshTokenPromises.delete(refreshToken);
            return r;
        }, (e)=>{
            this.refreshTokenPromises.delete(refreshToken);
            throw e;
        });
        this.refreshTokenPromises.set(refreshToken, p);
        return p;
    }
    async refreshTokenNoCache(refreshToken) {
        var _a;
        if (!refreshToken) {
            throw new Error('No refresh token is set.');
        }
        const url = this.endpoints.oauth2TokenUrl.toString();
        const data = {
            refresh_token: refreshToken,
            client_id: this._clientId,
            client_secret: this._clientSecret,
            grant_type: 'refresh_token'
        };
        let res;
        try {
            // request for new token
            res = await this.transporter.request({
                ...OAuth2Client.RETRY_CONFIG,
                method: 'POST',
                url,
                data: querystring.stringify(data),
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            });
        } catch (e) {
            if (e instanceof gaxios_1.GaxiosError && e.message === 'invalid_grant' && ((_a = e.response) === null || _a === void 0 ? void 0 : _a.data) && /ReAuth/i.test(e.response.data.error_description)) {
                e.message = JSON.stringify(e.response.data);
            }
            throw e;
        }
        const tokens = res.data;
        // TODO: de-duplicate this code from a few spots
        if (res.data && res.data.expires_in) {
            tokens.expiry_date = new Date().getTime() + res.data.expires_in * 1000;
            delete tokens.expires_in;
        }
        this.emit('tokens', tokens);
        return {
            tokens,
            res
        };
    }
    refreshAccessToken(callback) {
        if (callback) {
            this.refreshAccessTokenAsync().then((r)=>callback(null, r.credentials, r.res), callback);
        } else {
            return this.refreshAccessTokenAsync();
        }
    }
    async refreshAccessTokenAsync() {
        const r = await this.refreshToken(this.credentials.refresh_token);
        const tokens = r.tokens;
        tokens.refresh_token = this.credentials.refresh_token;
        this.credentials = tokens;
        return {
            credentials: this.credentials,
            res: r.res
        };
    }
    getAccessToken(callback) {
        if (callback) {
            this.getAccessTokenAsync().then((r)=>callback(null, r.token, r.res), callback);
        } else {
            return this.getAccessTokenAsync();
        }
    }
    async getAccessTokenAsync() {
        const shouldRefresh = !this.credentials.access_token || this.isTokenExpiring();
        if (shouldRefresh) {
            if (!this.credentials.refresh_token) {
                if (this.refreshHandler) {
                    const refreshedAccessToken = await this.processAndValidateRefreshHandler();
                    if (refreshedAccessToken === null || refreshedAccessToken === void 0 ? void 0 : refreshedAccessToken.access_token) {
                        this.setCredentials(refreshedAccessToken);
                        return {
                            token: this.credentials.access_token
                        };
                    }
                } else {
                    throw new Error('No refresh token or refresh handler callback is set.');
                }
            }
            const r = await this.refreshAccessTokenAsync();
            if (!r.credentials || r.credentials && !r.credentials.access_token) {
                throw new Error('Could not refresh access token.');
            }
            return {
                token: r.credentials.access_token,
                res: r.res
            };
        } else {
            return {
                token: this.credentials.access_token
            };
        }
    }
    /**
     * The main authentication interface.  It takes an optional url which when
     * present is the endpoint being accessed, and returns a Promise which
     * resolves with authorization header fields.
     *
     * In OAuth2Client, the result has the form:
     * { Authorization: 'Bearer <access_token_value>' }
     * @param url The optional url being authorized
     */ async getRequestHeaders(url) {
        const headers = (await this.getRequestMetadataAsync(url)).headers;
        return headers;
    }
    async getRequestMetadataAsync(// eslint-disable-next-line @typescript-eslint/no-unused-vars
    url) {
        const thisCreds = this.credentials;
        if (!thisCreds.access_token && !thisCreds.refresh_token && !this.apiKey && !this.refreshHandler) {
            throw new Error('No access, refresh token, API key or refresh handler callback is set.');
        }
        if (thisCreds.access_token && !this.isTokenExpiring()) {
            thisCreds.token_type = thisCreds.token_type || 'Bearer';
            const headers = {
                Authorization: thisCreds.token_type + ' ' + thisCreds.access_token
            };
            return {
                headers: this.addSharedMetadataHeaders(headers)
            };
        }
        // If refreshHandler exists, call processAndValidateRefreshHandler().
        if (this.refreshHandler) {
            const refreshedAccessToken = await this.processAndValidateRefreshHandler();
            if (refreshedAccessToken === null || refreshedAccessToken === void 0 ? void 0 : refreshedAccessToken.access_token) {
                this.setCredentials(refreshedAccessToken);
                const headers = {
                    Authorization: 'Bearer ' + this.credentials.access_token
                };
                return {
                    headers: this.addSharedMetadataHeaders(headers)
                };
            }
        }
        if (this.apiKey) {
            return {
                headers: {
                    'X-Goog-Api-Key': this.apiKey
                }
            };
        }
        let r = null;
        let tokens = null;
        try {
            r = await this.refreshToken(thisCreds.refresh_token);
            tokens = r.tokens;
        } catch (err) {
            const e = err;
            if (e.response && (e.response.status === 403 || e.response.status === 404)) {
                e.message = `Could not refresh access token: ${e.message}`;
            }
            throw e;
        }
        const credentials = this.credentials;
        credentials.token_type = credentials.token_type || 'Bearer';
        tokens.refresh_token = credentials.refresh_token;
        this.credentials = tokens;
        const headers = {
            Authorization: credentials.token_type + ' ' + tokens.access_token
        };
        return {
            headers: this.addSharedMetadataHeaders(headers),
            res: r.res
        };
    }
    /**
     * Generates an URL to revoke the given token.
     * @param token The existing token to be revoked.
     *
     * @deprecated use instance method {@link OAuth2Client.getRevokeTokenURL}
     */ static getRevokeTokenUrl(token) {
        return new OAuth2Client().getRevokeTokenURL(token).toString();
    }
    /**
     * Generates a URL to revoke the given token.
     *
     * @param token The existing token to be revoked.
     */ getRevokeTokenURL(token) {
        const url = new URL(this.endpoints.oauth2RevokeUrl);
        url.searchParams.append('token', token);
        return url;
    }
    revokeToken(token, callback) {
        const opts = {
            ...OAuth2Client.RETRY_CONFIG,
            url: this.getRevokeTokenURL(token).toString(),
            method: 'POST'
        };
        if (callback) {
            this.transporter.request(opts).then((r)=>callback(null, r), callback);
        } else {
            return this.transporter.request(opts);
        }
    }
    revokeCredentials(callback) {
        if (callback) {
            this.revokeCredentialsAsync().then((res)=>callback(null, res), callback);
        } else {
            return this.revokeCredentialsAsync();
        }
    }
    async revokeCredentialsAsync() {
        const token = this.credentials.access_token;
        this.credentials = {};
        if (token) {
            return this.revokeToken(token);
        } else {
            throw new Error('No access token to revoke.');
        }
    }
    request(opts, callback) {
        if (callback) {
            this.requestAsync(opts).then((r)=>callback(null, r), (e)=>{
                return callback(e, e.response);
            });
        } else {
            return this.requestAsync(opts);
        }
    }
    async requestAsync(opts, reAuthRetried = false) {
        let r2;
        try {
            const r = await this.getRequestMetadataAsync(opts.url);
            opts.headers = opts.headers || {};
            if (r.headers && r.headers['x-goog-user-project']) {
                opts.headers['x-goog-user-project'] = r.headers['x-goog-user-project'];
            }
            if (r.headers && r.headers.Authorization) {
                opts.headers.Authorization = r.headers.Authorization;
            }
            if (this.apiKey) {
                opts.headers['X-Goog-Api-Key'] = this.apiKey;
            }
            r2 = await this.transporter.request(opts);
        } catch (e) {
            const res = e.response;
            if (res) {
                const statusCode = res.status;
                // Retry the request for metadata if the following criteria are true:
                // - We haven't already retried.  It only makes sense to retry once.
                // - The response was a 401 or a 403
                // - The request didn't send a readableStream
                // - An access_token and refresh_token were available, but either no
                //   expiry_date was available or the forceRefreshOnFailure flag is set.
                //   The absent expiry_date case can happen when developers stash the
                //   access_token and refresh_token for later use, but the access_token
                //   fails on the first try because it's expired. Some developers may
                //   choose to enable forceRefreshOnFailure to mitigate time-related
                //   errors.
                // Or the following criteria are true:
                // - We haven't already retried.  It only makes sense to retry once.
                // - The response was a 401 or a 403
                // - The request didn't send a readableStream
                // - No refresh_token was available
                // - An access_token and a refreshHandler callback were available, but
                //   either no expiry_date was available or the forceRefreshOnFailure
                //   flag is set. The access_token fails on the first try because it's
                //   expired. Some developers may choose to enable forceRefreshOnFailure
                //   to mitigate time-related errors.
                const mayRequireRefresh = this.credentials && this.credentials.access_token && this.credentials.refresh_token && (!this.credentials.expiry_date || this.forceRefreshOnFailure);
                const mayRequireRefreshWithNoRefreshToken = this.credentials && this.credentials.access_token && !this.credentials.refresh_token && (!this.credentials.expiry_date || this.forceRefreshOnFailure) && this.refreshHandler;
                const isReadableStream = res.config.data instanceof stream.Readable;
                const isAuthErr = statusCode === 401 || statusCode === 403;
                if (!reAuthRetried && isAuthErr && !isReadableStream && mayRequireRefresh) {
                    await this.refreshAccessTokenAsync();
                    return this.requestAsync(opts, true);
                } else if (!reAuthRetried && isAuthErr && !isReadableStream && mayRequireRefreshWithNoRefreshToken) {
                    const refreshedAccessToken = await this.processAndValidateRefreshHandler();
                    if (refreshedAccessToken === null || refreshedAccessToken === void 0 ? void 0 : refreshedAccessToken.access_token) {
                        this.setCredentials(refreshedAccessToken);
                    }
                    return this.requestAsync(opts, true);
                }
            }
            throw e;
        }
        return r2;
    }
    verifyIdToken(options, callback) {
        // This function used to accept two arguments instead of an options object.
        // Check the types to help users upgrade with less pain.
        // This check can be removed after a 2.0 release.
        if (callback && typeof callback !== 'function') {
            throw new Error('This method accepts an options object as the first parameter, which includes the idToken, audience, and maxExpiry.');
        }
        if (callback) {
            this.verifyIdTokenAsync(options).then((r)=>callback(null, r), callback);
        } else {
            return this.verifyIdTokenAsync(options);
        }
    }
    async verifyIdTokenAsync(options) {
        if (!options.idToken) {
            throw new Error('The verifyIdToken method requires an ID Token');
        }
        const response = await this.getFederatedSignonCertsAsync();
        const login = await this.verifySignedJwtWithCertsAsync(options.idToken, response.certs, options.audience, this.issuers, options.maxExpiry);
        return login;
    }
    /**
     * Obtains information about the provisioned access token.  Especially useful
     * if you want to check the scopes that were provisioned to a given token.
     *
     * @param accessToken Required.  The Access Token for which you want to get
     * user info.
     */ async getTokenInfo(accessToken) {
        const { data } = await this.transporter.request({
            ...OAuth2Client.RETRY_CONFIG,
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                Authorization: `Bearer ${accessToken}`
            },
            url: this.endpoints.tokenInfoUrl.toString()
        });
        const info = Object.assign({
            expiry_date: new Date().getTime() + data.expires_in * 1000,
            scopes: data.scope.split(' ')
        }, data);
        delete info.expires_in;
        delete info.scope;
        return info;
    }
    getFederatedSignonCerts(callback) {
        if (callback) {
            this.getFederatedSignonCertsAsync().then((r)=>callback(null, r.certs, r.res), callback);
        } else {
            return this.getFederatedSignonCertsAsync();
        }
    }
    async getFederatedSignonCertsAsync() {
        const nowTime = new Date().getTime();
        const format = (0, crypto_1.hasBrowserCrypto)() ? CertificateFormat.JWK : CertificateFormat.PEM;
        if (this.certificateExpiry && nowTime < this.certificateExpiry.getTime() && this.certificateCacheFormat === format) {
            return {
                certs: this.certificateCache,
                format
            };
        }
        let res;
        let url;
        switch(format){
            case CertificateFormat.PEM:
                url = this.endpoints.oauth2FederatedSignonPemCertsUrl.toString();
                break;
            case CertificateFormat.JWK:
                url = this.endpoints.oauth2FederatedSignonJwkCertsUrl.toString();
                break;
            default:
                throw new Error(`Unsupported certificate format ${format}`);
        }
        try {
            res = await this.transporter.request({
                ...OAuth2Client.RETRY_CONFIG,
                url
            });
        } catch (e) {
            if (e instanceof Error) {
                e.message = `Failed to retrieve verification certificates: ${e.message}`;
            }
            throw e;
        }
        const cacheControl = res ? res.headers['cache-control'] : undefined;
        let cacheAge = -1;
        if (cacheControl) {
            const pattern = new RegExp('max-age=([0-9]*)');
            const regexResult = pattern.exec(cacheControl);
            if (regexResult && regexResult.length === 2) {
                // Cache results with max-age (in seconds)
                cacheAge = Number(regexResult[1]) * 1000; // milliseconds
            }
        }
        let certificates = {};
        switch(format){
            case CertificateFormat.PEM:
                certificates = res.data;
                break;
            case CertificateFormat.JWK:
                for (const key of res.data.keys){
                    certificates[key.kid] = key;
                }
                break;
            default:
                throw new Error(`Unsupported certificate format ${format}`);
        }
        const now = new Date();
        this.certificateExpiry = cacheAge === -1 ? null : new Date(now.getTime() + cacheAge);
        this.certificateCache = certificates;
        this.certificateCacheFormat = format;
        return {
            certs: certificates,
            format,
            res
        };
    }
    getIapPublicKeys(callback) {
        if (callback) {
            this.getIapPublicKeysAsync().then((r)=>callback(null, r.pubkeys, r.res), callback);
        } else {
            return this.getIapPublicKeysAsync();
        }
    }
    async getIapPublicKeysAsync() {
        let res;
        const url = this.endpoints.oauth2IapPublicKeyUrl.toString();
        try {
            res = await this.transporter.request({
                ...OAuth2Client.RETRY_CONFIG,
                url
            });
        } catch (e) {
            if (e instanceof Error) {
                e.message = `Failed to retrieve verification certificates: ${e.message}`;
            }
            throw e;
        }
        return {
            pubkeys: res.data,
            res
        };
    }
    verifySignedJwtWithCerts() {
        // To make the code compatible with browser SubtleCrypto we need to make
        // this method async.
        throw new Error('verifySignedJwtWithCerts is removed, please use verifySignedJwtWithCertsAsync instead.');
    }
    /**
     * Verify the id token is signed with the correct certificate
     * and is from the correct audience.
     * @param jwt The jwt to verify (The ID Token in this case).
     * @param certs The array of certs to test the jwt against.
     * @param requiredAudience The audience to test the jwt against.
     * @param issuers The allowed issuers of the jwt (Optional).
     * @param maxExpiry The max expiry the certificate can be (Optional).
     * @return Returns a promise resolving to LoginTicket on verification.
     */ async verifySignedJwtWithCertsAsync(jwt, certs, requiredAudience, issuers, maxExpiry) {
        const crypto = (0, crypto_1.createCrypto)();
        if (!maxExpiry) {
            maxExpiry = OAuth2Client.DEFAULT_MAX_TOKEN_LIFETIME_SECS_;
        }
        const segments = jwt.split('.');
        if (segments.length !== 3) {
            throw new Error('Wrong number of segments in token: ' + jwt);
        }
        const signed = segments[0] + '.' + segments[1];
        let signature = segments[2];
        let envelope;
        let payload;
        try {
            envelope = JSON.parse(crypto.decodeBase64StringUtf8(segments[0]));
        } catch (err) {
            if (err instanceof Error) {
                err.message = `Can't parse token envelope: ${segments[0]}': ${err.message}`;
            }
            throw err;
        }
        if (!envelope) {
            throw new Error("Can't parse token envelope: " + segments[0]);
        }
        try {
            payload = JSON.parse(crypto.decodeBase64StringUtf8(segments[1]));
        } catch (err) {
            if (err instanceof Error) {
                err.message = `Can't parse token payload '${segments[0]}`;
            }
            throw err;
        }
        if (!payload) {
            throw new Error("Can't parse token payload: " + segments[1]);
        }
        if (!Object.prototype.hasOwnProperty.call(certs, envelope.kid)) {
            // If this is not present, then there's no reason to attempt verification
            throw new Error('No pem found for envelope: ' + JSON.stringify(envelope));
        }
        const cert = certs[envelope.kid];
        if (envelope.alg === 'ES256') {
            signature = formatEcdsa.joseToDer(signature, 'ES256').toString('base64');
        }
        const verified = await crypto.verify(cert, signed, signature);
        if (!verified) {
            throw new Error('Invalid token signature: ' + jwt);
        }
        if (!payload.iat) {
            throw new Error('No issue time in token: ' + JSON.stringify(payload));
        }
        if (!payload.exp) {
            throw new Error('No expiration time in token: ' + JSON.stringify(payload));
        }
        const iat = Number(payload.iat);
        if (isNaN(iat)) throw new Error('iat field using invalid format');
        const exp = Number(payload.exp);
        if (isNaN(exp)) throw new Error('exp field using invalid format');
        const now = new Date().getTime() / 1000;
        if (exp >= now + maxExpiry) {
            throw new Error('Expiration time too far in future: ' + JSON.stringify(payload));
        }
        const earliest = iat - OAuth2Client.CLOCK_SKEW_SECS_;
        const latest = exp + OAuth2Client.CLOCK_SKEW_SECS_;
        if (now < earliest) {
            throw new Error('Token used too early, ' + now + ' < ' + earliest + ': ' + JSON.stringify(payload));
        }
        if (now > latest) {
            throw new Error('Token used too late, ' + now + ' > ' + latest + ': ' + JSON.stringify(payload));
        }
        if (issuers && issuers.indexOf(payload.iss) < 0) {
            throw new Error('Invalid issuer, expected one of [' + issuers + '], but got ' + payload.iss);
        }
        // Check the audience matches if we have one
        if (typeof requiredAudience !== 'undefined' && requiredAudience !== null) {
            const aud = payload.aud;
            let audVerified = false;
            // If the requiredAudience is an array, check if it contains token
            // audience
            if (requiredAudience.constructor === Array) {
                audVerified = requiredAudience.indexOf(aud) > -1;
            } else {
                audVerified = aud === requiredAudience;
            }
            if (!audVerified) {
                throw new Error('Wrong recipient, payload audience != requiredAudience');
            }
        }
        return new loginticket_1.LoginTicket(envelope, payload);
    }
    /**
     * Returns a promise that resolves with AccessTokenResponse type if
     * refreshHandler is defined.
     * If not, nothing is returned.
     */ async processAndValidateRefreshHandler() {
        if (this.refreshHandler) {
            const accessTokenResponse = await this.refreshHandler();
            if (!accessTokenResponse.access_token) {
                throw new Error('No access token is returned by the refreshHandler callback.');
            }
            return accessTokenResponse;
        }
        return;
    }
    /**
     * Returns true if a token is expired or will expire within
     * eagerRefreshThresholdMillismilliseconds.
     * If there is no expiry time, assumes the token is not expired or expiring.
     */ isTokenExpiring() {
        const expiryDate = this.credentials.expiry_date;
        return expiryDate ? expiryDate <= new Date().getTime() + this.eagerRefreshThresholdMillis : false;
    }
}
exports.OAuth2Client = OAuth2Client;
/**
 * @deprecated use instance's {@link OAuth2Client.endpoints}
 */ OAuth2Client.GOOGLE_TOKEN_INFO_URL = 'https://oauth2.googleapis.com/tokeninfo';
/**
 * Clock skew - five minutes in seconds
 */ OAuth2Client.CLOCK_SKEW_SECS_ = 300;
/**
 * The default max Token Lifetime is one day in seconds
 */ OAuth2Client.DEFAULT_MAX_TOKEN_LIFETIME_SECS_ = 86400;
}}),
"[project]/node_modules/.pnpm/google-auth-library@9.15.0_encoding@0.1.13/node_modules/google-auth-library/build/src/auth/computeclient.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
// Copyright 2013 Google LLC
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
Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.Compute = void 0;
const gaxios_1 = __turbopack_require__("[project]/node_modules/.pnpm/gaxios@6.7.1_encoding@0.1.13/node_modules/gaxios/build/src/index.js [app-rsc] (ecmascript)");
const gcpMetadata = __turbopack_require__("[project]/node_modules/.pnpm/gcp-metadata@6.1.0_encoding@0.1.13/node_modules/gcp-metadata/build/src/index.js [app-rsc] (ecmascript)");
const oauth2client_1 = __turbopack_require__("[project]/node_modules/.pnpm/google-auth-library@9.15.0_encoding@0.1.13/node_modules/google-auth-library/build/src/auth/oauth2client.js [app-rsc] (ecmascript)");
class Compute extends oauth2client_1.OAuth2Client {
    /**
     * Google Compute Engine service account credentials.
     *
     * Retrieve access token from the metadata server.
     * See: https://cloud.google.com/compute/docs/access/authenticate-workloads#applications
     */ constructor(options = {}){
        super(options);
        // Start with an expired refresh token, which will automatically be
        // refreshed before the first API call is made.
        this.credentials = {
            expiry_date: 1,
            refresh_token: 'compute-placeholder'
        };
        this.serviceAccountEmail = options.serviceAccountEmail || 'default';
        this.scopes = Array.isArray(options.scopes) ? options.scopes : options.scopes ? [
            options.scopes
        ] : [];
    }
    /**
     * Refreshes the access token.
     * @param refreshToken Unused parameter
     */ async refreshTokenNoCache(// eslint-disable-next-line @typescript-eslint/no-unused-vars
    refreshToken) {
        const tokenPath = `service-accounts/${this.serviceAccountEmail}/token`;
        let data;
        try {
            const instanceOptions = {
                property: tokenPath
            };
            if (this.scopes.length > 0) {
                instanceOptions.params = {
                    scopes: this.scopes.join(',')
                };
            }
            data = await gcpMetadata.instance(instanceOptions);
        } catch (e) {
            if (e instanceof gaxios_1.GaxiosError) {
                e.message = `Could not refresh access token: ${e.message}`;
                this.wrapError(e);
            }
            throw e;
        }
        const tokens = data;
        if (data && data.expires_in) {
            tokens.expiry_date = new Date().getTime() + data.expires_in * 1000;
            delete tokens.expires_in;
        }
        this.emit('tokens', tokens);
        return {
            tokens,
            res: null
        };
    }
    /**
     * Fetches an ID token.
     * @param targetAudience the audience for the fetched ID token.
     */ async fetchIdToken(targetAudience) {
        const idTokenPath = `service-accounts/${this.serviceAccountEmail}/identity` + `?format=full&audience=${targetAudience}`;
        let idToken;
        try {
            const instanceOptions = {
                property: idTokenPath
            };
            idToken = await gcpMetadata.instance(instanceOptions);
        } catch (e) {
            if (e instanceof Error) {
                e.message = `Could not fetch ID token: ${e.message}`;
            }
            throw e;
        }
        return idToken;
    }
    wrapError(e) {
        const res = e.response;
        if (res && res.status) {
            e.status = res.status;
            if (res.status === 403) {
                e.message = 'A Forbidden error was returned while attempting to retrieve an access ' + 'token for the Compute Engine built-in service account. This may be because the Compute ' + 'Engine instance does not have the correct permission scopes specified: ' + e.message;
            } else if (res.status === 404) {
                e.message = 'A Not Found error was returned while attempting to retrieve an access' + 'token for the Compute Engine built-in service account. This may be because the Compute ' + 'Engine instance does not have any permission scopes specified: ' + e.message;
            }
        }
    }
}
exports.Compute = Compute;
}}),
"[project]/node_modules/.pnpm/google-auth-library@9.15.0_encoding@0.1.13/node_modules/google-auth-library/build/src/auth/idtokenclient.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
// Copyright 2020 Google LLC
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
Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.IdTokenClient = void 0;
const oauth2client_1 = __turbopack_require__("[project]/node_modules/.pnpm/google-auth-library@9.15.0_encoding@0.1.13/node_modules/google-auth-library/build/src/auth/oauth2client.js [app-rsc] (ecmascript)");
class IdTokenClient extends oauth2client_1.OAuth2Client {
    /**
     * Google ID Token client
     *
     * Retrieve ID token from the metadata server.
     * See: https://cloud.google.com/docs/authentication/get-id-token#metadata-server
     */ constructor(options){
        super(options);
        this.targetAudience = options.targetAudience;
        this.idTokenProvider = options.idTokenProvider;
    }
    async getRequestMetadataAsync(// eslint-disable-next-line @typescript-eslint/no-unused-vars
    url) {
        if (!this.credentials.id_token || !this.credentials.expiry_date || this.isTokenExpiring()) {
            const idToken = await this.idTokenProvider.fetchIdToken(this.targetAudience);
            this.credentials = {
                id_token: idToken,
                expiry_date: this.getIdTokenExpiryDate(idToken)
            };
        }
        const headers = {
            Authorization: 'Bearer ' + this.credentials.id_token
        };
        return {
            headers
        };
    }
    getIdTokenExpiryDate(idToken) {
        const payloadB64 = idToken.split('.')[1];
        if (payloadB64) {
            const payload = JSON.parse(Buffer.from(payloadB64, 'base64').toString('ascii'));
            return payload.exp * 1000;
        }
    }
}
exports.IdTokenClient = IdTokenClient;
}}),
"[project]/node_modules/.pnpm/google-auth-library@9.15.0_encoding@0.1.13/node_modules/google-auth-library/build/src/auth/envDetect.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
// Copyright 2018 Google LLC
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
Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.GCPEnv = void 0;
exports.clear = clear;
exports.getEnv = getEnv;
const gcpMetadata = __turbopack_require__("[project]/node_modules/.pnpm/gcp-metadata@6.1.0_encoding@0.1.13/node_modules/gcp-metadata/build/src/index.js [app-rsc] (ecmascript)");
var GCPEnv;
(function(GCPEnv) {
    GCPEnv["APP_ENGINE"] = "APP_ENGINE";
    GCPEnv["KUBERNETES_ENGINE"] = "KUBERNETES_ENGINE";
    GCPEnv["CLOUD_FUNCTIONS"] = "CLOUD_FUNCTIONS";
    GCPEnv["COMPUTE_ENGINE"] = "COMPUTE_ENGINE";
    GCPEnv["CLOUD_RUN"] = "CLOUD_RUN";
    GCPEnv["NONE"] = "NONE";
})(GCPEnv || (exports.GCPEnv = GCPEnv = {}));
let envPromise;
function clear() {
    envPromise = undefined;
}
async function getEnv() {
    if (envPromise) {
        return envPromise;
    }
    envPromise = getEnvMemoized();
    return envPromise;
}
async function getEnvMemoized() {
    let env = GCPEnv.NONE;
    if (isAppEngine()) {
        env = GCPEnv.APP_ENGINE;
    } else if (isCloudFunction()) {
        env = GCPEnv.CLOUD_FUNCTIONS;
    } else if (await isComputeEngine()) {
        if (await isKubernetesEngine()) {
            env = GCPEnv.KUBERNETES_ENGINE;
        } else if (isCloudRun()) {
            env = GCPEnv.CLOUD_RUN;
        } else {
            env = GCPEnv.COMPUTE_ENGINE;
        }
    } else {
        env = GCPEnv.NONE;
    }
    return env;
}
function isAppEngine() {
    return !!(process.env.GAE_SERVICE || process.env.GAE_MODULE_NAME);
}
function isCloudFunction() {
    return !!(process.env.FUNCTION_NAME || process.env.FUNCTION_TARGET);
}
/**
 * This check only verifies that the environment is running knative.
 * This must be run *after* checking for Kubernetes, otherwise it will
 * return a false positive.
 */ function isCloudRun() {
    return !!process.env.K_CONFIGURATION;
}
async function isKubernetesEngine() {
    try {
        await gcpMetadata.instance('attributes/cluster-name');
        return true;
    } catch (e) {
        return false;
    }
}
async function isComputeEngine() {
    return gcpMetadata.isAvailable();
}
}}),
"[project]/node_modules/.pnpm/google-auth-library@9.15.0_encoding@0.1.13/node_modules/google-auth-library/build/src/auth/jwtaccess.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
// Copyright 2015 Google LLC
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
Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.JWTAccess = void 0;
const jws = __turbopack_require__("[project]/node_modules/.pnpm/jws@4.0.0/node_modules/jws/index.js [app-rsc] (ecmascript)");
const util_1 = __turbopack_require__("[project]/node_modules/.pnpm/google-auth-library@9.15.0_encoding@0.1.13/node_modules/google-auth-library/build/src/util.js [app-rsc] (ecmascript)");
const DEFAULT_HEADER = {
    alg: 'RS256',
    typ: 'JWT'
};
class JWTAccess {
    /**
     * JWTAccess service account credentials.
     *
     * Create a new access token by using the credential to create a new JWT token
     * that's recognized as the access token.
     *
     * @param email the service account email address.
     * @param key the private key that will be used to sign the token.
     * @param keyId the ID of the private key used to sign the token.
     */ constructor(email, key, keyId, eagerRefreshThresholdMillis){
        this.cache = new util_1.LRUCache({
            capacity: 500,
            maxAge: 60 * 60 * 1000
        });
        this.email = email;
        this.key = key;
        this.keyId = keyId;
        this.eagerRefreshThresholdMillis = eagerRefreshThresholdMillis !== null && eagerRefreshThresholdMillis !== void 0 ? eagerRefreshThresholdMillis : 5 * 60 * 1000;
    }
    /**
     * Ensures that we're caching a key appropriately, giving precedence to scopes vs. url
     *
     * @param url The URI being authorized.
     * @param scopes The scope or scopes being authorized
     * @returns A string that returns the cached key.
     */ getCachedKey(url, scopes) {
        let cacheKey = url;
        if (scopes && Array.isArray(scopes) && scopes.length) {
            cacheKey = url ? `${url}_${scopes.join('_')}` : `${scopes.join('_')}`;
        } else if (typeof scopes === 'string') {
            cacheKey = url ? `${url}_${scopes}` : scopes;
        }
        if (!cacheKey) {
            throw Error('Scopes or url must be provided');
        }
        return cacheKey;
    }
    /**
     * Get a non-expired access token, after refreshing if necessary.
     *
     * @param url The URI being authorized.
     * @param additionalClaims An object with a set of additional claims to
     * include in the payload.
     * @returns An object that includes the authorization header.
     */ getRequestHeaders(url, additionalClaims, scopes) {
        // Return cached authorization headers, unless we are within
        // eagerRefreshThresholdMillis ms of them expiring:
        const key = this.getCachedKey(url, scopes);
        const cachedToken = this.cache.get(key);
        const now = Date.now();
        if (cachedToken && cachedToken.expiration - now > this.eagerRefreshThresholdMillis) {
            return cachedToken.headers;
        }
        const iat = Math.floor(Date.now() / 1000);
        const exp = JWTAccess.getExpirationTime(iat);
        let defaultClaims;
        // Turn scopes into space-separated string
        if (Array.isArray(scopes)) {
            scopes = scopes.join(' ');
        }
        // If scopes are specified, sign with scopes
        if (scopes) {
            defaultClaims = {
                iss: this.email,
                sub: this.email,
                scope: scopes,
                exp,
                iat
            };
        } else {
            defaultClaims = {
                iss: this.email,
                sub: this.email,
                aud: url,
                exp,
                iat
            };
        }
        // if additionalClaims are provided, ensure they do not collide with
        // other required claims.
        if (additionalClaims) {
            for(const claim in defaultClaims){
                if (additionalClaims[claim]) {
                    throw new Error(`The '${claim}' property is not allowed when passing additionalClaims. This claim is included in the JWT by default.`);
                }
            }
        }
        const header = this.keyId ? {
            ...DEFAULT_HEADER,
            kid: this.keyId
        } : DEFAULT_HEADER;
        const payload = Object.assign(defaultClaims, additionalClaims);
        // Sign the jwt and add it to the cache
        const signedJWT = jws.sign({
            header,
            payload,
            secret: this.key
        });
        const headers = {
            Authorization: `Bearer ${signedJWT}`
        };
        this.cache.set(key, {
            expiration: exp * 1000,
            headers
        });
        return headers;
    }
    /**
     * Returns an expiration time for the JWT token.
     *
     * @param iat The issued at time for the JWT.
     * @returns An expiration time for the JWT.
     */ static getExpirationTime(iat) {
        const exp = iat + 3600; // 3600 seconds = 1 hour
        return exp;
    }
    /**
     * Create a JWTAccess credentials instance using the given input options.
     * @param json The input object.
     */ fromJSON(json) {
        if (!json) {
            throw new Error('Must pass in a JSON object containing the service account auth settings.');
        }
        if (!json.client_email) {
            throw new Error('The incoming JSON object does not contain a client_email field');
        }
        if (!json.private_key) {
            throw new Error('The incoming JSON object does not contain a private_key field');
        }
        // Extract the relevant information from the json key file.
        this.email = json.client_email;
        this.key = json.private_key;
        this.keyId = json.private_key_id;
        this.projectId = json.project_id;
    }
    fromStream(inputStream, callback) {
        if (callback) {
            this.fromStreamAsync(inputStream).then(()=>callback(), callback);
        } else {
            return this.fromStreamAsync(inputStream);
        }
    }
    fromStreamAsync(inputStream) {
        return new Promise((resolve, reject)=>{
            if (!inputStream) {
                reject(new Error('Must pass in a stream containing the service account auth settings.'));
            }
            let s = '';
            inputStream.setEncoding('utf8').on('data', (chunk)=>s += chunk).on('error', reject).on('end', ()=>{
                try {
                    const data = JSON.parse(s);
                    this.fromJSON(data);
                    resolve();
                } catch (err) {
                    reject(err);
                }
            });
        });
    }
}
exports.JWTAccess = JWTAccess;
}}),
"[project]/node_modules/.pnpm/google-auth-library@9.15.0_encoding@0.1.13/node_modules/google-auth-library/build/src/auth/jwtclient.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
// Copyright 2013 Google LLC
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
Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.JWT = void 0;
const gtoken_1 = __turbopack_require__("[project]/node_modules/.pnpm/gtoken@7.1.0_encoding@0.1.13/node_modules/gtoken/build/src/index.js [app-rsc] (ecmascript)");
const jwtaccess_1 = __turbopack_require__("[project]/node_modules/.pnpm/google-auth-library@9.15.0_encoding@0.1.13/node_modules/google-auth-library/build/src/auth/jwtaccess.js [app-rsc] (ecmascript)");
const oauth2client_1 = __turbopack_require__("[project]/node_modules/.pnpm/google-auth-library@9.15.0_encoding@0.1.13/node_modules/google-auth-library/build/src/auth/oauth2client.js [app-rsc] (ecmascript)");
const authclient_1 = __turbopack_require__("[project]/node_modules/.pnpm/google-auth-library@9.15.0_encoding@0.1.13/node_modules/google-auth-library/build/src/auth/authclient.js [app-rsc] (ecmascript)");
class JWT extends oauth2client_1.OAuth2Client {
    constructor(optionsOrEmail, keyFile, key, scopes, subject, keyId){
        const opts = optionsOrEmail && typeof optionsOrEmail === 'object' ? optionsOrEmail : {
            email: optionsOrEmail,
            keyFile,
            key,
            keyId,
            scopes,
            subject
        };
        super(opts);
        this.email = opts.email;
        this.keyFile = opts.keyFile;
        this.key = opts.key;
        this.keyId = opts.keyId;
        this.scopes = opts.scopes;
        this.subject = opts.subject;
        this.additionalClaims = opts.additionalClaims;
        // Start with an expired refresh token, which will automatically be
        // refreshed before the first API call is made.
        this.credentials = {
            refresh_token: 'jwt-placeholder',
            expiry_date: 1
        };
    }
    /**
     * Creates a copy of the credential with the specified scopes.
     * @param scopes List of requested scopes or a single scope.
     * @return The cloned instance.
     */ createScoped(scopes) {
        const jwt = new JWT(this);
        jwt.scopes = scopes;
        return jwt;
    }
    /**
     * Obtains the metadata to be sent with the request.
     *
     * @param url the URI being authorized.
     */ async getRequestMetadataAsync(url) {
        url = this.defaultServicePath ? `https://${this.defaultServicePath}/` : url;
        const useSelfSignedJWT = !this.hasUserScopes() && url || this.useJWTAccessWithScope && this.hasAnyScopes() || this.universeDomain !== authclient_1.DEFAULT_UNIVERSE;
        if (this.subject && this.universeDomain !== authclient_1.DEFAULT_UNIVERSE) {
            throw new RangeError(`Service Account user is configured for the credential. Domain-wide delegation is not supported in universes other than ${authclient_1.DEFAULT_UNIVERSE}`);
        }
        if (!this.apiKey && useSelfSignedJWT) {
            if (this.additionalClaims && this.additionalClaims.target_audience) {
                const { tokens } = await this.refreshToken();
                return {
                    headers: this.addSharedMetadataHeaders({
                        Authorization: `Bearer ${tokens.id_token}`
                    })
                };
            } else {
                // no scopes have been set, but a uri has been provided. Use JWTAccess
                // credentials.
                if (!this.access) {
                    this.access = new jwtaccess_1.JWTAccess(this.email, this.key, this.keyId, this.eagerRefreshThresholdMillis);
                }
                let scopes;
                if (this.hasUserScopes()) {
                    scopes = this.scopes;
                } else if (!url) {
                    scopes = this.defaultScopes;
                }
                const useScopes = this.useJWTAccessWithScope || this.universeDomain !== authclient_1.DEFAULT_UNIVERSE;
                const headers = await this.access.getRequestHeaders(url !== null && url !== void 0 ? url : undefined, this.additionalClaims, // Scopes take precedent over audience for signing,
                // so we only provide them if `useJWTAccessWithScope` is on or
                // if we are in a non-default universe
                useScopes ? scopes : undefined);
                return {
                    headers: this.addSharedMetadataHeaders(headers)
                };
            }
        } else if (this.hasAnyScopes() || this.apiKey) {
            return super.getRequestMetadataAsync(url);
        } else {
            // If no audience, apiKey, or scopes are provided, we should not attempt
            // to populate any headers:
            return {
                headers: {}
            };
        }
    }
    /**
     * Fetches an ID token.
     * @param targetAudience the audience for the fetched ID token.
     */ async fetchIdToken(targetAudience) {
        // Create a new gToken for fetching an ID token
        const gtoken = new gtoken_1.GoogleToken({
            iss: this.email,
            sub: this.subject,
            scope: this.scopes || this.defaultScopes,
            keyFile: this.keyFile,
            key: this.key,
            additionalClaims: {
                target_audience: targetAudience
            },
            transporter: this.transporter
        });
        await gtoken.getToken({
            forceRefresh: true
        });
        if (!gtoken.idToken) {
            throw new Error('Unknown error: Failed to fetch ID token');
        }
        return gtoken.idToken;
    }
    /**
     * Determine if there are currently scopes available.
     */ hasUserScopes() {
        if (!this.scopes) {
            return false;
        }
        return this.scopes.length > 0;
    }
    /**
     * Are there any default or user scopes defined.
     */ hasAnyScopes() {
        if (this.scopes && this.scopes.length > 0) return true;
        if (this.defaultScopes && this.defaultScopes.length > 0) return true;
        return false;
    }
    authorize(callback) {
        if (callback) {
            this.authorizeAsync().then((r)=>callback(null, r), callback);
        } else {
            return this.authorizeAsync();
        }
    }
    async authorizeAsync() {
        const result = await this.refreshToken();
        if (!result) {
            throw new Error('No result returned');
        }
        this.credentials = result.tokens;
        this.credentials.refresh_token = 'jwt-placeholder';
        this.key = this.gtoken.key;
        this.email = this.gtoken.iss;
        return result.tokens;
    }
    /**
     * Refreshes the access token.
     * @param refreshToken ignored
     * @private
     */ async refreshTokenNoCache(// eslint-disable-next-line @typescript-eslint/no-unused-vars
    refreshToken) {
        const gtoken = this.createGToken();
        const token = await gtoken.getToken({
            forceRefresh: this.isTokenExpiring()
        });
        const tokens = {
            access_token: token.access_token,
            token_type: 'Bearer',
            expiry_date: gtoken.expiresAt,
            id_token: gtoken.idToken
        };
        this.emit('tokens', tokens);
        return {
            res: null,
            tokens
        };
    }
    /**
     * Create a gToken if it doesn't already exist.
     */ createGToken() {
        if (!this.gtoken) {
            this.gtoken = new gtoken_1.GoogleToken({
                iss: this.email,
                sub: this.subject,
                scope: this.scopes || this.defaultScopes,
                keyFile: this.keyFile,
                key: this.key,
                additionalClaims: this.additionalClaims,
                transporter: this.transporter
            });
        }
        return this.gtoken;
    }
    /**
     * Create a JWT credentials instance using the given input options.
     * @param json The input object.
     */ fromJSON(json) {
        if (!json) {
            throw new Error('Must pass in a JSON object containing the service account auth settings.');
        }
        if (!json.client_email) {
            throw new Error('The incoming JSON object does not contain a client_email field');
        }
        if (!json.private_key) {
            throw new Error('The incoming JSON object does not contain a private_key field');
        }
        // Extract the relevant information from the json key file.
        this.email = json.client_email;
        this.key = json.private_key;
        this.keyId = json.private_key_id;
        this.projectId = json.project_id;
        this.quotaProjectId = json.quota_project_id;
        this.universeDomain = json.universe_domain || this.universeDomain;
    }
    fromStream(inputStream, callback) {
        if (callback) {
            this.fromStreamAsync(inputStream).then(()=>callback(), callback);
        } else {
            return this.fromStreamAsync(inputStream);
        }
    }
    fromStreamAsync(inputStream) {
        return new Promise((resolve, reject)=>{
            if (!inputStream) {
                throw new Error('Must pass in a stream containing the service account auth settings.');
            }
            let s = '';
            inputStream.setEncoding('utf8').on('error', reject).on('data', (chunk)=>s += chunk).on('end', ()=>{
                try {
                    const data = JSON.parse(s);
                    this.fromJSON(data);
                    resolve();
                } catch (e) {
                    reject(e);
                }
            });
        });
    }
    /**
     * Creates a JWT credentials instance using an API Key for authentication.
     * @param apiKey The API Key in string form.
     */ fromAPIKey(apiKey) {
        if (typeof apiKey !== 'string') {
            throw new Error('Must provide an API Key string.');
        }
        this.apiKey = apiKey;
    }
    /**
     * Using the key or keyFile on the JWT client, obtain an object that contains
     * the key and the client email.
     */ async getCredentials() {
        if (this.key) {
            return {
                private_key: this.key,
                client_email: this.email
            };
        } else if (this.keyFile) {
            const gtoken = this.createGToken();
            const creds = await gtoken.getCredentials(this.keyFile);
            return {
                private_key: creds.privateKey,
                client_email: creds.clientEmail
            };
        }
        throw new Error('A key or a keyFile must be provided to getCredentials.');
    }
}
exports.JWT = JWT;
}}),
"[project]/node_modules/.pnpm/google-auth-library@9.15.0_encoding@0.1.13/node_modules/google-auth-library/build/src/auth/refreshclient.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
// Copyright 2015 Google LLC
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
Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.UserRefreshClient = exports.USER_REFRESH_ACCOUNT_TYPE = void 0;
const oauth2client_1 = __turbopack_require__("[project]/node_modules/.pnpm/google-auth-library@9.15.0_encoding@0.1.13/node_modules/google-auth-library/build/src/auth/oauth2client.js [app-rsc] (ecmascript)");
const querystring_1 = __turbopack_require__("[externals]/ [external] (querystring, cjs)");
exports.USER_REFRESH_ACCOUNT_TYPE = 'authorized_user';
class UserRefreshClient extends oauth2client_1.OAuth2Client {
    constructor(optionsOrClientId, clientSecret, refreshToken, eagerRefreshThresholdMillis, forceRefreshOnFailure){
        const opts = optionsOrClientId && typeof optionsOrClientId === 'object' ? optionsOrClientId : {
            clientId: optionsOrClientId,
            clientSecret,
            refreshToken,
            eagerRefreshThresholdMillis,
            forceRefreshOnFailure
        };
        super(opts);
        this._refreshToken = opts.refreshToken;
        this.credentials.refresh_token = opts.refreshToken;
    }
    /**
     * Refreshes the access token.
     * @param refreshToken An ignored refreshToken..
     * @param callback Optional callback.
     */ async refreshTokenNoCache(// eslint-disable-next-line @typescript-eslint/no-unused-vars
    refreshToken) {
        return super.refreshTokenNoCache(this._refreshToken);
    }
    async fetchIdToken(targetAudience) {
        const res = await this.transporter.request({
            ...UserRefreshClient.RETRY_CONFIG,
            url: this.endpoints.oauth2TokenUrl,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            method: 'POST',
            data: (0, querystring_1.stringify)({
                client_id: this._clientId,
                client_secret: this._clientSecret,
                grant_type: 'refresh_token',
                refresh_token: this._refreshToken,
                target_audience: targetAudience
            })
        });
        return res.data.id_token;
    }
    /**
     * Create a UserRefreshClient credentials instance using the given input
     * options.
     * @param json The input object.
     */ fromJSON(json) {
        if (!json) {
            throw new Error('Must pass in a JSON object containing the user refresh token');
        }
        if (json.type !== 'authorized_user') {
            throw new Error('The incoming JSON object does not have the "authorized_user" type');
        }
        if (!json.client_id) {
            throw new Error('The incoming JSON object does not contain a client_id field');
        }
        if (!json.client_secret) {
            throw new Error('The incoming JSON object does not contain a client_secret field');
        }
        if (!json.refresh_token) {
            throw new Error('The incoming JSON object does not contain a refresh_token field');
        }
        this._clientId = json.client_id;
        this._clientSecret = json.client_secret;
        this._refreshToken = json.refresh_token;
        this.credentials.refresh_token = json.refresh_token;
        this.quotaProjectId = json.quota_project_id;
        this.universeDomain = json.universe_domain || this.universeDomain;
    }
    fromStream(inputStream, callback) {
        if (callback) {
            this.fromStreamAsync(inputStream).then(()=>callback(), callback);
        } else {
            return this.fromStreamAsync(inputStream);
        }
    }
    async fromStreamAsync(inputStream) {
        return new Promise((resolve, reject)=>{
            if (!inputStream) {
                return reject(new Error('Must pass in a stream containing the user refresh token.'));
            }
            let s = '';
            inputStream.setEncoding('utf8').on('error', reject).on('data', (chunk)=>s += chunk).on('end', ()=>{
                try {
                    const data = JSON.parse(s);
                    this.fromJSON(data);
                    return resolve();
                } catch (err) {
                    return reject(err);
                }
            });
        });
    }
    /**
     * Create a UserRefreshClient credentials instance using the given input
     * options.
     * @param json The input object.
     */ static fromJSON(json) {
        const client = new UserRefreshClient();
        client.fromJSON(json);
        return client;
    }
}
exports.UserRefreshClient = UserRefreshClient;
}}),
"[project]/node_modules/.pnpm/google-auth-library@9.15.0_encoding@0.1.13/node_modules/google-auth-library/build/src/auth/impersonated.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
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
 */ Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.Impersonated = exports.IMPERSONATED_ACCOUNT_TYPE = void 0;
const oauth2client_1 = __turbopack_require__("[project]/node_modules/.pnpm/google-auth-library@9.15.0_encoding@0.1.13/node_modules/google-auth-library/build/src/auth/oauth2client.js [app-rsc] (ecmascript)");
const gaxios_1 = __turbopack_require__("[project]/node_modules/.pnpm/gaxios@6.7.1_encoding@0.1.13/node_modules/gaxios/build/src/index.js [app-rsc] (ecmascript)");
const util_1 = __turbopack_require__("[project]/node_modules/.pnpm/google-auth-library@9.15.0_encoding@0.1.13/node_modules/google-auth-library/build/src/util.js [app-rsc] (ecmascript)");
exports.IMPERSONATED_ACCOUNT_TYPE = 'impersonated_service_account';
class Impersonated extends oauth2client_1.OAuth2Client {
    /**
     * Impersonated service account credentials.
     *
     * Create a new access token by impersonating another service account.
     *
     * Impersonated Credentials allowing credentials issued to a user or
     * service account to impersonate another. The source project using
     * Impersonated Credentials must enable the "IAMCredentials" API.
     * Also, the target service account must grant the orginating principal
     * the "Service Account Token Creator" IAM role.
     *
     * @param {object} options - The configuration object.
     * @param {object} [options.sourceClient] the source credential used as to
     * acquire the impersonated credentials.
     * @param {string} [options.targetPrincipal] the service account to
     * impersonate.
     * @param {string[]} [options.delegates] the chained list of delegates
     * required to grant the final access_token. If set, the sequence of
     * identities must have "Service Account Token Creator" capability granted to
     * the preceding identity. For example, if set to [serviceAccountB,
     * serviceAccountC], the sourceCredential must have the Token Creator role on
     * serviceAccountB. serviceAccountB must have the Token Creator on
     * serviceAccountC. Finally, C must have Token Creator on target_principal.
     * If left unset, sourceCredential must have that role on targetPrincipal.
     * @param {string[]} [options.targetScopes] scopes to request during the
     * authorization grant.
     * @param {number} [options.lifetime] number of seconds the delegated
     * credential should be valid for up to 3600 seconds by default, or 43,200
     * seconds by extending the token's lifetime, see:
     * https://cloud.google.com/iam/docs/creating-short-lived-service-account-credentials#sa-credentials-oauth
     * @param {string} [options.endpoint] api endpoint override.
     */ constructor(options = {}){
        var _a, _b, _c, _d, _e, _f;
        super(options);
        // Start with an expired refresh token, which will automatically be
        // refreshed before the first API call is made.
        this.credentials = {
            expiry_date: 1,
            refresh_token: 'impersonated-placeholder'
        };
        this.sourceClient = (_a = options.sourceClient) !== null && _a !== void 0 ? _a : new oauth2client_1.OAuth2Client();
        this.targetPrincipal = (_b = options.targetPrincipal) !== null && _b !== void 0 ? _b : '';
        this.delegates = (_c = options.delegates) !== null && _c !== void 0 ? _c : [];
        this.targetScopes = (_d = options.targetScopes) !== null && _d !== void 0 ? _d : [];
        this.lifetime = (_e = options.lifetime) !== null && _e !== void 0 ? _e : 3600;
        const usingExplicitUniverseDomain = !!(0, util_1.originalOrCamelOptions)(options).get('universe_domain');
        if (!usingExplicitUniverseDomain) {
            // override the default universe with the source's universe
            this.universeDomain = this.sourceClient.universeDomain;
        } else if (this.sourceClient.universeDomain !== this.universeDomain) {
            // non-default universe and is not matching the source - this could be a credential leak
            throw new RangeError(`Universe domain ${this.sourceClient.universeDomain} in source credentials does not match ${this.universeDomain} universe domain set for impersonated credentials.`);
        }
        this.endpoint = (_f = options.endpoint) !== null && _f !== void 0 ? _f : `https://iamcredentials.${this.universeDomain}`;
    }
    /**
     * Signs some bytes.
     *
     * {@link https://cloud.google.com/iam/docs/reference/credentials/rest/v1/projects.serviceAccounts/signBlob Reference Documentation}
     * @param blobToSign String to sign.
     *
     * @returns A {@link SignBlobResponse} denoting the keyID and signedBlob in base64 string
     */ async sign(blobToSign) {
        await this.sourceClient.getAccessToken();
        const name = `projects/-/serviceAccounts/${this.targetPrincipal}`;
        const u = `${this.endpoint}/v1/${name}:signBlob`;
        const body = {
            delegates: this.delegates,
            payload: Buffer.from(blobToSign).toString('base64')
        };
        const res = await this.sourceClient.request({
            ...Impersonated.RETRY_CONFIG,
            url: u,
            data: body,
            method: 'POST'
        });
        return res.data;
    }
    /** The service account email to be impersonated. */ getTargetPrincipal() {
        return this.targetPrincipal;
    }
    /**
     * Refreshes the access token.
     */ async refreshToken() {
        var _a, _b, _c, _d, _e, _f;
        try {
            await this.sourceClient.getAccessToken();
            const name = 'projects/-/serviceAccounts/' + this.targetPrincipal;
            const u = `${this.endpoint}/v1/${name}:generateAccessToken`;
            const body = {
                delegates: this.delegates,
                scope: this.targetScopes,
                lifetime: this.lifetime + 's'
            };
            const res = await this.sourceClient.request({
                ...Impersonated.RETRY_CONFIG,
                url: u,
                data: body,
                method: 'POST'
            });
            const tokenResponse = res.data;
            this.credentials.access_token = tokenResponse.accessToken;
            this.credentials.expiry_date = Date.parse(tokenResponse.expireTime);
            return {
                tokens: this.credentials,
                res
            };
        } catch (error) {
            if (!(error instanceof Error)) throw error;
            let status = 0;
            let message = '';
            if (error instanceof gaxios_1.GaxiosError) {
                status = (_c = (_b = (_a = error === null || error === void 0 ? void 0 : error.response) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.error) === null || _c === void 0 ? void 0 : _c.status;
                message = (_f = (_e = (_d = error === null || error === void 0 ? void 0 : error.response) === null || _d === void 0 ? void 0 : _d.data) === null || _e === void 0 ? void 0 : _e.error) === null || _f === void 0 ? void 0 : _f.message;
            }
            if (status && message) {
                error.message = `${status}: unable to impersonate: ${message}`;
                throw error;
            } else {
                error.message = `unable to impersonate: ${error}`;
                throw error;
            }
        }
    }
    /**
     * Generates an OpenID Connect ID token for a service account.
     *
     * {@link https://cloud.google.com/iam/docs/reference/credentials/rest/v1/projects.serviceAccounts/generateIdToken Reference Documentation}
     *
     * @param targetAudience the audience for the fetched ID token.
     * @param options the for the request
     * @return an OpenID Connect ID token
     */ async fetchIdToken(targetAudience, options) {
        var _a, _b;
        await this.sourceClient.getAccessToken();
        const name = `projects/-/serviceAccounts/${this.targetPrincipal}`;
        const u = `${this.endpoint}/v1/${name}:generateIdToken`;
        const body = {
            delegates: this.delegates,
            audience: targetAudience,
            includeEmail: (_a = options === null || options === void 0 ? void 0 : options.includeEmail) !== null && _a !== void 0 ? _a : true,
            useEmailAzp: (_b = options === null || options === void 0 ? void 0 : options.includeEmail) !== null && _b !== void 0 ? _b : true
        };
        const res = await this.sourceClient.request({
            ...Impersonated.RETRY_CONFIG,
            url: u,
            data: body,
            method: 'POST'
        });
        return res.data.token;
    }
}
exports.Impersonated = Impersonated;
}}),
"[project]/node_modules/.pnpm/google-auth-library@9.15.0_encoding@0.1.13/node_modules/google-auth-library/build/src/auth/oauth2common.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
// Copyright 2021 Google LLC
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
Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.OAuthClientAuthHandler = void 0;
exports.getErrorFromOAuthErrorResponse = getErrorFromOAuthErrorResponse;
const querystring = __turbopack_require__("[externals]/ [external] (querystring, cjs)");
const crypto_1 = __turbopack_require__("[project]/node_modules/.pnpm/google-auth-library@9.15.0_encoding@0.1.13/node_modules/google-auth-library/build/src/crypto/crypto.js [app-rsc] (ecmascript)");
/** List of HTTP methods that accept request bodies. */ const METHODS_SUPPORTING_REQUEST_BODY = [
    'PUT',
    'POST',
    'PATCH'
];
/**
 * Abstract class for handling client authentication in OAuth-based
 * operations.
 * When request-body client authentication is used, only application/json and
 * application/x-www-form-urlencoded content types for HTTP methods that support
 * request bodies are supported.
 */ class OAuthClientAuthHandler {
    /**
     * Instantiates an OAuth client authentication handler.
     * @param clientAuthentication The client auth credentials.
     */ constructor(clientAuthentication){
        this.clientAuthentication = clientAuthentication;
        this.crypto = (0, crypto_1.createCrypto)();
    }
    /**
     * Applies client authentication on the OAuth request's headers or POST
     * body but does not process the request.
     * @param opts The GaxiosOptions whose headers or data are to be modified
     *   depending on the client authentication mechanism to be used.
     * @param bearerToken The optional bearer token to use for authentication.
     *   When this is used, no client authentication credentials are needed.
     */ applyClientAuthenticationOptions(opts, bearerToken) {
        // Inject authenticated header.
        this.injectAuthenticatedHeaders(opts, bearerToken);
        // Inject authenticated request body.
        if (!bearerToken) {
            this.injectAuthenticatedRequestBody(opts);
        }
    }
    /**
     * Applies client authentication on the request's header if either
     * basic authentication or bearer token authentication is selected.
     *
     * @param opts The GaxiosOptions whose headers or data are to be modified
     *   depending on the client authentication mechanism to be used.
     * @param bearerToken The optional bearer token to use for authentication.
     *   When this is used, no client authentication credentials are needed.
     */ injectAuthenticatedHeaders(opts, bearerToken) {
        var _a;
        // Bearer token prioritized higher than basic Auth.
        if (bearerToken) {
            opts.headers = opts.headers || {};
            Object.assign(opts.headers, {
                Authorization: `Bearer ${bearerToken}}`
            });
        } else if (((_a = this.clientAuthentication) === null || _a === void 0 ? void 0 : _a.confidentialClientType) === 'basic') {
            opts.headers = opts.headers || {};
            const clientId = this.clientAuthentication.clientId;
            const clientSecret = this.clientAuthentication.clientSecret || '';
            const base64EncodedCreds = this.crypto.encodeBase64StringUtf8(`${clientId}:${clientSecret}`);
            Object.assign(opts.headers, {
                Authorization: `Basic ${base64EncodedCreds}`
            });
        }
    }
    /**
     * Applies client authentication on the request's body if request-body
     * client authentication is selected.
     *
     * @param opts The GaxiosOptions whose headers or data are to be modified
     *   depending on the client authentication mechanism to be used.
     */ injectAuthenticatedRequestBody(opts) {
        var _a;
        if (((_a = this.clientAuthentication) === null || _a === void 0 ? void 0 : _a.confidentialClientType) === 'request-body') {
            const method = (opts.method || 'GET').toUpperCase();
            // Inject authenticated request body.
            if (METHODS_SUPPORTING_REQUEST_BODY.indexOf(method) !== -1) {
                // Get content-type.
                let contentType;
                const headers = opts.headers || {};
                for(const key in headers){
                    if (key.toLowerCase() === 'content-type' && headers[key]) {
                        contentType = headers[key].toLowerCase();
                        break;
                    }
                }
                if (contentType === 'application/x-www-form-urlencoded') {
                    opts.data = opts.data || '';
                    const data = querystring.parse(opts.data);
                    Object.assign(data, {
                        client_id: this.clientAuthentication.clientId,
                        client_secret: this.clientAuthentication.clientSecret || ''
                    });
                    opts.data = querystring.stringify(data);
                } else if (contentType === 'application/json') {
                    opts.data = opts.data || {};
                    Object.assign(opts.data, {
                        client_id: this.clientAuthentication.clientId,
                        client_secret: this.clientAuthentication.clientSecret || ''
                    });
                } else {
                    throw new Error(`${contentType} content-types are not supported with ` + `${this.clientAuthentication.confidentialClientType} ` + 'client authentication');
                }
            } else {
                throw new Error(`${method} HTTP method does not support ` + `${this.clientAuthentication.confidentialClientType} ` + 'client authentication');
            }
        }
    }
    /**
     * Retry config for Auth-related requests.
     *
     * @remarks
     *
     * This is not a part of the default {@link AuthClient.transporter transporter/gaxios}
     * config as some downstream APIs would prefer if customers explicitly enable retries,
     * such as GCS.
     */ static get RETRY_CONFIG() {
        return {
            retry: true,
            retryConfig: {
                httpMethodsToRetry: [
                    'GET',
                    'PUT',
                    'POST',
                    'HEAD',
                    'OPTIONS',
                    'DELETE'
                ]
            }
        };
    }
}
exports.OAuthClientAuthHandler = OAuthClientAuthHandler;
/**
 * Converts an OAuth error response to a native JavaScript Error.
 * @param resp The OAuth error response to convert to a native Error object.
 * @param err The optional original error. If provided, the error properties
 *   will be copied to the new error.
 * @return The converted native Error object.
 */ function getErrorFromOAuthErrorResponse(resp, err) {
    // Error response.
    const errorCode = resp.error;
    const errorDescription = resp.error_description;
    const errorUri = resp.error_uri;
    let message = `Error code ${errorCode}`;
    if (typeof errorDescription !== 'undefined') {
        message += `: ${errorDescription}`;
    }
    if (typeof errorUri !== 'undefined') {
        message += ` - ${errorUri}`;
    }
    const newError = new Error(message);
    // Copy properties from original error to newly generated error.
    if (err) {
        const keys = Object.keys(err);
        if (err.stack) {
            // Copy error.stack if available.
            keys.push('stack');
        }
        keys.forEach((key)=>{
            // Do not overwrite the message field.
            if (key !== 'message') {
                Object.defineProperty(newError, key, {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    value: err[key],
                    writable: false,
                    enumerable: true
                });
            }
        });
    }
    return newError;
}
}}),
"[project]/node_modules/.pnpm/google-auth-library@9.15.0_encoding@0.1.13/node_modules/google-auth-library/build/src/auth/stscredentials.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
// Copyright 2021 Google LLC
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
Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.StsCredentials = void 0;
const gaxios_1 = __turbopack_require__("[project]/node_modules/.pnpm/gaxios@6.7.1_encoding@0.1.13/node_modules/gaxios/build/src/index.js [app-rsc] (ecmascript)");
const querystring = __turbopack_require__("[externals]/ [external] (querystring, cjs)");
const transporters_1 = __turbopack_require__("[project]/node_modules/.pnpm/google-auth-library@9.15.0_encoding@0.1.13/node_modules/google-auth-library/build/src/transporters.js [app-rsc] (ecmascript)");
const oauth2common_1 = __turbopack_require__("[project]/node_modules/.pnpm/google-auth-library@9.15.0_encoding@0.1.13/node_modules/google-auth-library/build/src/auth/oauth2common.js [app-rsc] (ecmascript)");
/**
 * Implements the OAuth 2.0 token exchange based on
 * https://tools.ietf.org/html/rfc8693
 */ class StsCredentials extends oauth2common_1.OAuthClientAuthHandler {
    /**
     * Initializes an STS credentials instance.
     * @param tokenExchangeEndpoint The token exchange endpoint.
     * @param clientAuthentication The client authentication credentials if
     *   available.
     */ constructor(tokenExchangeEndpoint, clientAuthentication){
        super(clientAuthentication);
        this.tokenExchangeEndpoint = tokenExchangeEndpoint;
        this.transporter = new transporters_1.DefaultTransporter();
    }
    /**
     * Exchanges the provided token for another type of token based on the
     * rfc8693 spec.
     * @param stsCredentialsOptions The token exchange options used to populate
     *   the token exchange request.
     * @param additionalHeaders Optional additional headers to pass along the
     *   request.
     * @param options Optional additional GCP-specific non-spec defined options
     *   to send with the request.
     *   Example: `&options=${encodeUriComponent(JSON.stringified(options))}`
     * @return A promise that resolves with the token exchange response containing
     *   the requested token and its expiration time.
     */ async exchangeToken(stsCredentialsOptions, additionalHeaders, // eslint-disable-next-line @typescript-eslint/no-explicit-any
    options) {
        var _a, _b, _c;
        const values = {
            grant_type: stsCredentialsOptions.grantType,
            resource: stsCredentialsOptions.resource,
            audience: stsCredentialsOptions.audience,
            scope: (_a = stsCredentialsOptions.scope) === null || _a === void 0 ? void 0 : _a.join(' '),
            requested_token_type: stsCredentialsOptions.requestedTokenType,
            subject_token: stsCredentialsOptions.subjectToken,
            subject_token_type: stsCredentialsOptions.subjectTokenType,
            actor_token: (_b = stsCredentialsOptions.actingParty) === null || _b === void 0 ? void 0 : _b.actorToken,
            actor_token_type: (_c = stsCredentialsOptions.actingParty) === null || _c === void 0 ? void 0 : _c.actorTokenType,
            // Non-standard GCP-specific options.
            options: options && JSON.stringify(options)
        };
        // Remove undefined fields.
        Object.keys(values).forEach((key)=>{
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            if (typeof values[key] === 'undefined') {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                delete values[key];
            }
        });
        const headers = {
            'Content-Type': 'application/x-www-form-urlencoded'
        };
        // Inject additional STS headers if available.
        Object.assign(headers, additionalHeaders || {});
        const opts = {
            ...StsCredentials.RETRY_CONFIG,
            url: this.tokenExchangeEndpoint.toString(),
            method: 'POST',
            headers,
            data: querystring.stringify(values),
            responseType: 'json'
        };
        // Apply OAuth client authentication.
        this.applyClientAuthenticationOptions(opts);
        try {
            const response = await this.transporter.request(opts);
            // Successful response.
            const stsSuccessfulResponse = response.data;
            stsSuccessfulResponse.res = response;
            return stsSuccessfulResponse;
        } catch (error) {
            // Translate error to OAuthError.
            if (error instanceof gaxios_1.GaxiosError && error.response) {
                throw (0, oauth2common_1.getErrorFromOAuthErrorResponse)(error.response.data, // Preserve other fields from the original error.
                error);
            }
            // Request could fail before the server responds.
            throw error;
        }
    }
}
exports.StsCredentials = StsCredentials;
}}),
"[project]/node_modules/.pnpm/google-auth-library@9.15.0_encoding@0.1.13/node_modules/google-auth-library/build/src/auth/baseexternalclient.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
// Copyright 2021 Google LLC
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
var __classPrivateFieldGet = this && this.__classPrivateFieldGet || function(receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var __classPrivateFieldSet = this && this.__classPrivateFieldSet || function(receiver, state, value, kind, f) {
    if (kind === "m") throw new TypeError("Private method is not writable");
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
    return kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value), value;
};
var _BaseExternalAccountClient_instances, _BaseExternalAccountClient_pendingAccessToken, _BaseExternalAccountClient_internalRefreshAccessTokenAsync;
Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.BaseExternalAccountClient = exports.DEFAULT_UNIVERSE = exports.CLOUD_RESOURCE_MANAGER = exports.EXTERNAL_ACCOUNT_TYPE = exports.EXPIRATION_TIME_OFFSET = void 0;
const stream = __turbopack_require__("[externals]/ [external] (stream, cjs)");
const authclient_1 = __turbopack_require__("[project]/node_modules/.pnpm/google-auth-library@9.15.0_encoding@0.1.13/node_modules/google-auth-library/build/src/auth/authclient.js [app-rsc] (ecmascript)");
const sts = __turbopack_require__("[project]/node_modules/.pnpm/google-auth-library@9.15.0_encoding@0.1.13/node_modules/google-auth-library/build/src/auth/stscredentials.js [app-rsc] (ecmascript)");
const util_1 = __turbopack_require__("[project]/node_modules/.pnpm/google-auth-library@9.15.0_encoding@0.1.13/node_modules/google-auth-library/build/src/util.js [app-rsc] (ecmascript)");
/**
 * The required token exchange grant_type: rfc8693#section-2.1
 */ const STS_GRANT_TYPE = 'urn:ietf:params:oauth:grant-type:token-exchange';
/**
 * The requested token exchange requested_token_type: rfc8693#section-2.1
 */ const STS_REQUEST_TOKEN_TYPE = 'urn:ietf:params:oauth:token-type:access_token';
/** The default OAuth scope to request when none is provided. */ const DEFAULT_OAUTH_SCOPE = 'https://www.googleapis.com/auth/cloud-platform';
/** Default impersonated token lifespan in seconds.*/ const DEFAULT_TOKEN_LIFESPAN = 3600;
/**
 * Offset to take into account network delays and server clock skews.
 */ exports.EXPIRATION_TIME_OFFSET = 5 * 60 * 1000;
/**
 * The credentials JSON file type for external account clients.
 * There are 3 types of JSON configs:
 * 1. authorized_user => Google end user credential
 * 2. service_account => Google service account credential
 * 3. external_Account => non-GCP service (eg. AWS, Azure, K8s)
 */ exports.EXTERNAL_ACCOUNT_TYPE = 'external_account';
/**
 * Cloud resource manager URL used to retrieve project information.
 *
 * @deprecated use {@link BaseExternalAccountClient.cloudResourceManagerURL} instead
 **/ exports.CLOUD_RESOURCE_MANAGER = 'https://cloudresourcemanager.googleapis.com/v1/projects/';
/** The workforce audience pattern. */ const WORKFORCE_AUDIENCE_PATTERN = '//iam\\.googleapis\\.com/locations/[^/]+/workforcePools/[^/]+/providers/.+';
const DEFAULT_TOKEN_URL = 'https://sts.{universeDomain}/v1/token';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pkg = __turbopack_require__("[project]/node_modules/.pnpm/google-auth-library@9.15.0_encoding@0.1.13/node_modules/google-auth-library/package.json (json)");
/**
 * For backwards compatibility.
 */ var authclient_2 = __turbopack_require__("[project]/node_modules/.pnpm/google-auth-library@9.15.0_encoding@0.1.13/node_modules/google-auth-library/build/src/auth/authclient.js [app-rsc] (ecmascript)");
Object.defineProperty(exports, "DEFAULT_UNIVERSE", {
    enumerable: true,
    get: function() {
        return authclient_2.DEFAULT_UNIVERSE;
    }
});
/**
 * Base external account client. This is used to instantiate AuthClients for
 * exchanging external account credentials for GCP access token and authorizing
 * requests to GCP APIs.
 * The base class implements common logic for exchanging various type of
 * external credentials for GCP access token. The logic of determining and
 * retrieving the external credential based on the environment and
 * credential_source will be left for the subclasses.
 */ class BaseExternalAccountClient extends authclient_1.AuthClient {
    /**
     * Instantiate a BaseExternalAccountClient instance using the provided JSON
     * object loaded from an external account credentials file.
     * @param options The external account options object typically loaded
     *   from the external account JSON credential file. The camelCased options
     *   are aliases for the snake_cased options.
     * @param additionalOptions **DEPRECATED, all options are available in the
     *   `options` parameter.** Optional additional behavior customization options.
     *   These currently customize expiration threshold time and whether to retry
     *   on 401/403 API request errors.
     */ constructor(options, additionalOptions){
        var _a;
        super({
            ...options,
            ...additionalOptions
        });
        _BaseExternalAccountClient_instances.add(this);
        /**
         * A pending access token request. Used for concurrent calls.
         */ _BaseExternalAccountClient_pendingAccessToken.set(this, null);
        const opts = (0, util_1.originalOrCamelOptions)(options);
        const type = opts.get('type');
        if (type && type !== exports.EXTERNAL_ACCOUNT_TYPE) {
            throw new Error(`Expected "${exports.EXTERNAL_ACCOUNT_TYPE}" type but ` + `received "${options.type}"`);
        }
        const clientId = opts.get('client_id');
        const clientSecret = opts.get('client_secret');
        const tokenUrl = (_a = opts.get('token_url')) !== null && _a !== void 0 ? _a : DEFAULT_TOKEN_URL.replace('{universeDomain}', this.universeDomain);
        const subjectTokenType = opts.get('subject_token_type');
        const workforcePoolUserProject = opts.get('workforce_pool_user_project');
        const serviceAccountImpersonationUrl = opts.get('service_account_impersonation_url');
        const serviceAccountImpersonation = opts.get('service_account_impersonation');
        const serviceAccountImpersonationLifetime = (0, util_1.originalOrCamelOptions)(serviceAccountImpersonation).get('token_lifetime_seconds');
        this.cloudResourceManagerURL = new URL(opts.get('cloud_resource_manager_url') || `https://cloudresourcemanager.${this.universeDomain}/v1/projects/`);
        if (clientId) {
            this.clientAuth = {
                confidentialClientType: 'basic',
                clientId,
                clientSecret
            };
        }
        this.stsCredential = new sts.StsCredentials(tokenUrl, this.clientAuth);
        this.scopes = opts.get('scopes') || [
            DEFAULT_OAUTH_SCOPE
        ];
        this.cachedAccessToken = null;
        this.audience = opts.get('audience');
        this.subjectTokenType = subjectTokenType;
        this.workforcePoolUserProject = workforcePoolUserProject;
        const workforceAudiencePattern = new RegExp(WORKFORCE_AUDIENCE_PATTERN);
        if (this.workforcePoolUserProject && !this.audience.match(workforceAudiencePattern)) {
            throw new Error('workforcePoolUserProject should not be set for non-workforce pool ' + 'credentials.');
        }
        this.serviceAccountImpersonationUrl = serviceAccountImpersonationUrl;
        this.serviceAccountImpersonationLifetime = serviceAccountImpersonationLifetime;
        if (this.serviceAccountImpersonationLifetime) {
            this.configLifetimeRequested = true;
        } else {
            this.configLifetimeRequested = false;
            this.serviceAccountImpersonationLifetime = DEFAULT_TOKEN_LIFESPAN;
        }
        this.projectNumber = this.getProjectNumber(this.audience);
        this.supplierContext = {
            audience: this.audience,
            subjectTokenType: this.subjectTokenType,
            transporter: this.transporter
        };
    }
    /** The service account email to be impersonated, if available. */ getServiceAccountEmail() {
        var _a;
        if (this.serviceAccountImpersonationUrl) {
            if (this.serviceAccountImpersonationUrl.length > 256) {
                /**
                 * Prevents DOS attacks.
                 * @see {@link https://github.com/googleapis/google-auth-library-nodejs/security/code-scanning/84}
                 **/ throw new RangeError(`URL is too long: ${this.serviceAccountImpersonationUrl}`);
            }
            // Parse email from URL. The formal looks as follows:
            // https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/name@project-id.iam.gserviceaccount.com:generateAccessToken
            const re = /serviceAccounts\/(?<email>[^:]+):generateAccessToken$/;
            const result = re.exec(this.serviceAccountImpersonationUrl);
            return ((_a = result === null || result === void 0 ? void 0 : result.groups) === null || _a === void 0 ? void 0 : _a.email) || null;
        }
        return null;
    }
    /**
     * Provides a mechanism to inject GCP access tokens directly.
     * When the provided credential expires, a new credential, using the
     * external account options, is retrieved.
     * @param credentials The Credentials object to set on the current client.
     */ setCredentials(credentials) {
        super.setCredentials(credentials);
        this.cachedAccessToken = credentials;
    }
    /**
     * @return A promise that resolves with the current GCP access token
     *   response. If the current credential is expired, a new one is retrieved.
     */ async getAccessToken() {
        // If cached access token is unavailable or expired, force refresh.
        if (!this.cachedAccessToken || this.isExpired(this.cachedAccessToken)) {
            await this.refreshAccessTokenAsync();
        }
        // Return GCP access token in GetAccessTokenResponse format.
        return {
            token: this.cachedAccessToken.access_token,
            res: this.cachedAccessToken.res
        };
    }
    /**
     * The main authentication interface. It takes an optional url which when
     * present is the endpoint being accessed, and returns a Promise which
     * resolves with authorization header fields.
     *
     * The result has the form:
     * { Authorization: 'Bearer <access_token_value>' }
     */ async getRequestHeaders() {
        const accessTokenResponse = await this.getAccessToken();
        const headers = {
            Authorization: `Bearer ${accessTokenResponse.token}`
        };
        return this.addSharedMetadataHeaders(headers);
    }
    request(opts, callback) {
        if (callback) {
            this.requestAsync(opts).then((r)=>callback(null, r), (e)=>{
                return callback(e, e.response);
            });
        } else {
            return this.requestAsync(opts);
        }
    }
    /**
     * @return A promise that resolves with the project ID corresponding to the
     *   current workload identity pool or current workforce pool if
     *   determinable. For workforce pool credential, it returns the project ID
     *   corresponding to the workforcePoolUserProject.
     *   This is introduced to match the current pattern of using the Auth
     *   library:
     *   const projectId = await auth.getProjectId();
     *   const url = `https://dns.googleapis.com/dns/v1/projects/${projectId}`;
     *   const res = await client.request({ url });
     *   The resource may not have permission
     *   (resourcemanager.projects.get) to call this API or the required
     *   scopes may not be selected:
     *   https://cloud.google.com/resource-manager/reference/rest/v1/projects/get#authorization-scopes
     */ async getProjectId() {
        const projectNumber = this.projectNumber || this.workforcePoolUserProject;
        if (this.projectId) {
            // Return previously determined project ID.
            return this.projectId;
        } else if (projectNumber) {
            // Preferable not to use request() to avoid retrial policies.
            const headers = await this.getRequestHeaders();
            const response = await this.transporter.request({
                ...BaseExternalAccountClient.RETRY_CONFIG,
                headers,
                url: `${this.cloudResourceManagerURL.toString()}${projectNumber}`,
                responseType: 'json'
            });
            this.projectId = response.data.projectId;
            return this.projectId;
        }
        return null;
    }
    /**
     * Authenticates the provided HTTP request, processes it and resolves with the
     * returned response.
     * @param opts The HTTP request options.
     * @param reAuthRetried Whether the current attempt is a retry after a failed attempt due to an auth failure.
     * @return A promise that resolves with the successful response.
     */ async requestAsync(opts, reAuthRetried = false) {
        let response;
        try {
            const requestHeaders = await this.getRequestHeaders();
            opts.headers = opts.headers || {};
            if (requestHeaders && requestHeaders['x-goog-user-project']) {
                opts.headers['x-goog-user-project'] = requestHeaders['x-goog-user-project'];
            }
            if (requestHeaders && requestHeaders.Authorization) {
                opts.headers.Authorization = requestHeaders.Authorization;
            }
            response = await this.transporter.request(opts);
        } catch (e) {
            const res = e.response;
            if (res) {
                const statusCode = res.status;
                // Retry the request for metadata if the following criteria are true:
                // - We haven't already retried.  It only makes sense to retry once.
                // - The response was a 401 or a 403
                // - The request didn't send a readableStream
                // - forceRefreshOnFailure is true
                const isReadableStream = res.config.data instanceof stream.Readable;
                const isAuthErr = statusCode === 401 || statusCode === 403;
                if (!reAuthRetried && isAuthErr && !isReadableStream && this.forceRefreshOnFailure) {
                    await this.refreshAccessTokenAsync();
                    return await this.requestAsync(opts, true);
                }
            }
            throw e;
        }
        return response;
    }
    /**
     * Forces token refresh, even if unexpired tokens are currently cached.
     * External credentials are exchanged for GCP access tokens via the token
     * exchange endpoint and other settings provided in the client options
     * object.
     * If the service_account_impersonation_url is provided, an additional
     * step to exchange the external account GCP access token for a service
     * account impersonated token is performed.
     * @return A promise that resolves with the fresh GCP access tokens.
     */ async refreshAccessTokenAsync() {
        // Use an existing access token request, or cache a new one
        __classPrivateFieldSet(this, _BaseExternalAccountClient_pendingAccessToken, __classPrivateFieldGet(this, _BaseExternalAccountClient_pendingAccessToken, "f") || __classPrivateFieldGet(this, _BaseExternalAccountClient_instances, "m", _BaseExternalAccountClient_internalRefreshAccessTokenAsync).call(this), "f");
        try {
            return await __classPrivateFieldGet(this, _BaseExternalAccountClient_pendingAccessToken, "f");
        } finally{
            // clear pending access token for future requests
            __classPrivateFieldSet(this, _BaseExternalAccountClient_pendingAccessToken, null, "f");
        }
    }
    /**
     * Returns the workload identity pool project number if it is determinable
     * from the audience resource name.
     * @param audience The STS audience used to determine the project number.
     * @return The project number associated with the workload identity pool, if
     *   this can be determined from the STS audience field. Otherwise, null is
     *   returned.
     */ getProjectNumber(audience) {
        // STS audience pattern:
        // //iam.googleapis.com/projects/$PROJECT_NUMBER/locations/...
        const match = audience.match(/\/projects\/([^/]+)/);
        if (!match) {
            return null;
        }
        return match[1];
    }
    /**
     * Exchanges an external account GCP access token for a service
     * account impersonated access token using iamcredentials
     * GenerateAccessToken API.
     * @param token The access token to exchange for a service account access
     *   token.
     * @return A promise that resolves with the service account impersonated
     *   credentials response.
     */ async getImpersonatedAccessToken(token) {
        const opts = {
            ...BaseExternalAccountClient.RETRY_CONFIG,
            url: this.serviceAccountImpersonationUrl,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`
            },
            data: {
                scope: this.getScopesArray(),
                lifetime: this.serviceAccountImpersonationLifetime + 's'
            },
            responseType: 'json'
        };
        const response = await this.transporter.request(opts);
        const successResponse = response.data;
        return {
            access_token: successResponse.accessToken,
            // Convert from ISO format to timestamp.
            expiry_date: new Date(successResponse.expireTime).getTime(),
            res: response
        };
    }
    /**
     * Returns whether the provided credentials are expired or not.
     * If there is no expiry time, assumes the token is not expired or expiring.
     * @param accessToken The credentials to check for expiration.
     * @return Whether the credentials are expired or not.
     */ isExpired(accessToken) {
        const now = new Date().getTime();
        return accessToken.expiry_date ? now >= accessToken.expiry_date - this.eagerRefreshThresholdMillis : false;
    }
    /**
     * @return The list of scopes for the requested GCP access token.
     */ getScopesArray() {
        // Since scopes can be provided as string or array, the type should
        // be normalized.
        if (typeof this.scopes === 'string') {
            return [
                this.scopes
            ];
        }
        return this.scopes || [
            DEFAULT_OAUTH_SCOPE
        ];
    }
    getMetricsHeaderValue() {
        const nodeVersion = process.version.replace(/^v/, '');
        const saImpersonation = this.serviceAccountImpersonationUrl !== undefined;
        const credentialSourceType = this.credentialSourceType ? this.credentialSourceType : 'unknown';
        return `gl-node/${nodeVersion} auth/${pkg.version} google-byoid-sdk source/${credentialSourceType} sa-impersonation/${saImpersonation} config-lifetime/${this.configLifetimeRequested}`;
    }
}
exports.BaseExternalAccountClient = BaseExternalAccountClient;
_BaseExternalAccountClient_pendingAccessToken = new WeakMap(), _BaseExternalAccountClient_instances = new WeakSet(), _BaseExternalAccountClient_internalRefreshAccessTokenAsync = async function _BaseExternalAccountClient_internalRefreshAccessTokenAsync() {
    // Retrieve the external credential.
    const subjectToken = await this.retrieveSubjectToken();
    // Construct the STS credentials options.
    const stsCredentialsOptions = {
        grantType: STS_GRANT_TYPE,
        audience: this.audience,
        requestedTokenType: STS_REQUEST_TOKEN_TYPE,
        subjectToken,
        subjectTokenType: this.subjectTokenType,
        // generateAccessToken requires the provided access token to have
        // scopes:
        // https://www.googleapis.com/auth/iam or
        // https://www.googleapis.com/auth/cloud-platform
        // The new service account access token scopes will match the user
        // provided ones.
        scope: this.serviceAccountImpersonationUrl ? [
            DEFAULT_OAUTH_SCOPE
        ] : this.getScopesArray()
    };
    // Exchange the external credentials for a GCP access token.
    // Client auth is prioritized over passing the workforcePoolUserProject
    // parameter for STS token exchange.
    const additionalOptions = !this.clientAuth && this.workforcePoolUserProject ? {
        userProject: this.workforcePoolUserProject
    } : undefined;
    const additionalHeaders = {
        'x-goog-api-client': this.getMetricsHeaderValue()
    };
    const stsResponse = await this.stsCredential.exchangeToken(stsCredentialsOptions, additionalHeaders, additionalOptions);
    if (this.serviceAccountImpersonationUrl) {
        this.cachedAccessToken = await this.getImpersonatedAccessToken(stsResponse.access_token);
    } else if (stsResponse.expires_in) {
        // Save response in cached access token.
        this.cachedAccessToken = {
            access_token: stsResponse.access_token,
            expiry_date: new Date().getTime() + stsResponse.expires_in * 1000,
            res: stsResponse.res
        };
    } else {
        // Save response in cached access token.
        this.cachedAccessToken = {
            access_token: stsResponse.access_token,
            res: stsResponse.res
        };
    }
    // Save credentials.
    this.credentials = {};
    Object.assign(this.credentials, this.cachedAccessToken);
    delete this.credentials.res;
    // Trigger tokens event to notify external listeners.
    this.emit('tokens', {
        refresh_token: null,
        expiry_date: this.cachedAccessToken.expiry_date,
        access_token: this.cachedAccessToken.access_token,
        token_type: 'Bearer',
        id_token: null
    });
    // Return the cached access token.
    return this.cachedAccessToken;
};
}}),
"[project]/node_modules/.pnpm/google-auth-library@9.15.0_encoding@0.1.13/node_modules/google-auth-library/build/src/auth/filesubjecttokensupplier.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
// Copyright 2024 Google LLC
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
var _a, _b, _c;
Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.FileSubjectTokenSupplier = void 0;
const util_1 = __turbopack_require__("[externals]/ [external] (util, cjs)");
const fs = __turbopack_require__("[externals]/ [external] (fs, cjs)");
// fs.readfile is undefined in browser karma tests causing
// `npm run browser-test` to fail as test.oauth2.ts imports this file via
// src/index.ts.
// Fallback to void function to avoid promisify throwing a TypeError.
const readFile = (0, util_1.promisify)((_a = fs.readFile) !== null && _a !== void 0 ? _a : ()=>{});
const realpath = (0, util_1.promisify)((_b = fs.realpath) !== null && _b !== void 0 ? _b : ()=>{});
const lstat = (0, util_1.promisify)((_c = fs.lstat) !== null && _c !== void 0 ? _c : ()=>{});
/**
 * Internal subject token supplier implementation used when a file location
 * is configured in the credential configuration used to build an {@link IdentityPoolClient}
 */ class FileSubjectTokenSupplier {
    /**
     * Instantiates a new file based subject token supplier.
     * @param opts The file subject token supplier options to build the supplier
     *   with.
     */ constructor(opts){
        this.filePath = opts.filePath;
        this.formatType = opts.formatType;
        this.subjectTokenFieldName = opts.subjectTokenFieldName;
    }
    /**
     * Returns the subject token stored at the file specified in the constructor.
     * @param context {@link ExternalAccountSupplierContext} from the calling
     *   {@link IdentityPoolClient}, contains the requested audience and subject
     *   token type for the external account identity. Not used.
     */ async getSubjectToken(context) {
        // Make sure there is a file at the path. lstatSync will throw if there is
        // nothing there.
        let parsedFilePath = this.filePath;
        try {
            // Resolve path to actual file in case of symlink. Expect a thrown error
            // if not resolvable.
            parsedFilePath = await realpath(parsedFilePath);
            if (!(await lstat(parsedFilePath)).isFile()) {
                throw new Error();
            }
        } catch (err) {
            if (err instanceof Error) {
                err.message = `The file at ${parsedFilePath} does not exist, or it is not a file. ${err.message}`;
            }
            throw err;
        }
        let subjectToken;
        const rawText = await readFile(parsedFilePath, {
            encoding: 'utf8'
        });
        if (this.formatType === 'text') {
            subjectToken = rawText;
        } else if (this.formatType === 'json' && this.subjectTokenFieldName) {
            const json = JSON.parse(rawText);
            subjectToken = json[this.subjectTokenFieldName];
        }
        if (!subjectToken) {
            throw new Error('Unable to parse the subject_token from the credential_source file');
        }
        return subjectToken;
    }
}
exports.FileSubjectTokenSupplier = FileSubjectTokenSupplier;
}}),
"[project]/node_modules/.pnpm/google-auth-library@9.15.0_encoding@0.1.13/node_modules/google-auth-library/build/src/auth/urlsubjecttokensupplier.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
// Copyright 2024 Google LLC
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
Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.UrlSubjectTokenSupplier = void 0;
/**
 * Internal subject token supplier implementation used when a URL
 * is configured in the credential configuration used to build an {@link IdentityPoolClient}
 */ class UrlSubjectTokenSupplier {
    /**
     * Instantiates a URL subject token supplier.
     * @param opts The URL subject token supplier options to build the supplier with.
     */ constructor(opts){
        this.url = opts.url;
        this.formatType = opts.formatType;
        this.subjectTokenFieldName = opts.subjectTokenFieldName;
        this.headers = opts.headers;
        this.additionalGaxiosOptions = opts.additionalGaxiosOptions;
    }
    /**
     * Sends a GET request to the URL provided in the constructor and resolves
     * with the returned external subject token.
     * @param context {@link ExternalAccountSupplierContext} from the calling
     *   {@link IdentityPoolClient}, contains the requested audience and subject
     *   token type for the external account identity. Not used.
     */ async getSubjectToken(context) {
        const opts = {
            ...this.additionalGaxiosOptions,
            url: this.url,
            method: 'GET',
            headers: this.headers,
            responseType: this.formatType
        };
        let subjectToken;
        if (this.formatType === 'text') {
            const response = await context.transporter.request(opts);
            subjectToken = response.data;
        } else if (this.formatType === 'json' && this.subjectTokenFieldName) {
            const response = await context.transporter.request(opts);
            subjectToken = response.data[this.subjectTokenFieldName];
        }
        if (!subjectToken) {
            throw new Error('Unable to parse the subject_token from the credential_source URL');
        }
        return subjectToken;
    }
}
exports.UrlSubjectTokenSupplier = UrlSubjectTokenSupplier;
}}),
"[project]/node_modules/.pnpm/google-auth-library@9.15.0_encoding@0.1.13/node_modules/google-auth-library/build/src/auth/identitypoolclient.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
// Copyright 2021 Google LLC
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
Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.IdentityPoolClient = void 0;
const baseexternalclient_1 = __turbopack_require__("[project]/node_modules/.pnpm/google-auth-library@9.15.0_encoding@0.1.13/node_modules/google-auth-library/build/src/auth/baseexternalclient.js [app-rsc] (ecmascript)");
const util_1 = __turbopack_require__("[project]/node_modules/.pnpm/google-auth-library@9.15.0_encoding@0.1.13/node_modules/google-auth-library/build/src/util.js [app-rsc] (ecmascript)");
const filesubjecttokensupplier_1 = __turbopack_require__("[project]/node_modules/.pnpm/google-auth-library@9.15.0_encoding@0.1.13/node_modules/google-auth-library/build/src/auth/filesubjecttokensupplier.js [app-rsc] (ecmascript)");
const urlsubjecttokensupplier_1 = __turbopack_require__("[project]/node_modules/.pnpm/google-auth-library@9.15.0_encoding@0.1.13/node_modules/google-auth-library/build/src/auth/urlsubjecttokensupplier.js [app-rsc] (ecmascript)");
/**
 * Defines the Url-sourced and file-sourced external account clients mainly
 * used for K8s and Azure workloads.
 */ class IdentityPoolClient extends baseexternalclient_1.BaseExternalAccountClient {
    /**
     * Instantiate an IdentityPoolClient instance using the provided JSON
     * object loaded from an external account credentials file.
     * An error is thrown if the credential is not a valid file-sourced or
     * url-sourced credential or a workforce pool user project is provided
     * with a non workforce audience.
     * @param options The external account options object typically loaded
     *   from the external account JSON credential file. The camelCased options
     *   are aliases for the snake_cased options.
     * @param additionalOptions **DEPRECATED, all options are available in the
     *   `options` parameter.** Optional additional behavior customization options.
     *   These currently customize expiration threshold time and whether to retry
     *   on 401/403 API request errors.
     */ constructor(options, additionalOptions){
        super(options, additionalOptions);
        const opts = (0, util_1.originalOrCamelOptions)(options);
        const credentialSource = opts.get('credential_source');
        const subjectTokenSupplier = opts.get('subject_token_supplier');
        // Validate credential sourcing configuration.
        if (!credentialSource && !subjectTokenSupplier) {
            throw new Error('A credential source or subject token supplier must be specified.');
        }
        if (credentialSource && subjectTokenSupplier) {
            throw new Error('Only one of credential source or subject token supplier can be specified.');
        }
        if (subjectTokenSupplier) {
            this.subjectTokenSupplier = subjectTokenSupplier;
            this.credentialSourceType = 'programmatic';
        } else {
            const credentialSourceOpts = (0, util_1.originalOrCamelOptions)(credentialSource);
            const formatOpts = (0, util_1.originalOrCamelOptions)(credentialSourceOpts.get('format'));
            // Text is the default format type.
            const formatType = formatOpts.get('type') || 'text';
            const formatSubjectTokenFieldName = formatOpts.get('subject_token_field_name');
            if (formatType !== 'json' && formatType !== 'text') {
                throw new Error(`Invalid credential_source format "${formatType}"`);
            }
            if (formatType === 'json' && !formatSubjectTokenFieldName) {
                throw new Error('Missing subject_token_field_name for JSON credential_source format');
            }
            const file = credentialSourceOpts.get('file');
            const url = credentialSourceOpts.get('url');
            const headers = credentialSourceOpts.get('headers');
            if (file && url) {
                throw new Error('No valid Identity Pool "credential_source" provided, must be either file or url.');
            } else if (file && !url) {
                this.credentialSourceType = 'file';
                this.subjectTokenSupplier = new filesubjecttokensupplier_1.FileSubjectTokenSupplier({
                    filePath: file,
                    formatType: formatType,
                    subjectTokenFieldName: formatSubjectTokenFieldName
                });
            } else if (!file && url) {
                this.credentialSourceType = 'url';
                this.subjectTokenSupplier = new urlsubjecttokensupplier_1.UrlSubjectTokenSupplier({
                    url: url,
                    formatType: formatType,
                    subjectTokenFieldName: formatSubjectTokenFieldName,
                    headers: headers,
                    additionalGaxiosOptions: IdentityPoolClient.RETRY_CONFIG
                });
            } else {
                throw new Error('No valid Identity Pool "credential_source" provided, must be either file or url.');
            }
        }
    }
    /**
     * Triggered when a external subject token is needed to be exchanged for a GCP
     * access token via GCP STS endpoint. Gets a subject token by calling
     * the configured {@link SubjectTokenSupplier}
     * @return A promise that resolves with the external subject token.
     */ async retrieveSubjectToken() {
        return this.subjectTokenSupplier.getSubjectToken(this.supplierContext);
    }
}
exports.IdentityPoolClient = IdentityPoolClient;
}}),
"[project]/node_modules/.pnpm/google-auth-library@9.15.0_encoding@0.1.13/node_modules/google-auth-library/build/src/auth/awsrequestsigner.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
// Copyright 2021 Google LLC
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
Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.AwsRequestSigner = void 0;
const crypto_1 = __turbopack_require__("[project]/node_modules/.pnpm/google-auth-library@9.15.0_encoding@0.1.13/node_modules/google-auth-library/build/src/crypto/crypto.js [app-rsc] (ecmascript)");
/** AWS Signature Version 4 signing algorithm identifier.  */ const AWS_ALGORITHM = 'AWS4-HMAC-SHA256';
/**
 * The termination string for the AWS credential scope value as defined in
 * https://docs.aws.amazon.com/general/latest/gr/sigv4-create-string-to-sign.html
 */ const AWS_REQUEST_TYPE = 'aws4_request';
/**
 * Implements an AWS API request signer based on the AWS Signature Version 4
 * signing process.
 * https://docs.aws.amazon.com/general/latest/gr/signature-version-4.html
 */ class AwsRequestSigner {
    /**
     * Instantiates an AWS API request signer used to send authenticated signed
     * requests to AWS APIs based on the AWS Signature Version 4 signing process.
     * This also provides a mechanism to generate the signed request without
     * sending it.
     * @param getCredentials A mechanism to retrieve AWS security credentials
     *   when needed.
     * @param region The AWS region to use.
     */ constructor(getCredentials, region){
        this.getCredentials = getCredentials;
        this.region = region;
        this.crypto = (0, crypto_1.createCrypto)();
    }
    /**
     * Generates the signed request for the provided HTTP request for calling
     * an AWS API. This follows the steps described at:
     * https://docs.aws.amazon.com/general/latest/gr/sigv4_signing.html
     * @param amzOptions The AWS request options that need to be signed.
     * @return A promise that resolves with the GaxiosOptions containing the
     *   signed HTTP request parameters.
     */ async getRequestOptions(amzOptions) {
        if (!amzOptions.url) {
            throw new Error('"url" is required in "amzOptions"');
        }
        // Stringify JSON requests. This will be set in the request body of the
        // generated signed request.
        const requestPayloadData = typeof amzOptions.data === 'object' ? JSON.stringify(amzOptions.data) : amzOptions.data;
        const url = amzOptions.url;
        const method = amzOptions.method || 'GET';
        const requestPayload = amzOptions.body || requestPayloadData;
        const additionalAmzHeaders = amzOptions.headers;
        const awsSecurityCredentials = await this.getCredentials();
        const uri = new URL(url);
        const headerMap = await generateAuthenticationHeaderMap({
            crypto: this.crypto,
            host: uri.host,
            canonicalUri: uri.pathname,
            canonicalQuerystring: uri.search.substr(1),
            method,
            region: this.region,
            securityCredentials: awsSecurityCredentials,
            requestPayload,
            additionalAmzHeaders
        });
        // Append additional optional headers, eg. X-Amz-Target, Content-Type, etc.
        const headers = Object.assign(// Add x-amz-date if available.
        headerMap.amzDate ? {
            'x-amz-date': headerMap.amzDate
        } : {}, {
            Authorization: headerMap.authorizationHeader,
            host: uri.host
        }, additionalAmzHeaders || {});
        if (awsSecurityCredentials.token) {
            Object.assign(headers, {
                'x-amz-security-token': awsSecurityCredentials.token
            });
        }
        const awsSignedReq = {
            url,
            method: method,
            headers
        };
        if (typeof requestPayload !== 'undefined') {
            awsSignedReq.body = requestPayload;
        }
        return awsSignedReq;
    }
}
exports.AwsRequestSigner = AwsRequestSigner;
/**
 * Creates the HMAC-SHA256 hash of the provided message using the
 * provided key.
 *
 * @param crypto The crypto instance used to facilitate cryptographic
 *   operations.
 * @param key The HMAC-SHA256 key to use.
 * @param msg The message to hash.
 * @return The computed hash bytes.
 */ async function sign(crypto, key, msg) {
    return await crypto.signWithHmacSha256(key, msg);
}
/**
 * Calculates the signing key used to calculate the signature for
 * AWS Signature Version 4 based on:
 * https://docs.aws.amazon.com/general/latest/gr/sigv4-calculate-signature.html
 *
 * @param crypto The crypto instance used to facilitate cryptographic
 *   operations.
 * @param key The AWS secret access key.
 * @param dateStamp The '%Y%m%d' date format.
 * @param region The AWS region.
 * @param serviceName The AWS service name, eg. sts.
 * @return The signing key bytes.
 */ async function getSigningKey(crypto, key, dateStamp, region, serviceName) {
    const kDate = await sign(crypto, `AWS4${key}`, dateStamp);
    const kRegion = await sign(crypto, kDate, region);
    const kService = await sign(crypto, kRegion, serviceName);
    const kSigning = await sign(crypto, kService, 'aws4_request');
    return kSigning;
}
/**
 * Generates the authentication header map needed for generating the AWS
 * Signature Version 4 signed request.
 *
 * @param option The options needed to compute the authentication header map.
 * @return The AWS authentication header map which constitutes of the following
 *   components: amz-date, authorization header and canonical query string.
 */ async function generateAuthenticationHeaderMap(options) {
    const additionalAmzHeaders = options.additionalAmzHeaders || {};
    const requestPayload = options.requestPayload || '';
    // iam.amazonaws.com host => iam service.
    // sts.us-east-2.amazonaws.com => sts service.
    const serviceName = options.host.split('.')[0];
    const now = new Date();
    // Format: '%Y%m%dT%H%M%SZ'.
    const amzDate = now.toISOString().replace(/[-:]/g, '').replace(/\.[0-9]+/, '');
    // Format: '%Y%m%d'.
    const dateStamp = now.toISOString().replace(/[-]/g, '').replace(/T.*/, '');
    // Change all additional headers to be lower case.
    const reformattedAdditionalAmzHeaders = {};
    Object.keys(additionalAmzHeaders).forEach((key)=>{
        reformattedAdditionalAmzHeaders[key.toLowerCase()] = additionalAmzHeaders[key];
    });
    // Add AWS token if available.
    if (options.securityCredentials.token) {
        reformattedAdditionalAmzHeaders['x-amz-security-token'] = options.securityCredentials.token;
    }
    // Header keys need to be sorted alphabetically.
    const amzHeaders = Object.assign({
        host: options.host
    }, // Previously the date was not fixed with x-amz- and could be provided manually.
    // https://github.com/boto/botocore/blob/879f8440a4e9ace5d3cf145ce8b3d5e5ffb892ef/tests/unit/auth/aws4_testsuite/get-header-value-trim.req
    reformattedAdditionalAmzHeaders.date ? {} : {
        'x-amz-date': amzDate
    }, reformattedAdditionalAmzHeaders);
    let canonicalHeaders = '';
    const signedHeadersList = Object.keys(amzHeaders).sort();
    signedHeadersList.forEach((key)=>{
        canonicalHeaders += `${key}:${amzHeaders[key]}\n`;
    });
    const signedHeaders = signedHeadersList.join(';');
    const payloadHash = await options.crypto.sha256DigestHex(requestPayload);
    // https://docs.aws.amazon.com/general/latest/gr/sigv4-create-canonical-request.html
    const canonicalRequest = `${options.method}\n` + `${options.canonicalUri}\n` + `${options.canonicalQuerystring}\n` + `${canonicalHeaders}\n` + `${signedHeaders}\n` + `${payloadHash}`;
    const credentialScope = `${dateStamp}/${options.region}/${serviceName}/${AWS_REQUEST_TYPE}`;
    // https://docs.aws.amazon.com/general/latest/gr/sigv4-create-string-to-sign.html
    const stringToSign = `${AWS_ALGORITHM}\n` + `${amzDate}\n` + `${credentialScope}\n` + await options.crypto.sha256DigestHex(canonicalRequest);
    // https://docs.aws.amazon.com/general/latest/gr/sigv4-calculate-signature.html
    const signingKey = await getSigningKey(options.crypto, options.securityCredentials.secretAccessKey, dateStamp, options.region, serviceName);
    const signature = await sign(options.crypto, signingKey, stringToSign);
    // https://docs.aws.amazon.com/general/latest/gr/sigv4-add-signature-to-request.html
    const authorizationHeader = `${AWS_ALGORITHM} Credential=${options.securityCredentials.accessKeyId}/` + `${credentialScope}, SignedHeaders=${signedHeaders}, ` + `Signature=${(0, crypto_1.fromArrayBufferToHex)(signature)}`;
    return {
        // Do not return x-amz-date if date is available.
        amzDate: reformattedAdditionalAmzHeaders.date ? undefined : amzDate,
        authorizationHeader,
        canonicalQuerystring: options.canonicalQuerystring
    };
}
}}),
"[project]/node_modules/.pnpm/google-auth-library@9.15.0_encoding@0.1.13/node_modules/google-auth-library/build/src/auth/defaultawssecuritycredentialssupplier.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
// Copyright 2024 Google LLC
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
var __classPrivateFieldGet = this && this.__classPrivateFieldGet || function(receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var _DefaultAwsSecurityCredentialsSupplier_instances, _DefaultAwsSecurityCredentialsSupplier_getImdsV2SessionToken, _DefaultAwsSecurityCredentialsSupplier_getAwsRoleName, _DefaultAwsSecurityCredentialsSupplier_retrieveAwsSecurityCredentials, _DefaultAwsSecurityCredentialsSupplier_regionFromEnv_get, _DefaultAwsSecurityCredentialsSupplier_securityCredentialsFromEnv_get;
Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.DefaultAwsSecurityCredentialsSupplier = void 0;
/**
 * Internal AWS security credentials supplier implementation used by {@link AwsClient}
 * when a credential source is provided instead of a user defined supplier.
 * The logic is summarized as:
 * 1. If imdsv2_session_token_url is provided in the credential source, then
 *    fetch the aws session token and include it in the headers of the
 *    metadata requests. This is a requirement for IDMSv2 but optional
 *    for IDMSv1.
 * 2. Retrieve AWS region from availability-zone.
 * 3a. Check AWS credentials in environment variables. If not found, get
 *     from security-credentials endpoint.
 * 3b. Get AWS credentials from security-credentials endpoint. In order
 *     to retrieve this, the AWS role needs to be determined by calling
 *     security-credentials endpoint without any argument. Then the
 *     credentials can be retrieved via: security-credentials/role_name
 * 4. Generate the signed request to AWS STS GetCallerIdentity action.
 * 5. Inject x-goog-cloud-target-resource into header and serialize the
 *    signed request. This will be the subject-token to pass to GCP STS.
 */ class DefaultAwsSecurityCredentialsSupplier {
    /**
     * Instantiates a new DefaultAwsSecurityCredentialsSupplier using information
     * from the credential_source stored in the ADC file.
     * @param opts The default aws security credentials supplier options object to
     *   build the supplier with.
     */ constructor(opts){
        _DefaultAwsSecurityCredentialsSupplier_instances.add(this);
        this.regionUrl = opts.regionUrl;
        this.securityCredentialsUrl = opts.securityCredentialsUrl;
        this.imdsV2SessionTokenUrl = opts.imdsV2SessionTokenUrl;
        this.additionalGaxiosOptions = opts.additionalGaxiosOptions;
    }
    /**
     * Returns the active AWS region. This first checks to see if the region
     * is available as an environment variable. If it is not, then the supplier
     * will call the region URL.
     * @param context {@link ExternalAccountSupplierContext} from the calling
     *   {@link AwsClient}, contains the requested audience and subject token type
     *   for the external account identity.
     * @return A promise that resolves with the AWS region string.
     */ async getAwsRegion(context) {
        // Priority order for region determination:
        // AWS_REGION > AWS_DEFAULT_REGION > metadata server.
        if (__classPrivateFieldGet(this, _DefaultAwsSecurityCredentialsSupplier_instances, "a", _DefaultAwsSecurityCredentialsSupplier_regionFromEnv_get)) {
            return __classPrivateFieldGet(this, _DefaultAwsSecurityCredentialsSupplier_instances, "a", _DefaultAwsSecurityCredentialsSupplier_regionFromEnv_get);
        }
        const metadataHeaders = {};
        if (!__classPrivateFieldGet(this, _DefaultAwsSecurityCredentialsSupplier_instances, "a", _DefaultAwsSecurityCredentialsSupplier_regionFromEnv_get) && this.imdsV2SessionTokenUrl) {
            metadataHeaders['x-aws-ec2-metadata-token'] = await __classPrivateFieldGet(this, _DefaultAwsSecurityCredentialsSupplier_instances, "m", _DefaultAwsSecurityCredentialsSupplier_getImdsV2SessionToken).call(this, context.transporter);
        }
        if (!this.regionUrl) {
            throw new Error('Unable to determine AWS region due to missing ' + '"options.credential_source.region_url"');
        }
        const opts = {
            ...this.additionalGaxiosOptions,
            url: this.regionUrl,
            method: 'GET',
            responseType: 'text',
            headers: metadataHeaders
        };
        const response = await context.transporter.request(opts);
        // Remove last character. For example, if us-east-2b is returned,
        // the region would be us-east-2.
        return response.data.substr(0, response.data.length - 1);
    }
    /**
     * Returns AWS security credentials. This first checks to see if the credentials
     * is available as environment variables. If it is not, then the supplier
     * will call the security credentials URL.
     * @param context {@link ExternalAccountSupplierContext} from the calling
     *   {@link AwsClient}, contains the requested audience and subject token type
     *   for the external account identity.
     * @return A promise that resolves with the AWS security credentials.
     */ async getAwsSecurityCredentials(context) {
        // Check environment variables for permanent credentials first.
        // https://docs.aws.amazon.com/general/latest/gr/aws-sec-cred-types.html
        if (__classPrivateFieldGet(this, _DefaultAwsSecurityCredentialsSupplier_instances, "a", _DefaultAwsSecurityCredentialsSupplier_securityCredentialsFromEnv_get)) {
            return __classPrivateFieldGet(this, _DefaultAwsSecurityCredentialsSupplier_instances, "a", _DefaultAwsSecurityCredentialsSupplier_securityCredentialsFromEnv_get);
        }
        const metadataHeaders = {};
        if (this.imdsV2SessionTokenUrl) {
            metadataHeaders['x-aws-ec2-metadata-token'] = await __classPrivateFieldGet(this, _DefaultAwsSecurityCredentialsSupplier_instances, "m", _DefaultAwsSecurityCredentialsSupplier_getImdsV2SessionToken).call(this, context.transporter);
        }
        // Since the role on a VM can change, we don't need to cache it.
        const roleName = await __classPrivateFieldGet(this, _DefaultAwsSecurityCredentialsSupplier_instances, "m", _DefaultAwsSecurityCredentialsSupplier_getAwsRoleName).call(this, metadataHeaders, context.transporter);
        // Temporary credentials typically last for several hours.
        // Expiration is returned in response.
        // Consider future optimization of this logic to cache AWS tokens
        // until their natural expiration.
        const awsCreds = await __classPrivateFieldGet(this, _DefaultAwsSecurityCredentialsSupplier_instances, "m", _DefaultAwsSecurityCredentialsSupplier_retrieveAwsSecurityCredentials).call(this, roleName, metadataHeaders, context.transporter);
        return {
            accessKeyId: awsCreds.AccessKeyId,
            secretAccessKey: awsCreds.SecretAccessKey,
            token: awsCreds.Token
        };
    }
}
exports.DefaultAwsSecurityCredentialsSupplier = DefaultAwsSecurityCredentialsSupplier;
_DefaultAwsSecurityCredentialsSupplier_instances = new WeakSet(), _DefaultAwsSecurityCredentialsSupplier_getImdsV2SessionToken = /**
 * @param transporter The transporter to use for requests.
 * @return A promise that resolves with the IMDSv2 Session Token.
 */ async function _DefaultAwsSecurityCredentialsSupplier_getImdsV2SessionToken(transporter) {
    const opts = {
        ...this.additionalGaxiosOptions,
        url: this.imdsV2SessionTokenUrl,
        method: 'PUT',
        responseType: 'text',
        headers: {
            'x-aws-ec2-metadata-token-ttl-seconds': '300'
        }
    };
    const response = await transporter.request(opts);
    return response.data;
}, _DefaultAwsSecurityCredentialsSupplier_getAwsRoleName = /**
 * @param headers The headers to be used in the metadata request.
 * @param transporter The transporter to use for requests.
 * @return A promise that resolves with the assigned role to the current
 *   AWS VM. This is needed for calling the security-credentials endpoint.
 */ async function _DefaultAwsSecurityCredentialsSupplier_getAwsRoleName(headers, transporter) {
    if (!this.securityCredentialsUrl) {
        throw new Error('Unable to determine AWS role name due to missing ' + '"options.credential_source.url"');
    }
    const opts = {
        ...this.additionalGaxiosOptions,
        url: this.securityCredentialsUrl,
        method: 'GET',
        responseType: 'text',
        headers: headers
    };
    const response = await transporter.request(opts);
    return response.data;
}, _DefaultAwsSecurityCredentialsSupplier_retrieveAwsSecurityCredentials = /**
 * Retrieves the temporary AWS credentials by calling the security-credentials
 * endpoint as specified in the `credential_source` object.
 * @param roleName The role attached to the current VM.
 * @param headers The headers to be used in the metadata request.
 * @param transporter The transporter to use for requests.
 * @return A promise that resolves with the temporary AWS credentials
 *   needed for creating the GetCallerIdentity signed request.
 */ async function _DefaultAwsSecurityCredentialsSupplier_retrieveAwsSecurityCredentials(roleName, headers, transporter) {
    const response = await transporter.request({
        ...this.additionalGaxiosOptions,
        url: `${this.securityCredentialsUrl}/${roleName}`,
        responseType: 'json',
        headers: headers
    });
    return response.data;
}, _DefaultAwsSecurityCredentialsSupplier_regionFromEnv_get = function _DefaultAwsSecurityCredentialsSupplier_regionFromEnv_get() {
    // The AWS region can be provided through AWS_REGION or AWS_DEFAULT_REGION.
    // Only one is required.
    return process.env['AWS_REGION'] || process.env['AWS_DEFAULT_REGION'] || null;
}, _DefaultAwsSecurityCredentialsSupplier_securityCredentialsFromEnv_get = function _DefaultAwsSecurityCredentialsSupplier_securityCredentialsFromEnv_get() {
    // Both AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY are required.
    if (process.env['AWS_ACCESS_KEY_ID'] && process.env['AWS_SECRET_ACCESS_KEY']) {
        return {
            accessKeyId: process.env['AWS_ACCESS_KEY_ID'],
            secretAccessKey: process.env['AWS_SECRET_ACCESS_KEY'],
            token: process.env['AWS_SESSION_TOKEN']
        };
    }
    return null;
};
}}),
"[project]/node_modules/.pnpm/google-auth-library@9.15.0_encoding@0.1.13/node_modules/google-auth-library/build/src/auth/awsclient.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
// Copyright 2021 Google LLC
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
var __classPrivateFieldGet = this && this.__classPrivateFieldGet || function(receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var _a, _AwsClient_DEFAULT_AWS_REGIONAL_CREDENTIAL_VERIFICATION_URL;
Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.AwsClient = void 0;
const awsrequestsigner_1 = __turbopack_require__("[project]/node_modules/.pnpm/google-auth-library@9.15.0_encoding@0.1.13/node_modules/google-auth-library/build/src/auth/awsrequestsigner.js [app-rsc] (ecmascript)");
const baseexternalclient_1 = __turbopack_require__("[project]/node_modules/.pnpm/google-auth-library@9.15.0_encoding@0.1.13/node_modules/google-auth-library/build/src/auth/baseexternalclient.js [app-rsc] (ecmascript)");
const defaultawssecuritycredentialssupplier_1 = __turbopack_require__("[project]/node_modules/.pnpm/google-auth-library@9.15.0_encoding@0.1.13/node_modules/google-auth-library/build/src/auth/defaultawssecuritycredentialssupplier.js [app-rsc] (ecmascript)");
const util_1 = __turbopack_require__("[project]/node_modules/.pnpm/google-auth-library@9.15.0_encoding@0.1.13/node_modules/google-auth-library/build/src/util.js [app-rsc] (ecmascript)");
/**
 * AWS external account client. This is used for AWS workloads, where
 * AWS STS GetCallerIdentity serialized signed requests are exchanged for
 * GCP access token.
 */ class AwsClient extends baseexternalclient_1.BaseExternalAccountClient {
    /**
     * Instantiates an AwsClient instance using the provided JSON
     * object loaded from an external account credentials file.
     * An error is thrown if the credential is not a valid AWS credential.
     * @param options The external account options object typically loaded
     *   from the external account JSON credential file.
     * @param additionalOptions **DEPRECATED, all options are available in the
     *   `options` parameter.** Optional additional behavior customization options.
     *   These currently customize expiration threshold time and whether to retry
     *   on 401/403 API request errors.
     */ constructor(options, additionalOptions){
        super(options, additionalOptions);
        const opts = (0, util_1.originalOrCamelOptions)(options);
        const credentialSource = opts.get('credential_source');
        const awsSecurityCredentialsSupplier = opts.get('aws_security_credentials_supplier');
        // Validate credential sourcing configuration.
        if (!credentialSource && !awsSecurityCredentialsSupplier) {
            throw new Error('A credential source or AWS security credentials supplier must be specified.');
        }
        if (credentialSource && awsSecurityCredentialsSupplier) {
            throw new Error('Only one of credential source or AWS security credentials supplier can be specified.');
        }
        if (awsSecurityCredentialsSupplier) {
            this.awsSecurityCredentialsSupplier = awsSecurityCredentialsSupplier;
            this.regionalCredVerificationUrl = __classPrivateFieldGet(_a, _a, "f", _AwsClient_DEFAULT_AWS_REGIONAL_CREDENTIAL_VERIFICATION_URL);
            this.credentialSourceType = 'programmatic';
        } else {
            const credentialSourceOpts = (0, util_1.originalOrCamelOptions)(credentialSource);
            this.environmentId = credentialSourceOpts.get('environment_id');
            // This is only required if the AWS region is not available in the
            // AWS_REGION or AWS_DEFAULT_REGION environment variables.
            const regionUrl = credentialSourceOpts.get('region_url');
            // This is only required if AWS security credentials are not available in
            // environment variables.
            const securityCredentialsUrl = credentialSourceOpts.get('url');
            const imdsV2SessionTokenUrl = credentialSourceOpts.get('imdsv2_session_token_url');
            this.awsSecurityCredentialsSupplier = new defaultawssecuritycredentialssupplier_1.DefaultAwsSecurityCredentialsSupplier({
                regionUrl: regionUrl,
                securityCredentialsUrl: securityCredentialsUrl,
                imdsV2SessionTokenUrl: imdsV2SessionTokenUrl
            });
            this.regionalCredVerificationUrl = credentialSourceOpts.get('regional_cred_verification_url');
            this.credentialSourceType = 'aws';
            // Data validators.
            this.validateEnvironmentId();
        }
        this.awsRequestSigner = null;
        this.region = '';
    }
    validateEnvironmentId() {
        var _b;
        const match = (_b = this.environmentId) === null || _b === void 0 ? void 0 : _b.match(/^(aws)(\d+)$/);
        if (!match || !this.regionalCredVerificationUrl) {
            throw new Error('No valid AWS "credential_source" provided');
        } else if (parseInt(match[2], 10) !== 1) {
            throw new Error(`aws version "${match[2]}" is not supported in the current build.`);
        }
    }
    /**
     * Triggered when an external subject token is needed to be exchanged for a
     * GCP access token via GCP STS endpoint. This will call the
     * {@link AwsSecurityCredentialsSupplier} to retrieve an AWS region and AWS
     * Security Credentials, then use them to create a signed AWS STS request that
     * can be exchanged for a GCP access token.
     * @return A promise that resolves with the external subject token.
     */ async retrieveSubjectToken() {
        // Initialize AWS request signer if not already initialized.
        if (!this.awsRequestSigner) {
            this.region = await this.awsSecurityCredentialsSupplier.getAwsRegion(this.supplierContext);
            this.awsRequestSigner = new awsrequestsigner_1.AwsRequestSigner(async ()=>{
                return this.awsSecurityCredentialsSupplier.getAwsSecurityCredentials(this.supplierContext);
            }, this.region);
        }
        // Generate signed request to AWS STS GetCallerIdentity API.
        // Use the required regional endpoint. Otherwise, the request will fail.
        const options = await this.awsRequestSigner.getRequestOptions({
            ..._a.RETRY_CONFIG,
            url: this.regionalCredVerificationUrl.replace('{region}', this.region),
            method: 'POST'
        });
        // The GCP STS endpoint expects the headers to be formatted as:
        // [
        //   {key: 'x-amz-date', value: '...'},
        //   {key: 'Authorization', value: '...'},
        //   ...
        // ]
        // And then serialized as:
        // encodeURIComponent(JSON.stringify({
        //   url: '...',
        //   method: 'POST',
        //   headers: [{key: 'x-amz-date', value: '...'}, ...]
        // }))
        const reformattedHeader = [];
        const extendedHeaders = Object.assign({
            // The full, canonical resource name of the workload identity pool
            // provider, with or without the HTTPS prefix.
            // Including this header as part of the signature is recommended to
            // ensure data integrity.
            'x-goog-cloud-target-resource': this.audience
        }, options.headers);
        // Reformat header to GCP STS expected format.
        for(const key in extendedHeaders){
            reformattedHeader.push({
                key,
                value: extendedHeaders[key]
            });
        }
        // Serialize the reformatted signed request.
        return encodeURIComponent(JSON.stringify({
            url: options.url,
            method: options.method,
            headers: reformattedHeader
        }));
    }
}
exports.AwsClient = AwsClient;
_a = AwsClient;
_AwsClient_DEFAULT_AWS_REGIONAL_CREDENTIAL_VERIFICATION_URL = {
    value: 'https://sts.{region}.amazonaws.com?Action=GetCallerIdentity&Version=2011-06-15'
};
/**
 * @deprecated AWS client no validates the EC2 metadata address.
 **/ AwsClient.AWS_EC2_METADATA_IPV4_ADDRESS = '169.254.169.254';
/**
 * @deprecated AWS client no validates the EC2 metadata address.
 **/ AwsClient.AWS_EC2_METADATA_IPV6_ADDRESS = 'fd00:ec2::254';
}}),
"[project]/node_modules/.pnpm/google-auth-library@9.15.0_encoding@0.1.13/node_modules/google-auth-library/build/src/auth/executable-response.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
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
Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.InvalidSubjectTokenError = exports.InvalidMessageFieldError = exports.InvalidCodeFieldError = exports.InvalidTokenTypeFieldError = exports.InvalidExpirationTimeFieldError = exports.InvalidSuccessFieldError = exports.InvalidVersionFieldError = exports.ExecutableResponseError = exports.ExecutableResponse = void 0;
const SAML_SUBJECT_TOKEN_TYPE = 'urn:ietf:params:oauth:token-type:saml2';
const OIDC_SUBJECT_TOKEN_TYPE1 = 'urn:ietf:params:oauth:token-type:id_token';
const OIDC_SUBJECT_TOKEN_TYPE2 = 'urn:ietf:params:oauth:token-type:jwt';
/**
 * Defines the response of a 3rd party executable run by the pluggable auth client.
 */ class ExecutableResponse {
    /**
     * Instantiates an ExecutableResponse instance using the provided JSON object
     * from the output of the executable.
     * @param responseJson Response from a 3rd party executable, loaded from a
     * run of the executable or a cached output file.
     */ constructor(responseJson){
        // Check that the required fields exist in the json response.
        if (!responseJson.version) {
            throw new InvalidVersionFieldError("Executable response must contain a 'version' field.");
        }
        if (responseJson.success === undefined) {
            throw new InvalidSuccessFieldError("Executable response must contain a 'success' field.");
        }
        this.version = responseJson.version;
        this.success = responseJson.success;
        // Validate required fields for a successful response.
        if (this.success) {
            this.expirationTime = responseJson.expiration_time;
            this.tokenType = responseJson.token_type;
            // Validate token type field.
            if (this.tokenType !== SAML_SUBJECT_TOKEN_TYPE && this.tokenType !== OIDC_SUBJECT_TOKEN_TYPE1 && this.tokenType !== OIDC_SUBJECT_TOKEN_TYPE2) {
                throw new InvalidTokenTypeFieldError("Executable response must contain a 'token_type' field when successful " + `and it must be one of ${OIDC_SUBJECT_TOKEN_TYPE1}, ${OIDC_SUBJECT_TOKEN_TYPE2}, or ${SAML_SUBJECT_TOKEN_TYPE}.`);
            }
            // Validate subject token.
            if (this.tokenType === SAML_SUBJECT_TOKEN_TYPE) {
                if (!responseJson.saml_response) {
                    throw new InvalidSubjectTokenError(`Executable response must contain a 'saml_response' field when token_type=${SAML_SUBJECT_TOKEN_TYPE}.`);
                }
                this.subjectToken = responseJson.saml_response;
            } else {
                if (!responseJson.id_token) {
                    throw new InvalidSubjectTokenError("Executable response must contain a 'id_token' field when " + `token_type=${OIDC_SUBJECT_TOKEN_TYPE1} or ${OIDC_SUBJECT_TOKEN_TYPE2}.`);
                }
                this.subjectToken = responseJson.id_token;
            }
        } else {
            // Both code and message must be provided for unsuccessful responses.
            if (!responseJson.code) {
                throw new InvalidCodeFieldError("Executable response must contain a 'code' field when unsuccessful.");
            }
            if (!responseJson.message) {
                throw new InvalidMessageFieldError("Executable response must contain a 'message' field when unsuccessful.");
            }
            this.errorCode = responseJson.code;
            this.errorMessage = responseJson.message;
        }
    }
    /**
     * @return A boolean representing if the response has a valid token. Returns
     * true when the response was successful and the token is not expired.
     */ isValid() {
        return !this.isExpired() && this.success;
    }
    /**
     * @return A boolean representing if the response is expired. Returns true if the
     * provided timeout has passed.
     */ isExpired() {
        return this.expirationTime !== undefined && this.expirationTime < Math.round(Date.now() / 1000);
    }
}
exports.ExecutableResponse = ExecutableResponse;
/**
 * An error thrown by the ExecutableResponse class.
 */ class ExecutableResponseError extends Error {
    constructor(message){
        super(message);
        Object.setPrototypeOf(this, new.target.prototype);
    }
}
exports.ExecutableResponseError = ExecutableResponseError;
/**
 * An error thrown when the 'version' field in an executable response is missing or invalid.
 */ class InvalidVersionFieldError extends ExecutableResponseError {
}
exports.InvalidVersionFieldError = InvalidVersionFieldError;
/**
 * An error thrown when the 'success' field in an executable response is missing or invalid.
 */ class InvalidSuccessFieldError extends ExecutableResponseError {
}
exports.InvalidSuccessFieldError = InvalidSuccessFieldError;
/**
 * An error thrown when the 'expiration_time' field in an executable response is missing or invalid.
 */ class InvalidExpirationTimeFieldError extends ExecutableResponseError {
}
exports.InvalidExpirationTimeFieldError = InvalidExpirationTimeFieldError;
/**
 * An error thrown when the 'token_type' field in an executable response is missing or invalid.
 */ class InvalidTokenTypeFieldError extends ExecutableResponseError {
}
exports.InvalidTokenTypeFieldError = InvalidTokenTypeFieldError;
/**
 * An error thrown when the 'code' field in an executable response is missing or invalid.
 */ class InvalidCodeFieldError extends ExecutableResponseError {
}
exports.InvalidCodeFieldError = InvalidCodeFieldError;
/**
 * An error thrown when the 'message' field in an executable response is missing or invalid.
 */ class InvalidMessageFieldError extends ExecutableResponseError {
}
exports.InvalidMessageFieldError = InvalidMessageFieldError;
/**
 * An error thrown when the subject token in an executable response is missing or invalid.
 */ class InvalidSubjectTokenError extends ExecutableResponseError {
}
exports.InvalidSubjectTokenError = InvalidSubjectTokenError;
}}),
"[project]/node_modules/.pnpm/google-auth-library@9.15.0_encoding@0.1.13/node_modules/google-auth-library/build/src/auth/pluggable-auth-handler.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
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
Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.PluggableAuthHandler = void 0;
const pluggable_auth_client_1 = __turbopack_require__("[project]/node_modules/.pnpm/google-auth-library@9.15.0_encoding@0.1.13/node_modules/google-auth-library/build/src/auth/pluggable-auth-client.js [app-rsc] (ecmascript)");
const executable_response_1 = __turbopack_require__("[project]/node_modules/.pnpm/google-auth-library@9.15.0_encoding@0.1.13/node_modules/google-auth-library/build/src/auth/executable-response.js [app-rsc] (ecmascript)");
const childProcess = __turbopack_require__("[externals]/ [external] (child_process, cjs)");
const fs = __turbopack_require__("[externals]/ [external] (fs, cjs)");
/**
 * A handler used to retrieve 3rd party token responses from user defined
 * executables and cached file output for the PluggableAuthClient class.
 */ class PluggableAuthHandler {
    /**
     * Instantiates a PluggableAuthHandler instance using the provided
     * PluggableAuthHandlerOptions object.
     */ constructor(options){
        if (!options.command) {
            throw new Error('No command provided.');
        }
        this.commandComponents = PluggableAuthHandler.parseCommand(options.command);
        this.timeoutMillis = options.timeoutMillis;
        if (!this.timeoutMillis) {
            throw new Error('No timeoutMillis provided.');
        }
        this.outputFile = options.outputFile;
    }
    /**
     * Calls user provided executable to get a 3rd party subject token and
     * returns the response.
     * @param envMap a Map of additional Environment Variables required for
     *   the executable.
     * @return A promise that resolves with the executable response.
     */ retrieveResponseFromExecutable(envMap) {
        return new Promise((resolve, reject)=>{
            // Spawn process to run executable using added environment variables.
            const child = childProcess.spawn(this.commandComponents[0], this.commandComponents.slice(1), {
                env: {
                    ...process.env,
                    ...Object.fromEntries(envMap)
                }
            });
            let output = '';
            // Append stdout to output as executable runs.
            child.stdout.on('data', (data)=>{
                output += data;
            });
            // Append stderr as executable runs.
            child.stderr.on('data', (err)=>{
                output += err;
            });
            // Set up a timeout to end the child process and throw an error.
            const timeout = setTimeout(()=>{
                // Kill child process and remove listeners so 'close' event doesn't get
                // read after child process is killed.
                child.removeAllListeners();
                child.kill();
                return reject(new Error('The executable failed to finish within the timeout specified.'));
            }, this.timeoutMillis);
            child.on('close', (code)=>{
                // Cancel timeout if executable closes before timeout is reached.
                clearTimeout(timeout);
                if (code === 0) {
                    // If the executable completed successfully, try to return the parsed response.
                    try {
                        const responseJson = JSON.parse(output);
                        const response = new executable_response_1.ExecutableResponse(responseJson);
                        return resolve(response);
                    } catch (error) {
                        if (error instanceof executable_response_1.ExecutableResponseError) {
                            return reject(error);
                        }
                        return reject(new executable_response_1.ExecutableResponseError(`The executable returned an invalid response: ${output}`));
                    }
                } else {
                    return reject(new pluggable_auth_client_1.ExecutableError(output, code.toString()));
                }
            });
        });
    }
    /**
     * Checks user provided output file for response from previous run of
     * executable and return the response if it exists, is formatted correctly, and is not expired.
     */ async retrieveCachedResponse() {
        if (!this.outputFile || this.outputFile.length === 0) {
            return undefined;
        }
        let filePath;
        try {
            filePath = await fs.promises.realpath(this.outputFile);
        } catch (_a) {
            // If file path cannot be resolved, return undefined.
            return undefined;
        }
        if (!(await fs.promises.lstat(filePath)).isFile()) {
            // If path does not lead to file, return undefined.
            return undefined;
        }
        const responseString = await fs.promises.readFile(filePath, {
            encoding: 'utf8'
        });
        if (responseString === '') {
            return undefined;
        }
        try {
            const responseJson = JSON.parse(responseString);
            const response = new executable_response_1.ExecutableResponse(responseJson);
            // Check if response is successful and unexpired.
            if (response.isValid()) {
                return new executable_response_1.ExecutableResponse(responseJson);
            }
            return undefined;
        } catch (error) {
            if (error instanceof executable_response_1.ExecutableResponseError) {
                throw error;
            }
            throw new executable_response_1.ExecutableResponseError(`The output file contained an invalid response: ${responseString}`);
        }
    }
    /**
     * Parses given command string into component array, splitting on spaces unless
     * spaces are between quotation marks.
     */ static parseCommand(command) {
        // Split the command into components by splitting on spaces,
        // unless spaces are contained in quotation marks.
        const components = command.match(/(?:[^\s"]+|"[^"]*")+/g);
        if (!components) {
            throw new Error(`Provided command: "${command}" could not be parsed.`);
        }
        // Remove quotation marks from the beginning and end of each component if they are present.
        for(let i = 0; i < components.length; i++){
            if (components[i][0] === '"' && components[i].slice(-1) === '"') {
                components[i] = components[i].slice(1, -1);
            }
        }
        return components;
    }
}
exports.PluggableAuthHandler = PluggableAuthHandler;
}}),
"[project]/node_modules/.pnpm/google-auth-library@9.15.0_encoding@0.1.13/node_modules/google-auth-library/build/src/auth/pluggable-auth-client.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
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
Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.PluggableAuthClient = exports.ExecutableError = void 0;
const baseexternalclient_1 = __turbopack_require__("[project]/node_modules/.pnpm/google-auth-library@9.15.0_encoding@0.1.13/node_modules/google-auth-library/build/src/auth/baseexternalclient.js [app-rsc] (ecmascript)");
const executable_response_1 = __turbopack_require__("[project]/node_modules/.pnpm/google-auth-library@9.15.0_encoding@0.1.13/node_modules/google-auth-library/build/src/auth/executable-response.js [app-rsc] (ecmascript)");
const pluggable_auth_handler_1 = __turbopack_require__("[project]/node_modules/.pnpm/google-auth-library@9.15.0_encoding@0.1.13/node_modules/google-auth-library/build/src/auth/pluggable-auth-handler.js [app-rsc] (ecmascript)");
/**
 * Error thrown from the executable run by PluggableAuthClient.
 */ class ExecutableError extends Error {
    constructor(message, code){
        super(`The executable failed with exit code: ${code} and error message: ${message}.`);
        this.code = code;
        Object.setPrototypeOf(this, new.target.prototype);
    }
}
exports.ExecutableError = ExecutableError;
/**
 * The default executable timeout when none is provided, in milliseconds.
 */ const DEFAULT_EXECUTABLE_TIMEOUT_MILLIS = 30 * 1000;
/**
 * The minimum allowed executable timeout in milliseconds.
 */ const MINIMUM_EXECUTABLE_TIMEOUT_MILLIS = 5 * 1000;
/**
 * The maximum allowed executable timeout in milliseconds.
 */ const MAXIMUM_EXECUTABLE_TIMEOUT_MILLIS = 120 * 1000;
/**
 * The environment variable to check to see if executable can be run.
 * Value must be set to '1' for the executable to run.
 */ const GOOGLE_EXTERNAL_ACCOUNT_ALLOW_EXECUTABLES = 'GOOGLE_EXTERNAL_ACCOUNT_ALLOW_EXECUTABLES';
/**
 * The maximum currently supported executable version.
 */ const MAXIMUM_EXECUTABLE_VERSION = 1;
/**
 * PluggableAuthClient enables the exchange of workload identity pool external credentials for
 * Google access tokens by retrieving 3rd party tokens through a user supplied executable. These
 * scripts/executables are completely independent of the Google Cloud Auth libraries. These
 * credentials plug into ADC and will call the specified executable to retrieve the 3rd party token
 * to be exchanged for a Google access token.
 *
 * <p>To use these credentials, the GOOGLE_EXTERNAL_ACCOUNT_ALLOW_EXECUTABLES environment variable
 * must be set to '1'. This is for security reasons.
 *
 * <p>Both OIDC and SAML are supported. The executable must adhere to a specific response format
 * defined below.
 *
 * <p>The executable must print out the 3rd party token to STDOUT in JSON format. When an
 * output_file is specified in the credential configuration, the executable must also handle writing the
 * JSON response to this file.
 *
 * <pre>
 * OIDC response sample:
 * {
 *   "version": 1,
 *   "success": true,
 *   "token_type": "urn:ietf:params:oauth:token-type:id_token",
 *   "id_token": "HEADER.PAYLOAD.SIGNATURE",
 *   "expiration_time": 1620433341
 * }
 *
 * SAML2 response sample:
 * {
 *   "version": 1,
 *   "success": true,
 *   "token_type": "urn:ietf:params:oauth:token-type:saml2",
 *   "saml_response": "...",
 *   "expiration_time": 1620433341
 * }
 *
 * Error response sample:
 * {
 *   "version": 1,
 *   "success": false,
 *   "code": "401",
 *   "message": "Error message."
 * }
 * </pre>
 *
 * <p>The "expiration_time" field in the JSON response is only required for successful
 * responses when an output file was specified in the credential configuration
 *
 * <p>The auth libraries will populate certain environment variables that will be accessible by the
 * executable, such as: GOOGLE_EXTERNAL_ACCOUNT_AUDIENCE, GOOGLE_EXTERNAL_ACCOUNT_TOKEN_TYPE,
 * GOOGLE_EXTERNAL_ACCOUNT_INTERACTIVE, GOOGLE_EXTERNAL_ACCOUNT_IMPERSONATED_EMAIL, and
 * GOOGLE_EXTERNAL_ACCOUNT_OUTPUT_FILE.
 *
 * <p>Please see this repositories README for a complete executable request/response specification.
 */ class PluggableAuthClient extends baseexternalclient_1.BaseExternalAccountClient {
    /**
     * Instantiates a PluggableAuthClient instance using the provided JSON
     * object loaded from an external account credentials file.
     * An error is thrown if the credential is not a valid pluggable auth credential.
     * @param options The external account options object typically loaded from
     *   the external account JSON credential file.
     * @param additionalOptions **DEPRECATED, all options are available in the
     *   `options` parameter.** Optional additional behavior customization options.
     *   These currently customize expiration threshold time and whether to retry
     *   on 401/403 API request errors.
     */ constructor(options, additionalOptions){
        super(options, additionalOptions);
        if (!options.credential_source.executable) {
            throw new Error('No valid Pluggable Auth "credential_source" provided.');
        }
        this.command = options.credential_source.executable.command;
        if (!this.command) {
            throw new Error('No valid Pluggable Auth "credential_source" provided.');
        }
        // Check if the provided timeout exists and if it is valid.
        if (options.credential_source.executable.timeout_millis === undefined) {
            this.timeoutMillis = DEFAULT_EXECUTABLE_TIMEOUT_MILLIS;
        } else {
            this.timeoutMillis = options.credential_source.executable.timeout_millis;
            if (this.timeoutMillis < MINIMUM_EXECUTABLE_TIMEOUT_MILLIS || this.timeoutMillis > MAXIMUM_EXECUTABLE_TIMEOUT_MILLIS) {
                throw new Error(`Timeout must be between ${MINIMUM_EXECUTABLE_TIMEOUT_MILLIS} and ` + `${MAXIMUM_EXECUTABLE_TIMEOUT_MILLIS} milliseconds.`);
            }
        }
        this.outputFile = options.credential_source.executable.output_file;
        this.handler = new pluggable_auth_handler_1.PluggableAuthHandler({
            command: this.command,
            timeoutMillis: this.timeoutMillis,
            outputFile: this.outputFile
        });
        this.credentialSourceType = 'executable';
    }
    /**
     * Triggered when an external subject token is needed to be exchanged for a
     * GCP access token via GCP STS endpoint.
     * This uses the `options.credential_source` object to figure out how
     * to retrieve the token using the current environment. In this case,
     * this calls a user provided executable which returns the subject token.
     * The logic is summarized as:
     * 1. Validated that the executable is allowed to run. The
     *    GOOGLE_EXTERNAL_ACCOUNT_ALLOW_EXECUTABLES environment must be set to
     *    1 for security reasons.
     * 2. If an output file is specified by the user, check the file location
     *    for a response. If the file exists and contains a valid response,
     *    return the subject token from the file.
     * 3. Call the provided executable and return response.
     * @return A promise that resolves with the external subject token.
     */ async retrieveSubjectToken() {
        // Check if the executable is allowed to run.
        if (process.env[GOOGLE_EXTERNAL_ACCOUNT_ALLOW_EXECUTABLES] !== '1') {
            throw new Error('Pluggable Auth executables need to be explicitly allowed to run by ' + 'setting the GOOGLE_EXTERNAL_ACCOUNT_ALLOW_EXECUTABLES environment ' + 'Variable to 1.');
        }
        let executableResponse = undefined;
        // Try to get cached executable response from output file.
        if (this.outputFile) {
            executableResponse = await this.handler.retrieveCachedResponse();
        }
        // If no response from output file, call the executable.
        if (!executableResponse) {
            // Set up environment map with required values for the executable.
            const envMap = new Map();
            envMap.set('GOOGLE_EXTERNAL_ACCOUNT_AUDIENCE', this.audience);
            envMap.set('GOOGLE_EXTERNAL_ACCOUNT_TOKEN_TYPE', this.subjectTokenType);
            // Always set to 0 because interactive mode is not supported.
            envMap.set('GOOGLE_EXTERNAL_ACCOUNT_INTERACTIVE', '0');
            if (this.outputFile) {
                envMap.set('GOOGLE_EXTERNAL_ACCOUNT_OUTPUT_FILE', this.outputFile);
            }
            const serviceAccountEmail = this.getServiceAccountEmail();
            if (serviceAccountEmail) {
                envMap.set('GOOGLE_EXTERNAL_ACCOUNT_IMPERSONATED_EMAIL', serviceAccountEmail);
            }
            executableResponse = await this.handler.retrieveResponseFromExecutable(envMap);
        }
        if (executableResponse.version > MAXIMUM_EXECUTABLE_VERSION) {
            throw new Error(`Version of executable is not currently supported, maximum supported version is ${MAXIMUM_EXECUTABLE_VERSION}.`);
        }
        // Check that response was successful.
        if (!executableResponse.success) {
            throw new ExecutableError(executableResponse.errorMessage, executableResponse.errorCode);
        }
        // Check that response contains expiration time if output file was specified.
        if (this.outputFile) {
            if (!executableResponse.expirationTime) {
                throw new executable_response_1.InvalidExpirationTimeFieldError('The executable response must contain the `expiration_time` field for successful responses when an output_file has been specified in the configuration.');
            }
        }
        // Check that response is not expired.
        if (executableResponse.isExpired()) {
            throw new Error('Executable response is expired.');
        }
        // Return subject token from response.
        return executableResponse.subjectToken;
    }
}
exports.PluggableAuthClient = PluggableAuthClient;
}}),
"[project]/node_modules/.pnpm/google-auth-library@9.15.0_encoding@0.1.13/node_modules/google-auth-library/build/src/auth/externalclient.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
// Copyright 2021 Google LLC
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
Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.ExternalAccountClient = void 0;
const baseexternalclient_1 = __turbopack_require__("[project]/node_modules/.pnpm/google-auth-library@9.15.0_encoding@0.1.13/node_modules/google-auth-library/build/src/auth/baseexternalclient.js [app-rsc] (ecmascript)");
const identitypoolclient_1 = __turbopack_require__("[project]/node_modules/.pnpm/google-auth-library@9.15.0_encoding@0.1.13/node_modules/google-auth-library/build/src/auth/identitypoolclient.js [app-rsc] (ecmascript)");
const awsclient_1 = __turbopack_require__("[project]/node_modules/.pnpm/google-auth-library@9.15.0_encoding@0.1.13/node_modules/google-auth-library/build/src/auth/awsclient.js [app-rsc] (ecmascript)");
const pluggable_auth_client_1 = __turbopack_require__("[project]/node_modules/.pnpm/google-auth-library@9.15.0_encoding@0.1.13/node_modules/google-auth-library/build/src/auth/pluggable-auth-client.js [app-rsc] (ecmascript)");
/**
 * Dummy class with no constructor. Developers are expected to use fromJSON.
 */ class ExternalAccountClient {
    constructor(){
        throw new Error('ExternalAccountClients should be initialized via: ' + 'ExternalAccountClient.fromJSON(), ' + 'directly via explicit constructors, eg. ' + 'new AwsClient(options), new IdentityPoolClient(options), new' + 'PluggableAuthClientOptions, or via ' + 'new GoogleAuth(options).getClient()');
    }
    /**
     * This static method will instantiate the
     * corresponding type of external account credential depending on the
     * underlying credential source.
     * @param options The external account options object typically loaded
     *   from the external account JSON credential file.
     * @param additionalOptions **DEPRECATED, all options are available in the
     *   `options` parameter.** Optional additional behavior customization options.
     *   These currently customize expiration threshold time and whether to retry
     *   on 401/403 API request errors.
     * @return A BaseExternalAccountClient instance or null if the options
     *   provided do not correspond to an external account credential.
     */ static fromJSON(options, additionalOptions) {
        var _a, _b;
        if (options && options.type === baseexternalclient_1.EXTERNAL_ACCOUNT_TYPE) {
            if ((_a = options.credential_source) === null || _a === void 0 ? void 0 : _a.environment_id) {
                return new awsclient_1.AwsClient(options, additionalOptions);
            } else if ((_b = options.credential_source) === null || _b === void 0 ? void 0 : _b.executable) {
                return new pluggable_auth_client_1.PluggableAuthClient(options, additionalOptions);
            } else {
                return new identitypoolclient_1.IdentityPoolClient(options, additionalOptions);
            }
        } else {
            return null;
        }
    }
}
exports.ExternalAccountClient = ExternalAccountClient;
}}),
"[project]/node_modules/.pnpm/google-auth-library@9.15.0_encoding@0.1.13/node_modules/google-auth-library/build/src/auth/externalAccountAuthorizedUserClient.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
// Copyright 2023 Google LLC
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
Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.ExternalAccountAuthorizedUserClient = exports.EXTERNAL_ACCOUNT_AUTHORIZED_USER_TYPE = void 0;
const authclient_1 = __turbopack_require__("[project]/node_modules/.pnpm/google-auth-library@9.15.0_encoding@0.1.13/node_modules/google-auth-library/build/src/auth/authclient.js [app-rsc] (ecmascript)");
const oauth2common_1 = __turbopack_require__("[project]/node_modules/.pnpm/google-auth-library@9.15.0_encoding@0.1.13/node_modules/google-auth-library/build/src/auth/oauth2common.js [app-rsc] (ecmascript)");
const gaxios_1 = __turbopack_require__("[project]/node_modules/.pnpm/gaxios@6.7.1_encoding@0.1.13/node_modules/gaxios/build/src/index.js [app-rsc] (ecmascript)");
const stream = __turbopack_require__("[externals]/ [external] (stream, cjs)");
const baseexternalclient_1 = __turbopack_require__("[project]/node_modules/.pnpm/google-auth-library@9.15.0_encoding@0.1.13/node_modules/google-auth-library/build/src/auth/baseexternalclient.js [app-rsc] (ecmascript)");
/**
 * The credentials JSON file type for external account authorized user clients.
 */ exports.EXTERNAL_ACCOUNT_AUTHORIZED_USER_TYPE = 'external_account_authorized_user';
const DEFAULT_TOKEN_URL = 'https://sts.{universeDomain}/v1/oauthtoken';
/**
 * Handler for token refresh requests sent to the token_url endpoint for external
 * authorized user credentials.
 */ class ExternalAccountAuthorizedUserHandler extends oauth2common_1.OAuthClientAuthHandler {
    /**
     * Initializes an ExternalAccountAuthorizedUserHandler instance.
     * @param url The URL of the token refresh endpoint.
     * @param transporter The transporter to use for the refresh request.
     * @param clientAuthentication The client authentication credentials to use
     *   for the refresh request.
     */ constructor(url, transporter, clientAuthentication){
        super(clientAuthentication);
        this.url = url;
        this.transporter = transporter;
    }
    /**
     * Requests a new access token from the token_url endpoint using the provided
     *   refresh token.
     * @param refreshToken The refresh token to use to generate a new access token.
     * @param additionalHeaders Optional additional headers to pass along the
     *   request.
     * @return A promise that resolves with the token refresh response containing
     *   the requested access token and its expiration time.
     */ async refreshToken(refreshToken, additionalHeaders) {
        const values = new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: refreshToken
        });
        const headers = {
            'Content-Type': 'application/x-www-form-urlencoded',
            ...additionalHeaders
        };
        const opts = {
            ...ExternalAccountAuthorizedUserHandler.RETRY_CONFIG,
            url: this.url,
            method: 'POST',
            headers,
            data: values.toString(),
            responseType: 'json'
        };
        // Apply OAuth client authentication.
        this.applyClientAuthenticationOptions(opts);
        try {
            const response = await this.transporter.request(opts);
            // Successful response.
            const tokenRefreshResponse = response.data;
            tokenRefreshResponse.res = response;
            return tokenRefreshResponse;
        } catch (error) {
            // Translate error to OAuthError.
            if (error instanceof gaxios_1.GaxiosError && error.response) {
                throw (0, oauth2common_1.getErrorFromOAuthErrorResponse)(error.response.data, // Preserve other fields from the original error.
                error);
            }
            // Request could fail before the server responds.
            throw error;
        }
    }
}
/**
 * External Account Authorized User Client. This is used for OAuth2 credentials
 * sourced using external identities through Workforce Identity Federation.
 * Obtaining the initial access and refresh token can be done through the
 * Google Cloud CLI.
 */ class ExternalAccountAuthorizedUserClient extends authclient_1.AuthClient {
    /**
     * Instantiates an ExternalAccountAuthorizedUserClient instances using the
     * provided JSON object loaded from a credentials files.
     * An error is throws if the credential is not valid.
     * @param options The external account authorized user option object typically
     *   from the external accoutn authorized user JSON credential file.
     * @param additionalOptions **DEPRECATED, all options are available in the
     *   `options` parameter.** Optional additional behavior customization options.
     *   These currently customize expiration threshold time and whether to retry
     *   on 401/403 API request errors.
     */ constructor(options, additionalOptions){
        var _a;
        super({
            ...options,
            ...additionalOptions
        });
        if (options.universe_domain) {
            this.universeDomain = options.universe_domain;
        }
        this.refreshToken = options.refresh_token;
        const clientAuth = {
            confidentialClientType: 'basic',
            clientId: options.client_id,
            clientSecret: options.client_secret
        };
        this.externalAccountAuthorizedUserHandler = new ExternalAccountAuthorizedUserHandler((_a = options.token_url) !== null && _a !== void 0 ? _a : DEFAULT_TOKEN_URL.replace('{universeDomain}', this.universeDomain), this.transporter, clientAuth);
        this.cachedAccessToken = null;
        this.quotaProjectId = options.quota_project_id;
        // As threshold could be zero,
        // eagerRefreshThresholdMillis || EXPIRATION_TIME_OFFSET will override the
        // zero value.
        if (typeof (additionalOptions === null || additionalOptions === void 0 ? void 0 : additionalOptions.eagerRefreshThresholdMillis) !== 'number') {
            this.eagerRefreshThresholdMillis = baseexternalclient_1.EXPIRATION_TIME_OFFSET;
        } else {
            this.eagerRefreshThresholdMillis = additionalOptions.eagerRefreshThresholdMillis;
        }
        this.forceRefreshOnFailure = !!(additionalOptions === null || additionalOptions === void 0 ? void 0 : additionalOptions.forceRefreshOnFailure);
    }
    async getAccessToken() {
        // If cached access token is unavailable or expired, force refresh.
        if (!this.cachedAccessToken || this.isExpired(this.cachedAccessToken)) {
            await this.refreshAccessTokenAsync();
        }
        // Return GCP access token in GetAccessTokenResponse format.
        return {
            token: this.cachedAccessToken.access_token,
            res: this.cachedAccessToken.res
        };
    }
    async getRequestHeaders() {
        const accessTokenResponse = await this.getAccessToken();
        const headers = {
            Authorization: `Bearer ${accessTokenResponse.token}`
        };
        return this.addSharedMetadataHeaders(headers);
    }
    request(opts, callback) {
        if (callback) {
            this.requestAsync(opts).then((r)=>callback(null, r), (e)=>{
                return callback(e, e.response);
            });
        } else {
            return this.requestAsync(opts);
        }
    }
    /**
     * Authenticates the provided HTTP request, processes it and resolves with the
     * returned response.
     * @param opts The HTTP request options.
     * @param reAuthRetried Whether the current attempt is a retry after a failed attempt due to an auth failure.
     * @return A promise that resolves with the successful response.
     */ async requestAsync(opts, reAuthRetried = false) {
        let response;
        try {
            const requestHeaders = await this.getRequestHeaders();
            opts.headers = opts.headers || {};
            if (requestHeaders && requestHeaders['x-goog-user-project']) {
                opts.headers['x-goog-user-project'] = requestHeaders['x-goog-user-project'];
            }
            if (requestHeaders && requestHeaders.Authorization) {
                opts.headers.Authorization = requestHeaders.Authorization;
            }
            response = await this.transporter.request(opts);
        } catch (e) {
            const res = e.response;
            if (res) {
                const statusCode = res.status;
                // Retry the request for metadata if the following criteria are true:
                // - We haven't already retried.  It only makes sense to retry once.
                // - The response was a 401 or a 403
                // - The request didn't send a readableStream
                // - forceRefreshOnFailure is true
                const isReadableStream = res.config.data instanceof stream.Readable;
                const isAuthErr = statusCode === 401 || statusCode === 403;
                if (!reAuthRetried && isAuthErr && !isReadableStream && this.forceRefreshOnFailure) {
                    await this.refreshAccessTokenAsync();
                    return await this.requestAsync(opts, true);
                }
            }
            throw e;
        }
        return response;
    }
    /**
     * Forces token refresh, even if unexpired tokens are currently cached.
     * @return A promise that resolves with the refreshed credential.
     */ async refreshAccessTokenAsync() {
        // Refresh the access token using the refresh token.
        const refreshResponse = await this.externalAccountAuthorizedUserHandler.refreshToken(this.refreshToken);
        this.cachedAccessToken = {
            access_token: refreshResponse.access_token,
            expiry_date: new Date().getTime() + refreshResponse.expires_in * 1000,
            res: refreshResponse.res
        };
        if (refreshResponse.refresh_token !== undefined) {
            this.refreshToken = refreshResponse.refresh_token;
        }
        return this.cachedAccessToken;
    }
    /**
     * Returns whether the provided credentials are expired or not.
     * If there is no expiry time, assumes the token is not expired or expiring.
     * @param credentials The credentials to check for expiration.
     * @return Whether the credentials are expired or not.
     */ isExpired(credentials) {
        const now = new Date().getTime();
        return credentials.expiry_date ? now >= credentials.expiry_date - this.eagerRefreshThresholdMillis : false;
    }
}
exports.ExternalAccountAuthorizedUserClient = ExternalAccountAuthorizedUserClient;
}}),
"[project]/node_modules/.pnpm/google-auth-library@9.15.0_encoding@0.1.13/node_modules/google-auth-library/build/src/auth/googleauth.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
// Copyright 2019 Google LLC
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
var __classPrivateFieldGet = this && this.__classPrivateFieldGet || function(receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var __classPrivateFieldSet = this && this.__classPrivateFieldSet || function(receiver, state, value, kind, f) {
    if (kind === "m") throw new TypeError("Private method is not writable");
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
    return kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value), value;
};
var _GoogleAuth_instances, _GoogleAuth_pendingAuthClient, _GoogleAuth_prepareAndCacheClient, _GoogleAuth_determineClient;
Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.GoogleAuth = exports.GoogleAuthExceptionMessages = exports.CLOUD_SDK_CLIENT_ID = void 0;
const child_process_1 = __turbopack_require__("[externals]/ [external] (child_process, cjs)");
const fs = __turbopack_require__("[externals]/ [external] (fs, cjs)");
const gcpMetadata = __turbopack_require__("[project]/node_modules/.pnpm/gcp-metadata@6.1.0_encoding@0.1.13/node_modules/gcp-metadata/build/src/index.js [app-rsc] (ecmascript)");
const os = __turbopack_require__("[externals]/ [external] (os, cjs)");
const path = __turbopack_require__("[externals]/ [external] (path, cjs)");
const crypto_1 = __turbopack_require__("[project]/node_modules/.pnpm/google-auth-library@9.15.0_encoding@0.1.13/node_modules/google-auth-library/build/src/crypto/crypto.js [app-rsc] (ecmascript)");
const transporters_1 = __turbopack_require__("[project]/node_modules/.pnpm/google-auth-library@9.15.0_encoding@0.1.13/node_modules/google-auth-library/build/src/transporters.js [app-rsc] (ecmascript)");
const computeclient_1 = __turbopack_require__("[project]/node_modules/.pnpm/google-auth-library@9.15.0_encoding@0.1.13/node_modules/google-auth-library/build/src/auth/computeclient.js [app-rsc] (ecmascript)");
const idtokenclient_1 = __turbopack_require__("[project]/node_modules/.pnpm/google-auth-library@9.15.0_encoding@0.1.13/node_modules/google-auth-library/build/src/auth/idtokenclient.js [app-rsc] (ecmascript)");
const envDetect_1 = __turbopack_require__("[project]/node_modules/.pnpm/google-auth-library@9.15.0_encoding@0.1.13/node_modules/google-auth-library/build/src/auth/envDetect.js [app-rsc] (ecmascript)");
const jwtclient_1 = __turbopack_require__("[project]/node_modules/.pnpm/google-auth-library@9.15.0_encoding@0.1.13/node_modules/google-auth-library/build/src/auth/jwtclient.js [app-rsc] (ecmascript)");
const refreshclient_1 = __turbopack_require__("[project]/node_modules/.pnpm/google-auth-library@9.15.0_encoding@0.1.13/node_modules/google-auth-library/build/src/auth/refreshclient.js [app-rsc] (ecmascript)");
const impersonated_1 = __turbopack_require__("[project]/node_modules/.pnpm/google-auth-library@9.15.0_encoding@0.1.13/node_modules/google-auth-library/build/src/auth/impersonated.js [app-rsc] (ecmascript)");
const externalclient_1 = __turbopack_require__("[project]/node_modules/.pnpm/google-auth-library@9.15.0_encoding@0.1.13/node_modules/google-auth-library/build/src/auth/externalclient.js [app-rsc] (ecmascript)");
const baseexternalclient_1 = __turbopack_require__("[project]/node_modules/.pnpm/google-auth-library@9.15.0_encoding@0.1.13/node_modules/google-auth-library/build/src/auth/baseexternalclient.js [app-rsc] (ecmascript)");
const authclient_1 = __turbopack_require__("[project]/node_modules/.pnpm/google-auth-library@9.15.0_encoding@0.1.13/node_modules/google-auth-library/build/src/auth/authclient.js [app-rsc] (ecmascript)");
const externalAccountAuthorizedUserClient_1 = __turbopack_require__("[project]/node_modules/.pnpm/google-auth-library@9.15.0_encoding@0.1.13/node_modules/google-auth-library/build/src/auth/externalAccountAuthorizedUserClient.js [app-rsc] (ecmascript)");
const util_1 = __turbopack_require__("[project]/node_modules/.pnpm/google-auth-library@9.15.0_encoding@0.1.13/node_modules/google-auth-library/build/src/util.js [app-rsc] (ecmascript)");
exports.CLOUD_SDK_CLIENT_ID = '764086051850-6qr4p6gpi6hn506pt8ejuq83di341hur.apps.googleusercontent.com';
exports.GoogleAuthExceptionMessages = {
    API_KEY_WITH_CREDENTIALS: 'API Keys and Credentials are mutually exclusive authentication methods and cannot be used together.',
    NO_PROJECT_ID_FOUND: 'Unable to detect a Project Id in the current environment. \n' + 'To learn more about authentication and Google APIs, visit: \n' + 'https://cloud.google.com/docs/authentication/getting-started',
    NO_CREDENTIALS_FOUND: 'Unable to find credentials in current environment. \n' + 'To learn more about authentication and Google APIs, visit: \n' + 'https://cloud.google.com/docs/authentication/getting-started',
    NO_ADC_FOUND: 'Could not load the default credentials. Browse to https://cloud.google.com/docs/authentication/getting-started for more information.',
    NO_UNIVERSE_DOMAIN_FOUND: 'Unable to detect a Universe Domain in the current environment.\n' + 'To learn more about Universe Domain retrieval, visit: \n' + 'https://cloud.google.com/compute/docs/metadata/predefined-metadata-keys'
};
class GoogleAuth {
    // Note:  this properly is only public to satisfy unit tests.
    // https://github.com/Microsoft/TypeScript/issues/5228
    get isGCE() {
        return this.checkIsGCE;
    }
    /**
     * Configuration is resolved in the following order of precedence:
     * - {@link GoogleAuthOptions.credentials `credentials`}
     * - {@link GoogleAuthOptions.keyFilename `keyFilename`}
     * - {@link GoogleAuthOptions.keyFile `keyFile`}
     *
     * {@link GoogleAuthOptions.clientOptions `clientOptions`} are passed to the
     * {@link AuthClient `AuthClient`s}.
     *
     * @param opts
     */ constructor(opts = {}){
        _GoogleAuth_instances.add(this);
        /**
         * Caches a value indicating whether the auth layer is running on Google
         * Compute Engine.
         * @private
         */ this.checkIsGCE = undefined;
        // To save the contents of the JSON credential file
        this.jsonContent = null;
        this.cachedCredential = null;
        /**
         * A pending {@link AuthClient}. Used for concurrent {@link GoogleAuth.getClient} calls.
         */ _GoogleAuth_pendingAuthClient.set(this, null);
        this.clientOptions = {};
        this._cachedProjectId = opts.projectId || null;
        this.cachedCredential = opts.authClient || null;
        this.keyFilename = opts.keyFilename || opts.keyFile;
        this.scopes = opts.scopes;
        this.clientOptions = opts.clientOptions || {};
        this.jsonContent = opts.credentials || null;
        this.apiKey = opts.apiKey || this.clientOptions.apiKey || null;
        // Cannot use both API Key + Credentials
        if (this.apiKey && (this.jsonContent || this.clientOptions.credentials)) {
            throw new RangeError(exports.GoogleAuthExceptionMessages.API_KEY_WITH_CREDENTIALS);
        }
        if (opts.universeDomain) {
            this.clientOptions.universeDomain = opts.universeDomain;
        }
    }
    // GAPIC client libraries should always use self-signed JWTs. The following
    // variables are set on the JWT client in order to indicate the type of library,
    // and sign the JWT with the correct audience and scopes (if not supplied).
    setGapicJWTValues(client) {
        client.defaultServicePath = this.defaultServicePath;
        client.useJWTAccessWithScope = this.useJWTAccessWithScope;
        client.defaultScopes = this.defaultScopes;
    }
    getProjectId(callback) {
        if (callback) {
            this.getProjectIdAsync().then((r)=>callback(null, r), callback);
        } else {
            return this.getProjectIdAsync();
        }
    }
    /**
     * A temporary method for internal `getProjectId` usages where `null` is
     * acceptable. In a future major release, `getProjectId` should return `null`
     * (as the `Promise<string | null>` base signature describes) and this private
     * method should be removed.
     *
     * @returns Promise that resolves with project id (or `null`)
     */ async getProjectIdOptional() {
        try {
            return await this.getProjectId();
        } catch (e) {
            if (e instanceof Error && e.message === exports.GoogleAuthExceptionMessages.NO_PROJECT_ID_FOUND) {
                return null;
            } else {
                throw e;
            }
        }
    }
    /**
     * A private method for finding and caching a projectId.
     *
     * Supports environments in order of precedence:
     * - GCLOUD_PROJECT or GOOGLE_CLOUD_PROJECT environment variable
     * - GOOGLE_APPLICATION_CREDENTIALS JSON file
     * - Cloud SDK: `gcloud config config-helper --format json`
     * - GCE project ID from metadata server
     *
     * @returns projectId
     */ async findAndCacheProjectId() {
        let projectId = null;
        projectId || (projectId = await this.getProductionProjectId());
        projectId || (projectId = await this.getFileProjectId());
        projectId || (projectId = await this.getDefaultServiceProjectId());
        projectId || (projectId = await this.getGCEProjectId());
        projectId || (projectId = await this.getExternalAccountClientProjectId());
        if (projectId) {
            this._cachedProjectId = projectId;
            return projectId;
        } else {
            throw new Error(exports.GoogleAuthExceptionMessages.NO_PROJECT_ID_FOUND);
        }
    }
    async getProjectIdAsync() {
        if (this._cachedProjectId) {
            return this._cachedProjectId;
        }
        if (!this._findProjectIdPromise) {
            this._findProjectIdPromise = this.findAndCacheProjectId();
        }
        return this._findProjectIdPromise;
    }
    /**
     * Retrieves a universe domain from the metadata server via
     * {@link gcpMetadata.universe}.
     *
     * @returns a universe domain
     */ async getUniverseDomainFromMetadataServer() {
        var _a;
        let universeDomain;
        try {
            universeDomain = await gcpMetadata.universe('universe-domain');
            universeDomain || (universeDomain = authclient_1.DEFAULT_UNIVERSE);
        } catch (e) {
            if (e && ((_a = e === null || e === void 0 ? void 0 : e.response) === null || _a === void 0 ? void 0 : _a.status) === 404) {
                universeDomain = authclient_1.DEFAULT_UNIVERSE;
            } else {
                throw e;
            }
        }
        return universeDomain;
    }
    /**
     * Retrieves, caches, and returns the universe domain in the following order
     * of precedence:
     * - The universe domain in {@link GoogleAuth.clientOptions}
     * - An existing or ADC {@link AuthClient}'s universe domain
     * - {@link gcpMetadata.universe}, if {@link Compute} client
     *
     * @returns The universe domain
     */ async getUniverseDomain() {
        let universeDomain = (0, util_1.originalOrCamelOptions)(this.clientOptions).get('universe_domain');
        try {
            universeDomain !== null && universeDomain !== void 0 ? universeDomain : universeDomain = (await this.getClient()).universeDomain;
        } catch (_a) {
            // client or ADC is not available
            universeDomain !== null && universeDomain !== void 0 ? universeDomain : universeDomain = authclient_1.DEFAULT_UNIVERSE;
        }
        return universeDomain;
    }
    /**
     * @returns Any scopes (user-specified or default scopes specified by the
     *   client library) that need to be set on the current Auth client.
     */ getAnyScopes() {
        return this.scopes || this.defaultScopes;
    }
    getApplicationDefault(optionsOrCallback = {}, callback) {
        let options;
        if (typeof optionsOrCallback === 'function') {
            callback = optionsOrCallback;
        } else {
            options = optionsOrCallback;
        }
        if (callback) {
            this.getApplicationDefaultAsync(options).then((r)=>callback(null, r.credential, r.projectId), callback);
        } else {
            return this.getApplicationDefaultAsync(options);
        }
    }
    async getApplicationDefaultAsync(options = {}) {
        // If we've already got a cached credential, return it.
        // This will also preserve one's configured quota project, in case they
        // set one directly on the credential previously.
        if (this.cachedCredential) {
            // cache, while preserving existing quota project preferences
            return await __classPrivateFieldGet(this, _GoogleAuth_instances, "m", _GoogleAuth_prepareAndCacheClient).call(this, this.cachedCredential, null);
        }
        let credential;
        // Check for the existence of a local environment variable pointing to the
        // location of the credential file. This is typically used in local
        // developer scenarios.
        credential = await this._tryGetApplicationCredentialsFromEnvironmentVariable(options);
        if (credential) {
            if (credential instanceof jwtclient_1.JWT) {
                credential.scopes = this.scopes;
            } else if (credential instanceof baseexternalclient_1.BaseExternalAccountClient) {
                credential.scopes = this.getAnyScopes();
            }
            return await __classPrivateFieldGet(this, _GoogleAuth_instances, "m", _GoogleAuth_prepareAndCacheClient).call(this, credential);
        }
        // Look in the well-known credential file location.
        credential = await this._tryGetApplicationCredentialsFromWellKnownFile(options);
        if (credential) {
            if (credential instanceof jwtclient_1.JWT) {
                credential.scopes = this.scopes;
            } else if (credential instanceof baseexternalclient_1.BaseExternalAccountClient) {
                credential.scopes = this.getAnyScopes();
            }
            return await __classPrivateFieldGet(this, _GoogleAuth_instances, "m", _GoogleAuth_prepareAndCacheClient).call(this, credential);
        }
        // Determine if we're running on GCE.
        if (await this._checkIsGCE()) {
            options.scopes = this.getAnyScopes();
            return await __classPrivateFieldGet(this, _GoogleAuth_instances, "m", _GoogleAuth_prepareAndCacheClient).call(this, new computeclient_1.Compute(options));
        }
        throw new Error(exports.GoogleAuthExceptionMessages.NO_ADC_FOUND);
    }
    /**
     * Determines whether the auth layer is running on Google Compute Engine.
     * Checks for GCP Residency, then fallback to checking if metadata server
     * is available.
     *
     * @returns A promise that resolves with the boolean.
     * @api private
     */ async _checkIsGCE() {
        if (this.checkIsGCE === undefined) {
            this.checkIsGCE = gcpMetadata.getGCPResidency() || await gcpMetadata.isAvailable();
        }
        return this.checkIsGCE;
    }
    /**
     * Attempts to load default credentials from the environment variable path..
     * @returns Promise that resolves with the OAuth2Client or null.
     * @api private
     */ async _tryGetApplicationCredentialsFromEnvironmentVariable(options) {
        const credentialsPath = process.env['GOOGLE_APPLICATION_CREDENTIALS'] || process.env['google_application_credentials'];
        if (!credentialsPath || credentialsPath.length === 0) {
            return null;
        }
        try {
            return this._getApplicationCredentialsFromFilePath(credentialsPath, options);
        } catch (e) {
            if (e instanceof Error) {
                e.message = `Unable to read the credential file specified by the GOOGLE_APPLICATION_CREDENTIALS environment variable: ${e.message}`;
            }
            throw e;
        }
    }
    /**
     * Attempts to load default credentials from a well-known file location
     * @return Promise that resolves with the OAuth2Client or null.
     * @api private
     */ async _tryGetApplicationCredentialsFromWellKnownFile(options) {
        // First, figure out the location of the file, depending upon the OS type.
        let location = null;
        if (this._isWindows()) {
            // Windows
            location = process.env['APPDATA'];
        } else {
            // Linux or Mac
            const home = process.env['HOME'];
            if (home) {
                location = path.join(home, '.config');
            }
        }
        // If we found the root path, expand it.
        if (location) {
            location = path.join(location, 'gcloud', 'application_default_credentials.json');
            if (!fs.existsSync(location)) {
                location = null;
            }
        }
        // The file does not exist.
        if (!location) {
            return null;
        }
        // The file seems to exist. Try to use it.
        const client = await this._getApplicationCredentialsFromFilePath(location, options);
        return client;
    }
    /**
     * Attempts to load default credentials from a file at the given path..
     * @param filePath The path to the file to read.
     * @returns Promise that resolves with the OAuth2Client
     * @api private
     */ async _getApplicationCredentialsFromFilePath(filePath, options = {}) {
        // Make sure the path looks like a string.
        if (!filePath || filePath.length === 0) {
            throw new Error('The file path is invalid.');
        }
        // Make sure there is a file at the path. lstatSync will throw if there is
        // nothing there.
        try {
            // Resolve path to actual file in case of symlink. Expect a thrown error
            // if not resolvable.
            filePath = fs.realpathSync(filePath);
            if (!fs.lstatSync(filePath).isFile()) {
                throw new Error();
            }
        } catch (err) {
            if (err instanceof Error) {
                err.message = `The file at ${filePath} does not exist, or it is not a file. ${err.message}`;
            }
            throw err;
        }
        // Now open a read stream on the file, and parse it.
        const readStream = fs.createReadStream(filePath);
        return this.fromStream(readStream, options);
    }
    /**
     * Create a credentials instance using a given impersonated input options.
     * @param json The impersonated input object.
     * @returns JWT or UserRefresh Client with data
     */ fromImpersonatedJSON(json) {
        var _a, _b, _c, _d;
        if (!json) {
            throw new Error('Must pass in a JSON object containing an  impersonated refresh token');
        }
        if (json.type !== impersonated_1.IMPERSONATED_ACCOUNT_TYPE) {
            throw new Error(`The incoming JSON object does not have the "${impersonated_1.IMPERSONATED_ACCOUNT_TYPE}" type`);
        }
        if (!json.source_credentials) {
            throw new Error('The incoming JSON object does not contain a source_credentials field');
        }
        if (!json.service_account_impersonation_url) {
            throw new Error('The incoming JSON object does not contain a service_account_impersonation_url field');
        }
        const sourceClient = this.fromJSON(json.source_credentials);
        if (((_a = json.service_account_impersonation_url) === null || _a === void 0 ? void 0 : _a.length) > 256) {
            /**
             * Prevents DOS attacks.
             * @see {@link https://github.com/googleapis/google-auth-library-nodejs/security/code-scanning/85}
             **/ throw new RangeError(`Target principal is too long: ${json.service_account_impersonation_url}`);
        }
        // Extract service account from service_account_impersonation_url
        const targetPrincipal = (_c = (_b = /(?<target>[^/]+):(generateAccessToken|generateIdToken)$/.exec(json.service_account_impersonation_url)) === null || _b === void 0 ? void 0 : _b.groups) === null || _c === void 0 ? void 0 : _c.target;
        if (!targetPrincipal) {
            throw new RangeError(`Cannot extract target principal from ${json.service_account_impersonation_url}`);
        }
        const targetScopes = (_d = this.getAnyScopes()) !== null && _d !== void 0 ? _d : [];
        return new impersonated_1.Impersonated({
            ...json,
            sourceClient,
            targetPrincipal,
            targetScopes: Array.isArray(targetScopes) ? targetScopes : [
                targetScopes
            ]
        });
    }
    /**
     * Create a credentials instance using the given input options.
     * This client is not cached.
     *
     * @param json The input object.
     * @param options The JWT or UserRefresh options for the client
     * @returns JWT or UserRefresh Client with data
     */ fromJSON(json, options = {}) {
        let client;
        // user's preferred universe domain
        const preferredUniverseDomain = (0, util_1.originalOrCamelOptions)(options).get('universe_domain');
        if (json.type === refreshclient_1.USER_REFRESH_ACCOUNT_TYPE) {
            client = new refreshclient_1.UserRefreshClient(options);
            client.fromJSON(json);
        } else if (json.type === impersonated_1.IMPERSONATED_ACCOUNT_TYPE) {
            client = this.fromImpersonatedJSON(json);
        } else if (json.type === baseexternalclient_1.EXTERNAL_ACCOUNT_TYPE) {
            client = externalclient_1.ExternalAccountClient.fromJSON(json, options);
            client.scopes = this.getAnyScopes();
        } else if (json.type === externalAccountAuthorizedUserClient_1.EXTERNAL_ACCOUNT_AUTHORIZED_USER_TYPE) {
            client = new externalAccountAuthorizedUserClient_1.ExternalAccountAuthorizedUserClient(json, options);
        } else {
            options.scopes = this.scopes;
            client = new jwtclient_1.JWT(options);
            this.setGapicJWTValues(client);
            client.fromJSON(json);
        }
        if (preferredUniverseDomain) {
            client.universeDomain = preferredUniverseDomain;
        }
        return client;
    }
    /**
     * Return a JWT or UserRefreshClient from JavaScript object, caching both the
     * object used to instantiate and the client.
     * @param json The input object.
     * @param options The JWT or UserRefresh options for the client
     * @returns JWT or UserRefresh Client with data
     */ _cacheClientFromJSON(json, options) {
        const client = this.fromJSON(json, options);
        // cache both raw data used to instantiate client and client itself.
        this.jsonContent = json;
        this.cachedCredential = client;
        return client;
    }
    fromStream(inputStream, optionsOrCallback = {}, callback) {
        let options = {};
        if (typeof optionsOrCallback === 'function') {
            callback = optionsOrCallback;
        } else {
            options = optionsOrCallback;
        }
        if (callback) {
            this.fromStreamAsync(inputStream, options).then((r)=>callback(null, r), callback);
        } else {
            return this.fromStreamAsync(inputStream, options);
        }
    }
    fromStreamAsync(inputStream, options) {
        return new Promise((resolve, reject)=>{
            if (!inputStream) {
                throw new Error('Must pass in a stream containing the Google auth settings.');
            }
            const chunks = [];
            inputStream.setEncoding('utf8').on('error', reject).on('data', (chunk)=>chunks.push(chunk)).on('end', ()=>{
                try {
                    try {
                        const data = JSON.parse(chunks.join(''));
                        const r = this._cacheClientFromJSON(data, options);
                        return resolve(r);
                    } catch (err) {
                        // If we failed parsing this.keyFileName, assume that it
                        // is a PEM or p12 certificate:
                        if (!this.keyFilename) throw err;
                        const client = new jwtclient_1.JWT({
                            ...this.clientOptions,
                            keyFile: this.keyFilename
                        });
                        this.cachedCredential = client;
                        this.setGapicJWTValues(client);
                        return resolve(client);
                    }
                } catch (err) {
                    return reject(err);
                }
            });
        });
    }
    /**
     * Create a credentials instance using the given API key string.
     * The created client is not cached. In order to create and cache it use the {@link GoogleAuth.getClient `getClient`} method after first providing an {@link GoogleAuth.apiKey `apiKey`}.
     *
     * @param apiKey The API key string
     * @param options An optional options object.
     * @returns A JWT loaded from the key
     */ fromAPIKey(apiKey, options = {}) {
        return new jwtclient_1.JWT({
            ...options,
            apiKey
        });
    }
    /**
     * Determines whether the current operating system is Windows.
     * @api private
     */ _isWindows() {
        const sys = os.platform();
        if (sys && sys.length >= 3) {
            if (sys.substring(0, 3).toLowerCase() === 'win') {
                return true;
            }
        }
        return false;
    }
    /**
     * Run the Google Cloud SDK command that prints the default project ID
     */ async getDefaultServiceProjectId() {
        return new Promise((resolve)=>{
            (0, child_process_1.exec)('gcloud config config-helper --format json', (err, stdout)=>{
                if (!err && stdout) {
                    try {
                        const projectId = JSON.parse(stdout).configuration.properties.core.project;
                        resolve(projectId);
                        return;
                    } catch (e) {
                    // ignore errors
                    }
                }
                resolve(null);
            });
        });
    }
    /**
     * Loads the project id from environment variables.
     * @api private
     */ getProductionProjectId() {
        return process.env['GCLOUD_PROJECT'] || process.env['GOOGLE_CLOUD_PROJECT'] || process.env['gcloud_project'] || process.env['google_cloud_project'];
    }
    /**
     * Loads the project id from the GOOGLE_APPLICATION_CREDENTIALS json file.
     * @api private
     */ async getFileProjectId() {
        if (this.cachedCredential) {
            // Try to read the project ID from the cached credentials file
            return this.cachedCredential.projectId;
        }
        // Ensure the projectId is loaded from the keyFile if available.
        if (this.keyFilename) {
            const creds = await this.getClient();
            if (creds && creds.projectId) {
                return creds.projectId;
            }
        }
        // Try to load a credentials file and read its project ID
        const r = await this._tryGetApplicationCredentialsFromEnvironmentVariable();
        if (r) {
            return r.projectId;
        } else {
            return null;
        }
    }
    /**
     * Gets the project ID from external account client if available.
     */ async getExternalAccountClientProjectId() {
        if (!this.jsonContent || this.jsonContent.type !== baseexternalclient_1.EXTERNAL_ACCOUNT_TYPE) {
            return null;
        }
        const creds = await this.getClient();
        // Do not suppress the underlying error, as the error could contain helpful
        // information for debugging and fixing. This is especially true for
        // external account creds as in order to get the project ID, the following
        // operations have to succeed:
        // 1. Valid credentials file should be supplied.
        // 2. Ability to retrieve access tokens from STS token exchange API.
        // 3. Ability to exchange for service account impersonated credentials (if
        //    enabled).
        // 4. Ability to get project info using the access token from step 2 or 3.
        // Without surfacing the error, it is harder for developers to determine
        // which step went wrong.
        return await creds.getProjectId();
    }
    /**
     * Gets the Compute Engine project ID if it can be inferred.
     */ async getGCEProjectId() {
        try {
            const r = await gcpMetadata.project('project-id');
            return r;
        } catch (e) {
            // Ignore any errors
            return null;
        }
    }
    getCredentials(callback) {
        if (callback) {
            this.getCredentialsAsync().then((r)=>callback(null, r), callback);
        } else {
            return this.getCredentialsAsync();
        }
    }
    async getCredentialsAsync() {
        const client = await this.getClient();
        if (client instanceof impersonated_1.Impersonated) {
            return {
                client_email: client.getTargetPrincipal()
            };
        }
        if (client instanceof baseexternalclient_1.BaseExternalAccountClient) {
            const serviceAccountEmail = client.getServiceAccountEmail();
            if (serviceAccountEmail) {
                return {
                    client_email: serviceAccountEmail,
                    universe_domain: client.universeDomain
                };
            }
        }
        if (this.jsonContent) {
            return {
                client_email: this.jsonContent.client_email,
                private_key: this.jsonContent.private_key,
                universe_domain: this.jsonContent.universe_domain
            };
        }
        if (await this._checkIsGCE()) {
            const [client_email, universe_domain] = await Promise.all([
                gcpMetadata.instance('service-accounts/default/email'),
                this.getUniverseDomain()
            ]);
            return {
                client_email,
                universe_domain
            };
        }
        throw new Error(exports.GoogleAuthExceptionMessages.NO_CREDENTIALS_FOUND);
    }
    /**
     * Automatically obtain an {@link AuthClient `AuthClient`} based on the
     * provided configuration. If no options were passed, use Application
     * Default Credentials.
     */ async getClient() {
        if (this.cachedCredential) {
            return this.cachedCredential;
        }
        // Use an existing auth client request, or cache a new one
        __classPrivateFieldSet(this, _GoogleAuth_pendingAuthClient, __classPrivateFieldGet(this, _GoogleAuth_pendingAuthClient, "f") || __classPrivateFieldGet(this, _GoogleAuth_instances, "m", _GoogleAuth_determineClient).call(this), "f");
        try {
            return await __classPrivateFieldGet(this, _GoogleAuth_pendingAuthClient, "f");
        } finally{
            // reset the pending auth client in case it is changed later
            __classPrivateFieldSet(this, _GoogleAuth_pendingAuthClient, null, "f");
        }
    }
    /**
     * Creates a client which will fetch an ID token for authorization.
     * @param targetAudience the audience for the fetched ID token.
     * @returns IdTokenClient for making HTTP calls authenticated with ID tokens.
     */ async getIdTokenClient(targetAudience) {
        const client = await this.getClient();
        if (!('fetchIdToken' in client)) {
            throw new Error('Cannot fetch ID token in this environment, use GCE or set the GOOGLE_APPLICATION_CREDENTIALS environment variable to a service account credentials JSON file.');
        }
        return new idtokenclient_1.IdTokenClient({
            targetAudience,
            idTokenProvider: client
        });
    }
    /**
     * Automatically obtain application default credentials, and return
     * an access token for making requests.
     */ async getAccessToken() {
        const client = await this.getClient();
        return (await client.getAccessToken()).token;
    }
    /**
     * Obtain the HTTP headers that will provide authorization for a given
     * request.
     */ async getRequestHeaders(url) {
        const client = await this.getClient();
        return client.getRequestHeaders(url);
    }
    /**
     * Obtain credentials for a request, then attach the appropriate headers to
     * the request options.
     * @param opts Axios or Request options on which to attach the headers
     */ async authorizeRequest(opts) {
        opts = opts || {};
        const url = opts.url || opts.uri;
        const client = await this.getClient();
        const headers = await client.getRequestHeaders(url);
        opts.headers = Object.assign(opts.headers || {}, headers);
        return opts;
    }
    /**
     * Automatically obtain application default credentials, and make an
     * HTTP request using the given options.
     * @param opts Axios request options for the HTTP request.
     */ // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async request(opts) {
        const client = await this.getClient();
        return client.request(opts);
    }
    /**
     * Determine the compute environment in which the code is running.
     */ getEnv() {
        return (0, envDetect_1.getEnv)();
    }
    /**
     * Sign the given data with the current private key, or go out
     * to the IAM API to sign it.
     * @param data The data to be signed.
     * @param endpoint A custom endpoint to use.
     *
     * @example
     * ```
     * sign('data', 'https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/');
     * ```
     */ async sign(data, endpoint) {
        const client = await this.getClient();
        const universe = await this.getUniverseDomain();
        endpoint = endpoint || `https://iamcredentials.${universe}/v1/projects/-/serviceAccounts/`;
        if (client instanceof impersonated_1.Impersonated) {
            const signed = await client.sign(data);
            return signed.signedBlob;
        }
        const crypto = (0, crypto_1.createCrypto)();
        if (client instanceof jwtclient_1.JWT && client.key) {
            const sign = await crypto.sign(client.key, data);
            return sign;
        }
        const creds = await this.getCredentials();
        if (!creds.client_email) {
            throw new Error('Cannot sign data without `client_email`.');
        }
        return this.signBlob(crypto, creds.client_email, data, endpoint);
    }
    async signBlob(crypto, emailOrUniqueId, data, endpoint) {
        const url = new URL(endpoint + `${emailOrUniqueId}:signBlob`);
        const res = await this.request({
            method: 'POST',
            url: url.href,
            data: {
                payload: crypto.encodeBase64StringUtf8(data)
            },
            retry: true,
            retryConfig: {
                httpMethodsToRetry: [
                    'POST'
                ]
            }
        });
        return res.data.signedBlob;
    }
}
exports.GoogleAuth = GoogleAuth;
_GoogleAuth_pendingAuthClient = new WeakMap(), _GoogleAuth_instances = new WeakSet(), _GoogleAuth_prepareAndCacheClient = async function _GoogleAuth_prepareAndCacheClient(credential, quotaProjectIdOverride = process.env['GOOGLE_CLOUD_QUOTA_PROJECT'] || null) {
    const projectId = await this.getProjectIdOptional();
    if (quotaProjectIdOverride) {
        credential.quotaProjectId = quotaProjectIdOverride;
    }
    this.cachedCredential = credential;
    return {
        credential,
        projectId
    };
}, _GoogleAuth_determineClient = async function _GoogleAuth_determineClient() {
    if (this.jsonContent) {
        return this._cacheClientFromJSON(this.jsonContent, this.clientOptions);
    } else if (this.keyFilename) {
        const filePath = path.resolve(this.keyFilename);
        const stream = fs.createReadStream(filePath);
        return await this.fromStreamAsync(stream, this.clientOptions);
    } else if (this.apiKey) {
        const client = await this.fromAPIKey(this.apiKey, this.clientOptions);
        client.scopes = this.scopes;
        const { credential } = await __classPrivateFieldGet(this, _GoogleAuth_instances, "m", _GoogleAuth_prepareAndCacheClient).call(this, client);
        return credential;
    } else {
        const { credential } = await this.getApplicationDefaultAsync(this.clientOptions);
        return credential;
    }
};
/**
 * Export DefaultTransporter as a static property of the class.
 */ GoogleAuth.DefaultTransporter = transporters_1.DefaultTransporter;
}}),
"[project]/node_modules/.pnpm/google-auth-library@9.15.0_encoding@0.1.13/node_modules/google-auth-library/build/src/auth/iam.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
// Copyright 2014 Google LLC
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
Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.IAMAuth = void 0;
class IAMAuth {
    /**
     * IAM credentials.
     *
     * @param selector the iam authority selector
     * @param token the token
     * @constructor
     */ constructor(selector, token){
        this.selector = selector;
        this.token = token;
        this.selector = selector;
        this.token = token;
    }
    /**
     * Acquire the HTTP headers required to make an authenticated request.
     */ getRequestHeaders() {
        return {
            'x-goog-iam-authority-selector': this.selector,
            'x-goog-iam-authorization-token': this.token
        };
    }
}
exports.IAMAuth = IAMAuth;
}}),
"[project]/node_modules/.pnpm/google-auth-library@9.15.0_encoding@0.1.13/node_modules/google-auth-library/build/src/auth/downscopedclient.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
// Copyright 2021 Google LLC
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
Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.DownscopedClient = exports.EXPIRATION_TIME_OFFSET = exports.MAX_ACCESS_BOUNDARY_RULES_COUNT = void 0;
const stream = __turbopack_require__("[externals]/ [external] (stream, cjs)");
const authclient_1 = __turbopack_require__("[project]/node_modules/.pnpm/google-auth-library@9.15.0_encoding@0.1.13/node_modules/google-auth-library/build/src/auth/authclient.js [app-rsc] (ecmascript)");
const sts = __turbopack_require__("[project]/node_modules/.pnpm/google-auth-library@9.15.0_encoding@0.1.13/node_modules/google-auth-library/build/src/auth/stscredentials.js [app-rsc] (ecmascript)");
/**
 * The required token exchange grant_type: rfc8693#section-2.1
 */ const STS_GRANT_TYPE = 'urn:ietf:params:oauth:grant-type:token-exchange';
/**
 * The requested token exchange requested_token_type: rfc8693#section-2.1
 */ const STS_REQUEST_TOKEN_TYPE = 'urn:ietf:params:oauth:token-type:access_token';
/**
 * The requested token exchange subject_token_type: rfc8693#section-2.1
 */ const STS_SUBJECT_TOKEN_TYPE = 'urn:ietf:params:oauth:token-type:access_token';
/**
 * The maximum number of access boundary rules a Credential Access Boundary
 * can contain.
 */ exports.MAX_ACCESS_BOUNDARY_RULES_COUNT = 10;
/**
 * Offset to take into account network delays and server clock skews.
 */ exports.EXPIRATION_TIME_OFFSET = 5 * 60 * 1000;
/**
 * Defines a set of Google credentials that are downscoped from an existing set
 * of Google OAuth2 credentials. This is useful to restrict the Identity and
 * Access Management (IAM) permissions that a short-lived credential can use.
 * The common pattern of usage is to have a token broker with elevated access
 * generate these downscoped credentials from higher access source credentials
 * and pass the downscoped short-lived access tokens to a token consumer via
 * some secure authenticated channel for limited access to Google Cloud Storage
 * resources.
 */ class DownscopedClient extends authclient_1.AuthClient {
    /**
     * Instantiates a downscoped client object using the provided source
     * AuthClient and credential access boundary rules.
     * To downscope permissions of a source AuthClient, a Credential Access
     * Boundary that specifies which resources the new credential can access, as
     * well as an upper bound on the permissions that are available on each
     * resource, has to be defined. A downscoped client can then be instantiated
     * using the source AuthClient and the Credential Access Boundary.
     * @param authClient The source AuthClient to be downscoped based on the
     *   provided Credential Access Boundary rules.
     * @param credentialAccessBoundary The Credential Access Boundary which
     *   contains a list of access boundary rules. Each rule contains information
     *   on the resource that the rule applies to, the upper bound of the
     *   permissions that are available on that resource and an optional
     *   condition to further restrict permissions.
     * @param additionalOptions **DEPRECATED, set this in the provided `authClient`.**
     *   Optional additional behavior customization options.
     * @param quotaProjectId **DEPRECATED, set this in the provided `authClient`.**
     *   Optional quota project id for setting up in the x-goog-user-project header.
     */ constructor(authClient, credentialAccessBoundary, additionalOptions, quotaProjectId){
        super({
            ...additionalOptions,
            quotaProjectId
        });
        this.authClient = authClient;
        this.credentialAccessBoundary = credentialAccessBoundary;
        // Check 1-10 Access Boundary Rules are defined within Credential Access
        // Boundary.
        if (credentialAccessBoundary.accessBoundary.accessBoundaryRules.length === 0) {
            throw new Error('At least one access boundary rule needs to be defined.');
        } else if (credentialAccessBoundary.accessBoundary.accessBoundaryRules.length > exports.MAX_ACCESS_BOUNDARY_RULES_COUNT) {
            throw new Error('The provided access boundary has more than ' + `${exports.MAX_ACCESS_BOUNDARY_RULES_COUNT} access boundary rules.`);
        }
        // Check at least one permission should be defined in each Access Boundary
        // Rule.
        for (const rule of credentialAccessBoundary.accessBoundary.accessBoundaryRules){
            if (rule.availablePermissions.length === 0) {
                throw new Error('At least one permission should be defined in access boundary rules.');
            }
        }
        this.stsCredential = new sts.StsCredentials(`https://sts.${this.universeDomain}/v1/token`);
        this.cachedDownscopedAccessToken = null;
    }
    /**
     * Provides a mechanism to inject Downscoped access tokens directly.
     * The expiry_date field is required to facilitate determination of the token
     * expiration which would make it easier for the token consumer to handle.
     * @param credentials The Credentials object to set on the current client.
     */ setCredentials(credentials) {
        if (!credentials.expiry_date) {
            throw new Error('The access token expiry_date field is missing in the provided ' + 'credentials.');
        }
        super.setCredentials(credentials);
        this.cachedDownscopedAccessToken = credentials;
    }
    async getAccessToken() {
        // If the cached access token is unavailable or expired, force refresh.
        // The Downscoped access token will be returned in
        // DownscopedAccessTokenResponse format.
        if (!this.cachedDownscopedAccessToken || this.isExpired(this.cachedDownscopedAccessToken)) {
            await this.refreshAccessTokenAsync();
        }
        // Return Downscoped access token in DownscopedAccessTokenResponse format.
        return {
            token: this.cachedDownscopedAccessToken.access_token,
            expirationTime: this.cachedDownscopedAccessToken.expiry_date,
            res: this.cachedDownscopedAccessToken.res
        };
    }
    /**
     * The main authentication interface. It takes an optional url which when
     * present is the endpoint being accessed, and returns a Promise which
     * resolves with authorization header fields.
     *
     * The result has the form:
     * { Authorization: 'Bearer <access_token_value>' }
     */ async getRequestHeaders() {
        const accessTokenResponse = await this.getAccessToken();
        const headers = {
            Authorization: `Bearer ${accessTokenResponse.token}`
        };
        return this.addSharedMetadataHeaders(headers);
    }
    request(opts, callback) {
        if (callback) {
            this.requestAsync(opts).then((r)=>callback(null, r), (e)=>{
                return callback(e, e.response);
            });
        } else {
            return this.requestAsync(opts);
        }
    }
    /**
     * Authenticates the provided HTTP request, processes it and resolves with the
     * returned response.
     * @param opts The HTTP request options.
     * @param reAuthRetried Whether the current attempt is a retry after a failed attempt due to an auth failure
     * @return A promise that resolves with the successful response.
     */ async requestAsync(opts, reAuthRetried = false) {
        let response;
        try {
            const requestHeaders = await this.getRequestHeaders();
            opts.headers = opts.headers || {};
            if (requestHeaders && requestHeaders['x-goog-user-project']) {
                opts.headers['x-goog-user-project'] = requestHeaders['x-goog-user-project'];
            }
            if (requestHeaders && requestHeaders.Authorization) {
                opts.headers.Authorization = requestHeaders.Authorization;
            }
            response = await this.transporter.request(opts);
        } catch (e) {
            const res = e.response;
            if (res) {
                const statusCode = res.status;
                // Retry the request for metadata if the following criteria are true:
                // - We haven't already retried.  It only makes sense to retry once.
                // - The response was a 401 or a 403
                // - The request didn't send a readableStream
                // - forceRefreshOnFailure is true
                const isReadableStream = res.config.data instanceof stream.Readable;
                const isAuthErr = statusCode === 401 || statusCode === 403;
                if (!reAuthRetried && isAuthErr && !isReadableStream && this.forceRefreshOnFailure) {
                    await this.refreshAccessTokenAsync();
                    return await this.requestAsync(opts, true);
                }
            }
            throw e;
        }
        return response;
    }
    /**
     * Forces token refresh, even if unexpired tokens are currently cached.
     * GCP access tokens are retrieved from authclient object/source credential.
     * Then GCP access tokens are exchanged for downscoped access tokens via the
     * token exchange endpoint.
     * @return A promise that resolves with the fresh downscoped access token.
     */ async refreshAccessTokenAsync() {
        var _a;
        // Retrieve GCP access token from source credential.
        const subjectToken = (await this.authClient.getAccessToken()).token;
        // Construct the STS credentials options.
        const stsCredentialsOptions = {
            grantType: STS_GRANT_TYPE,
            requestedTokenType: STS_REQUEST_TOKEN_TYPE,
            subjectToken: subjectToken,
            subjectTokenType: STS_SUBJECT_TOKEN_TYPE
        };
        // Exchange the source AuthClient access token for a Downscoped access
        // token.
        const stsResponse = await this.stsCredential.exchangeToken(stsCredentialsOptions, undefined, this.credentialAccessBoundary);
        /**
         * The STS endpoint will only return the expiration time for the downscoped
         * access token if the original access token represents a service account.
         * The downscoped token's expiration time will always match the source
         * credential expiration. When no expires_in is returned, we can copy the
         * source credential's expiration time.
         */ const sourceCredExpireDate = ((_a = this.authClient.credentials) === null || _a === void 0 ? void 0 : _a.expiry_date) || null;
        const expiryDate = stsResponse.expires_in ? new Date().getTime() + stsResponse.expires_in * 1000 : sourceCredExpireDate;
        // Save response in cached access token.
        this.cachedDownscopedAccessToken = {
            access_token: stsResponse.access_token,
            expiry_date: expiryDate,
            res: stsResponse.res
        };
        // Save credentials.
        this.credentials = {};
        Object.assign(this.credentials, this.cachedDownscopedAccessToken);
        delete this.credentials.res;
        // Trigger tokens event to notify external listeners.
        this.emit('tokens', {
            refresh_token: null,
            expiry_date: this.cachedDownscopedAccessToken.expiry_date,
            access_token: this.cachedDownscopedAccessToken.access_token,
            token_type: 'Bearer',
            id_token: null
        });
        // Return the cached access token.
        return this.cachedDownscopedAccessToken;
    }
    /**
     * Returns whether the provided credentials are expired or not.
     * If there is no expiry time, assumes the token is not expired or expiring.
     * @param downscopedAccessToken The credentials to check for expiration.
     * @return Whether the credentials are expired or not.
     */ isExpired(downscopedAccessToken) {
        const now = new Date().getTime();
        return downscopedAccessToken.expiry_date ? now >= downscopedAccessToken.expiry_date - this.eagerRefreshThresholdMillis : false;
    }
}
exports.DownscopedClient = DownscopedClient;
}}),
"[project]/node_modules/.pnpm/google-auth-library@9.15.0_encoding@0.1.13/node_modules/google-auth-library/build/src/auth/passthrough.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
// Copyright 2024 Google LLC
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
Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.PassThroughClient = void 0;
const authclient_1 = __turbopack_require__("[project]/node_modules/.pnpm/google-auth-library@9.15.0_encoding@0.1.13/node_modules/google-auth-library/build/src/auth/authclient.js [app-rsc] (ecmascript)");
/**
 * An AuthClient without any Authentication information. Useful for:
 * - Anonymous access
 * - Local Emulators
 * - Testing Environments
 *
 */ class PassThroughClient extends authclient_1.AuthClient {
    /**
     * Creates a request without any authentication headers or checks.
     *
     * @remarks
     *
     * In testing environments it may be useful to change the provided
     * {@link AuthClient.transporter} for any desired request overrides/handling.
     *
     * @param opts
     * @returns The response of the request.
     */ async request(opts) {
        return this.transporter.request(opts);
    }
    /**
     * A required method of the base class.
     * Always will return an empty object.
     *
     * @returns {}
     */ async getAccessToken() {
        return {};
    }
    /**
     * A required method of the base class.
     * Always will return an empty object.
     *
     * @returns {}
     */ async getRequestHeaders() {
        return {};
    }
}
exports.PassThroughClient = PassThroughClient;
const a = new PassThroughClient();
a.getAccessToken();
}}),
"[project]/node_modules/.pnpm/google-auth-library@9.15.0_encoding@0.1.13/node_modules/google-auth-library/build/src/index.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.GoogleAuth = exports.auth = exports.DefaultTransporter = exports.PassThroughClient = exports.ExecutableError = exports.PluggableAuthClient = exports.DownscopedClient = exports.BaseExternalAccountClient = exports.ExternalAccountClient = exports.IdentityPoolClient = exports.AwsRequestSigner = exports.AwsClient = exports.UserRefreshClient = exports.LoginTicket = exports.ClientAuthentication = exports.OAuth2Client = exports.CodeChallengeMethod = exports.Impersonated = exports.JWT = exports.JWTAccess = exports.IdTokenClient = exports.IAMAuth = exports.GCPEnv = exports.Compute = exports.DEFAULT_UNIVERSE = exports.AuthClient = exports.gaxios = exports.gcpMetadata = void 0;
// Copyright 2017 Google LLC
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
const googleauth_1 = __turbopack_require__("[project]/node_modules/.pnpm/google-auth-library@9.15.0_encoding@0.1.13/node_modules/google-auth-library/build/src/auth/googleauth.js [app-rsc] (ecmascript)");
Object.defineProperty(exports, "GoogleAuth", {
    enumerable: true,
    get: function() {
        return googleauth_1.GoogleAuth;
    }
});
// Export common deps to ensure types/instances are the exact match. Useful
// for consistently configuring the library across versions.
exports.gcpMetadata = __turbopack_require__("[project]/node_modules/.pnpm/gcp-metadata@6.1.0_encoding@0.1.13/node_modules/gcp-metadata/build/src/index.js [app-rsc] (ecmascript)");
exports.gaxios = __turbopack_require__("[project]/node_modules/.pnpm/gaxios@6.7.1_encoding@0.1.13/node_modules/gaxios/build/src/index.js [app-rsc] (ecmascript)");
var authclient_1 = __turbopack_require__("[project]/node_modules/.pnpm/google-auth-library@9.15.0_encoding@0.1.13/node_modules/google-auth-library/build/src/auth/authclient.js [app-rsc] (ecmascript)");
Object.defineProperty(exports, "AuthClient", {
    enumerable: true,
    get: function() {
        return authclient_1.AuthClient;
    }
});
Object.defineProperty(exports, "DEFAULT_UNIVERSE", {
    enumerable: true,
    get: function() {
        return authclient_1.DEFAULT_UNIVERSE;
    }
});
var computeclient_1 = __turbopack_require__("[project]/node_modules/.pnpm/google-auth-library@9.15.0_encoding@0.1.13/node_modules/google-auth-library/build/src/auth/computeclient.js [app-rsc] (ecmascript)");
Object.defineProperty(exports, "Compute", {
    enumerable: true,
    get: function() {
        return computeclient_1.Compute;
    }
});
var envDetect_1 = __turbopack_require__("[project]/node_modules/.pnpm/google-auth-library@9.15.0_encoding@0.1.13/node_modules/google-auth-library/build/src/auth/envDetect.js [app-rsc] (ecmascript)");
Object.defineProperty(exports, "GCPEnv", {
    enumerable: true,
    get: function() {
        return envDetect_1.GCPEnv;
    }
});
var iam_1 = __turbopack_require__("[project]/node_modules/.pnpm/google-auth-library@9.15.0_encoding@0.1.13/node_modules/google-auth-library/build/src/auth/iam.js [app-rsc] (ecmascript)");
Object.defineProperty(exports, "IAMAuth", {
    enumerable: true,
    get: function() {
        return iam_1.IAMAuth;
    }
});
var idtokenclient_1 = __turbopack_require__("[project]/node_modules/.pnpm/google-auth-library@9.15.0_encoding@0.1.13/node_modules/google-auth-library/build/src/auth/idtokenclient.js [app-rsc] (ecmascript)");
Object.defineProperty(exports, "IdTokenClient", {
    enumerable: true,
    get: function() {
        return idtokenclient_1.IdTokenClient;
    }
});
var jwtaccess_1 = __turbopack_require__("[project]/node_modules/.pnpm/google-auth-library@9.15.0_encoding@0.1.13/node_modules/google-auth-library/build/src/auth/jwtaccess.js [app-rsc] (ecmascript)");
Object.defineProperty(exports, "JWTAccess", {
    enumerable: true,
    get: function() {
        return jwtaccess_1.JWTAccess;
    }
});
var jwtclient_1 = __turbopack_require__("[project]/node_modules/.pnpm/google-auth-library@9.15.0_encoding@0.1.13/node_modules/google-auth-library/build/src/auth/jwtclient.js [app-rsc] (ecmascript)");
Object.defineProperty(exports, "JWT", {
    enumerable: true,
    get: function() {
        return jwtclient_1.JWT;
    }
});
var impersonated_1 = __turbopack_require__("[project]/node_modules/.pnpm/google-auth-library@9.15.0_encoding@0.1.13/node_modules/google-auth-library/build/src/auth/impersonated.js [app-rsc] (ecmascript)");
Object.defineProperty(exports, "Impersonated", {
    enumerable: true,
    get: function() {
        return impersonated_1.Impersonated;
    }
});
var oauth2client_1 = __turbopack_require__("[project]/node_modules/.pnpm/google-auth-library@9.15.0_encoding@0.1.13/node_modules/google-auth-library/build/src/auth/oauth2client.js [app-rsc] (ecmascript)");
Object.defineProperty(exports, "CodeChallengeMethod", {
    enumerable: true,
    get: function() {
        return oauth2client_1.CodeChallengeMethod;
    }
});
Object.defineProperty(exports, "OAuth2Client", {
    enumerable: true,
    get: function() {
        return oauth2client_1.OAuth2Client;
    }
});
Object.defineProperty(exports, "ClientAuthentication", {
    enumerable: true,
    get: function() {
        return oauth2client_1.ClientAuthentication;
    }
});
var loginticket_1 = __turbopack_require__("[project]/node_modules/.pnpm/google-auth-library@9.15.0_encoding@0.1.13/node_modules/google-auth-library/build/src/auth/loginticket.js [app-rsc] (ecmascript)");
Object.defineProperty(exports, "LoginTicket", {
    enumerable: true,
    get: function() {
        return loginticket_1.LoginTicket;
    }
});
var refreshclient_1 = __turbopack_require__("[project]/node_modules/.pnpm/google-auth-library@9.15.0_encoding@0.1.13/node_modules/google-auth-library/build/src/auth/refreshclient.js [app-rsc] (ecmascript)");
Object.defineProperty(exports, "UserRefreshClient", {
    enumerable: true,
    get: function() {
        return refreshclient_1.UserRefreshClient;
    }
});
var awsclient_1 = __turbopack_require__("[project]/node_modules/.pnpm/google-auth-library@9.15.0_encoding@0.1.13/node_modules/google-auth-library/build/src/auth/awsclient.js [app-rsc] (ecmascript)");
Object.defineProperty(exports, "AwsClient", {
    enumerable: true,
    get: function() {
        return awsclient_1.AwsClient;
    }
});
var awsrequestsigner_1 = __turbopack_require__("[project]/node_modules/.pnpm/google-auth-library@9.15.0_encoding@0.1.13/node_modules/google-auth-library/build/src/auth/awsrequestsigner.js [app-rsc] (ecmascript)");
Object.defineProperty(exports, "AwsRequestSigner", {
    enumerable: true,
    get: function() {
        return awsrequestsigner_1.AwsRequestSigner;
    }
});
var identitypoolclient_1 = __turbopack_require__("[project]/node_modules/.pnpm/google-auth-library@9.15.0_encoding@0.1.13/node_modules/google-auth-library/build/src/auth/identitypoolclient.js [app-rsc] (ecmascript)");
Object.defineProperty(exports, "IdentityPoolClient", {
    enumerable: true,
    get: function() {
        return identitypoolclient_1.IdentityPoolClient;
    }
});
var externalclient_1 = __turbopack_require__("[project]/node_modules/.pnpm/google-auth-library@9.15.0_encoding@0.1.13/node_modules/google-auth-library/build/src/auth/externalclient.js [app-rsc] (ecmascript)");
Object.defineProperty(exports, "ExternalAccountClient", {
    enumerable: true,
    get: function() {
        return externalclient_1.ExternalAccountClient;
    }
});
var baseexternalclient_1 = __turbopack_require__("[project]/node_modules/.pnpm/google-auth-library@9.15.0_encoding@0.1.13/node_modules/google-auth-library/build/src/auth/baseexternalclient.js [app-rsc] (ecmascript)");
Object.defineProperty(exports, "BaseExternalAccountClient", {
    enumerable: true,
    get: function() {
        return baseexternalclient_1.BaseExternalAccountClient;
    }
});
var downscopedclient_1 = __turbopack_require__("[project]/node_modules/.pnpm/google-auth-library@9.15.0_encoding@0.1.13/node_modules/google-auth-library/build/src/auth/downscopedclient.js [app-rsc] (ecmascript)");
Object.defineProperty(exports, "DownscopedClient", {
    enumerable: true,
    get: function() {
        return downscopedclient_1.DownscopedClient;
    }
});
var pluggable_auth_client_1 = __turbopack_require__("[project]/node_modules/.pnpm/google-auth-library@9.15.0_encoding@0.1.13/node_modules/google-auth-library/build/src/auth/pluggable-auth-client.js [app-rsc] (ecmascript)");
Object.defineProperty(exports, "PluggableAuthClient", {
    enumerable: true,
    get: function() {
        return pluggable_auth_client_1.PluggableAuthClient;
    }
});
Object.defineProperty(exports, "ExecutableError", {
    enumerable: true,
    get: function() {
        return pluggable_auth_client_1.ExecutableError;
    }
});
var passthrough_1 = __turbopack_require__("[project]/node_modules/.pnpm/google-auth-library@9.15.0_encoding@0.1.13/node_modules/google-auth-library/build/src/auth/passthrough.js [app-rsc] (ecmascript)");
Object.defineProperty(exports, "PassThroughClient", {
    enumerable: true,
    get: function() {
        return passthrough_1.PassThroughClient;
    }
});
var transporters_1 = __turbopack_require__("[project]/node_modules/.pnpm/google-auth-library@9.15.0_encoding@0.1.13/node_modules/google-auth-library/build/src/transporters.js [app-rsc] (ecmascript)");
Object.defineProperty(exports, "DefaultTransporter", {
    enumerable: true,
    get: function() {
        return transporters_1.DefaultTransporter;
    }
});
const auth = new googleauth_1.GoogleAuth();
exports.auth = auth;
}}),

};

//# sourceMappingURL=6d406_google-auth-library_d9a3b2._.js.map