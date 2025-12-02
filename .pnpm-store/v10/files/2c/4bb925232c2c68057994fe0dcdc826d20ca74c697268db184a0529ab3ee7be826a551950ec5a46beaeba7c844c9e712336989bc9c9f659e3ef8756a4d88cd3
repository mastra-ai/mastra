"use strict";
/*!
 * This source file is part of the Gel open source project.
 *
 * Copyright 2020-present MagicStack Inc. and the Gel authors.
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
exports.setFloat16 = exports.isFloat16Array = exports.getFloat16 = exports.Float16Array = void 0;
exports.getUniqueId = getUniqueId;
exports.sleep = sleep;
exports.versionEqual = versionEqual;
exports.versionGreaterThan = versionGreaterThan;
exports.versionGreaterThanOrEqual = versionGreaterThanOrEqual;
exports.getAuthenticatedFetch = getAuthenticatedFetch;
var float16_1 = require("@petamoriken/float16");
Object.defineProperty(exports, "Float16Array", { enumerable: true, get: function () { return float16_1.Float16Array; } });
Object.defineProperty(exports, "getFloat16", { enumerable: true, get: function () { return float16_1.getFloat16; } });
Object.defineProperty(exports, "isFloat16Array", { enumerable: true, get: function () { return float16_1.isFloat16Array; } });
Object.defineProperty(exports, "setFloat16", { enumerable: true, get: function () { return float16_1.setFloat16; } });
const idCounter = {};
function getUniqueId(prefix = "") {
    if (!idCounter[prefix]) {
        idCounter[prefix] = 0;
    }
    const id = ++idCounter[prefix];
    return `_gel_${prefix}_${id.toString(16)}_`;
}
function sleep(durationMillis) {
    return new Promise((accept) => {
        setTimeout(() => accept(), durationMillis);
    });
}
function versionEqual(left, right) {
    return left[0] === right[0] && left[1] === right[1];
}
function versionGreaterThan(left, right) {
    if (left[0] > right[0]) {
        return true;
    }
    if (left[0] < right[0]) {
        return false;
    }
    return left[1] > right[1];
}
function versionGreaterThanOrEqual(left, right) {
    if (left[0] === right[0] && left[1] === right[1]) {
        return true;
    }
    return versionGreaterThan(left, right);
}
const _tokens = new WeakMap();
async function getAuthenticatedFetch(config, httpSCRAMAuth, basePath) {
    let token = config.secretKey ?? _tokens.get(config);
    const { address, tlsSecurity, database } = config;
    const protocol = tlsSecurity === "insecure" ? "http" : "https";
    const baseUrl = `${protocol}://${address[0]}:${address[1]}`;
    const databaseUrl = `${baseUrl}/db/${database}/${basePath ?? ""}`;
    if (!token && config.password != null) {
        token = await httpSCRAMAuth(baseUrl, config.user, config.password);
        _tokens.set(config, token);
    }
    return (input, init) => {
        let path;
        if (typeof input === "string") {
            path = input;
        }
        else if (input instanceof Request) {
            path = input.url;
        }
        else
            path = input.toString();
        const url = new URL(path, databaseUrl);
        const headers = new Headers(init?.headers);
        if (config.user !== undefined) {
            headers.append("X-EdgeDB-User", config.user);
        }
        if (token !== undefined) {
            headers.append("Authorization", `Bearer ${token}`);
        }
        return fetch(url, {
            ...init,
            headers,
        });
    };
}
