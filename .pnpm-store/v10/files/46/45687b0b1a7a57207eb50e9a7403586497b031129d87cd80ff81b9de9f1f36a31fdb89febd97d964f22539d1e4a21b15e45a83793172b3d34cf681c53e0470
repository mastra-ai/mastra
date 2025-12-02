"use strict";
// Copyright Datastax, Inc
// SPDX-License-Identifier: Apache-2.0
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_DATA_API_PATHS = exports.DEFAULT_DEVOPS_API_ENDPOINTS = exports.DEFAULT_DEVOPS_API_AUTH_HEADER = exports.DEFAULT_DATA_API_AUTH_HEADER = exports.DEFAULT_TIMEOUT = exports.DEFAULT_KEYSPACE = exports.HttpMethods = exports.CLIENT_USER_AGENT = exports.RAGSTACK_REQUESTED_WITH = void 0;
const version_1 = require("../version");
exports.RAGSTACK_REQUESTED_WITH = (() => {
    try {
        // Do not use require() here, it will break the build in some environments such as NextJS application
        // if @datastax/ragstack-ai is not installed (which is perfectly fine).
        const ragstack = eval(`require('@datastax/ragstack-ai')`);
        const version = ragstack['RAGSTACK_VERSION'] || '?';
        return `ragstack-ai-ts/${version}`;
    }
    catch (_) {
        return '';
    }
})();
/**
 * @internal
 */
exports.CLIENT_USER_AGENT = version_1.LIB_NAME + '/' + version_1.LIB_VERSION;
/**
 * @internal
 */
exports.HttpMethods = {
    Get: 'GET',
    Post: 'POST',
    Delete: 'DELETE',
};
exports.DEFAULT_KEYSPACE = 'default_keyspace';
exports.DEFAULT_TIMEOUT = 30000;
exports.DEFAULT_DATA_API_AUTH_HEADER = 'Token';
exports.DEFAULT_DEVOPS_API_AUTH_HEADER = 'Authorization';
exports.DEFAULT_DEVOPS_API_ENDPOINTS = {
    prod: 'https://api.astra.datastax.com/v2',
    test: 'https://api.test.cloud.datastax.com/v2',
    dev: 'https://api.dev.cloud.datastax.com/v2',
};
exports.DEFAULT_DATA_API_PATHS = {
    astra: 'api/json/v1',
    dse: 'v1',
    hcd: 'v1',
    cassandra: 'v1',
    other: 'v1',
};
