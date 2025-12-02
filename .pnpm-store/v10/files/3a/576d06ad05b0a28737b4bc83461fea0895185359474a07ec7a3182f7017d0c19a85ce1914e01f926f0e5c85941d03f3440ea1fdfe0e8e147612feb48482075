"use strict";
// Copyright Datastax, Inc
// SPDX-License-Identifier: Apache-2.0
Object.defineProperty(exports, "__esModule", { value: true });
exports.isNullish = isNullish;
exports.validateDataAPIEnv = validateDataAPIEnv;
exports.jsonTryParse = jsonTryParse;
exports.resolveKeyspace = resolveKeyspace;
const constants_1 = require("../common/constants");
function isNullish(t) {
    return t === null || t === undefined;
}
function validateDataAPIEnv(env) {
    if (!isNullish(env) && !constants_1.DataAPIEnvironments.includes(env)) {
        throw new Error(`Given environment is invalid (must be ${constants_1.DataAPIEnvironments.map(e => `"${e}"`).join(', ')}, or nullish to default to "astra".`);
    }
}
function jsonTryParse(json, otherwise, reviver) {
    try {
        return JSON.parse(json, reviver);
    }
    catch (_) {
        return otherwise;
    }
}
function resolveKeyspace(obj, nullBypass) {
    return (nullBypass)
        ? (obj?.keyspace !== undefined) ? obj?.keyspace : obj?.namespace
        : obj?.keyspace ?? obj?.namespace ?? undefined;
}
