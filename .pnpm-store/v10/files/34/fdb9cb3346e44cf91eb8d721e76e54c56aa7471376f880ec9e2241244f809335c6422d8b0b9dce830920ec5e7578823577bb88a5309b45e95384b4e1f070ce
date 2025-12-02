"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.bindPromise = exports.extractAttributesFromNormalizedRequest = exports.normalizeV3Request = exports.normalizeV2Request = exports.removeSuffixFromStringIfExists = void 0;
/*
 * Copyright The OpenTelemetry Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
const api_1 = require("@opentelemetry/api");
const semantic_conventions_1 = require("@opentelemetry/semantic-conventions");
const enums_1 = require("./enums");
const toPascalCase = (str) => typeof str === 'string' ? str.charAt(0).toUpperCase() + str.slice(1) : str;
const removeSuffixFromStringIfExists = (str, suffixToRemove) => {
    const suffixLength = suffixToRemove.length;
    return (str === null || str === void 0 ? void 0 : str.slice(-suffixLength)) === suffixToRemove
        ? str.slice(0, str.length - suffixLength)
        : str;
};
exports.removeSuffixFromStringIfExists = removeSuffixFromStringIfExists;
const normalizeV2Request = (awsV2Request) => {
    var _a, _b, _c;
    const service = awsV2Request === null || awsV2Request === void 0 ? void 0 : awsV2Request.service;
    return {
        serviceName: (_b = (_a = service === null || service === void 0 ? void 0 : service.api) === null || _a === void 0 ? void 0 : _a.serviceId) === null || _b === void 0 ? void 0 : _b.replace(/\s+/g, ''),
        commandName: toPascalCase(awsV2Request === null || awsV2Request === void 0 ? void 0 : awsV2Request.operation),
        commandInput: awsV2Request.params,
        region: (_c = service === null || service === void 0 ? void 0 : service.config) === null || _c === void 0 ? void 0 : _c.region,
    };
};
exports.normalizeV2Request = normalizeV2Request;
const normalizeV3Request = (serviceName, commandNameWithSuffix, commandInput, region) => {
    return {
        serviceName: serviceName === null || serviceName === void 0 ? void 0 : serviceName.replace(/\s+/g, ''),
        commandName: (0, exports.removeSuffixFromStringIfExists)(commandNameWithSuffix, 'Command'),
        commandInput,
        region,
    };
};
exports.normalizeV3Request = normalizeV3Request;
const extractAttributesFromNormalizedRequest = (normalizedRequest) => {
    return {
        [semantic_conventions_1.SEMATTRS_RPC_SYSTEM]: 'aws-api',
        [semantic_conventions_1.SEMATTRS_RPC_METHOD]: normalizedRequest.commandName,
        [semantic_conventions_1.SEMATTRS_RPC_SERVICE]: normalizedRequest.serviceName,
        [enums_1.AttributeNames.AWS_REGION]: normalizedRequest.region,
    };
};
exports.extractAttributesFromNormalizedRequest = extractAttributesFromNormalizedRequest;
const bindPromise = (target, contextForCallbacks, rebindCount = 1) => {
    const origThen = target.then;
    target.then = function (onFulfilled, onRejected) {
        const newOnFulfilled = api_1.context.bind(contextForCallbacks, onFulfilled);
        const newOnRejected = api_1.context.bind(contextForCallbacks, onRejected);
        const patchedPromise = origThen.call(this, newOnFulfilled, newOnRejected);
        return rebindCount > 1
            ? (0, exports.bindPromise)(patchedPromise, contextForCallbacks, rebindCount - 1)
            : patchedPromise;
    };
    return target;
};
exports.bindPromise = bindPromise;
//# sourceMappingURL=utils.js.map