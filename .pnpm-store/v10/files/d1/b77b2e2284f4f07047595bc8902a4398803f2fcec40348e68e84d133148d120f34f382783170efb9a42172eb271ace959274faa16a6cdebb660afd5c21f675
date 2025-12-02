"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.isIgnored = exports.satisfiesPattern = exports.setLookupAttributes = exports.getOperationName = exports.getFamilyAttribute = exports.setError = void 0;
const api_1 = require("@opentelemetry/api");
const AttributeNames_1 = require("./enums/AttributeNames");
/**
 * Set error attributes on the span passed in params
 * @param err the error that we use for filling the attributes
 * @param span the span to be set
 * @param nodeVersion the node version
 */
const setError = (err, span) => {
    const { message, name } = err;
    const attributes = {
        [AttributeNames_1.AttributeNames.DNS_ERROR_MESSAGE]: message,
        [AttributeNames_1.AttributeNames.DNS_ERROR_NAME]: name,
    };
    span.setAttributes(attributes);
    span.setStatus({
        code: api_1.SpanStatusCode.ERROR,
        message,
    });
};
exports.setError = setError;
/**
 * Returns the family attribute name to be set on the span
 * @param family `4` (ipv4) or `6` (ipv6). `0` means bug.
 * @param [index] `4` (ipv4) or `6` (ipv6). `0` means bug.
 */
const getFamilyAttribute = (family, index) => {
    return index ? `peer[${index}].ipv${family}` : `peer.ipv${family}`;
};
exports.getFamilyAttribute = getFamilyAttribute;
/**
 * Returns the span name
 * @param funcName function name that is wrapped (e.g `lookup`)
 * @param [service] e.g `http`
 */
const getOperationName = (funcName, service) => {
    return service ? `dns.${service}/${funcName}` : `dns.${funcName}`;
};
exports.getOperationName = getOperationName;
const setLookupAttributes = (span, address, family) => {
    const attributes = {};
    const isObject = typeof address === 'object';
    let addresses = address;
    if (!isObject) {
        addresses = [{ address, family }];
    }
    else if (!(addresses instanceof Array)) {
        addresses = [
            {
                address: address.address,
                family: address.family,
            },
        ];
    }
    addresses.forEach((_, i) => {
        const peerAttrFormat = (0, exports.getFamilyAttribute)(_.family, i);
        attributes[peerAttrFormat] = _.address;
    });
    span.setAttributes(attributes);
};
exports.setLookupAttributes = setLookupAttributes;
/**
 * Check whether the given obj match pattern
 * @param constant e.g URL of request
 * @param obj obj to inspect
 * @param pattern Match pattern
 */
const satisfiesPattern = (constant, pattern) => {
    if (typeof pattern === 'string') {
        return pattern === constant;
    }
    else if (pattern instanceof RegExp) {
        return pattern.test(constant);
    }
    else if (typeof pattern === 'function') {
        return pattern(constant);
    }
    else {
        throw new TypeError('Pattern is in unsupported datatype');
    }
};
exports.satisfiesPattern = satisfiesPattern;
/**
 * Check whether the given dns request is ignored by configuration
 * It will not re-throw exceptions from `list` provided by the client
 * @param constant e.g URL of request
 * @param [list] List of ignore patterns
 * @param [onException] callback for doing something when an exception has
 *     occurred
 */
const isIgnored = (constant, list, onException) => {
    if (!list) {
        // No ignored urls - trace everything
        return false;
    }
    if (!Array.isArray(list)) {
        list = [list];
    }
    // Try/catch outside the loop for failing fast
    try {
        for (const pattern of list) {
            if ((0, exports.satisfiesPattern)(constant, pattern)) {
                return true;
            }
        }
    }
    catch (e) {
        if (onException) {
            onException(e);
        }
    }
    return false;
};
exports.isIgnored = isIgnored;
//# sourceMappingURL=utils.js.map