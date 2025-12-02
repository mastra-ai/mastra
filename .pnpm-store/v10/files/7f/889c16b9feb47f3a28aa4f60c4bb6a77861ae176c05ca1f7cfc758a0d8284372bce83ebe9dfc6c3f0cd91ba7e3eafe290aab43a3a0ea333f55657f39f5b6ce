"use strict";
// Copyright Datastax, Inc
// SPDX-License-Identifier: Apache-2.0
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateAdminOpts = validateAdminOpts;
exports.extractAstraEnvironment = extractAstraEnvironment;
const utils_1 = require("../data-api/utils");
function validateAdminOpts(opts) {
    (0, utils_1.validateOption)('adminOptions', opts, 'object', false, (opts) => {
        (0, utils_1.validateOption)('adminOptions.monitorCommands', opts.monitorCommands, 'boolean');
        (0, utils_1.validateOption)('adminOptions.endpointUrl', opts.endpointUrl, 'string');
    });
}
function extractAstraEnvironment(endpoint) {
    switch (true) {
        case endpoint.includes('apps.astra-dev.datastax.com'):
            return 'dev';
        case endpoint.includes('apps.astra-test.datastax.com'):
            return 'test';
        case endpoint.includes('apps.astra.datastax.com'):
            return 'prod';
        default:
            throw new Error(`Cannot extract astra environment for endpoint '${endpoint}'`);
    }
}
