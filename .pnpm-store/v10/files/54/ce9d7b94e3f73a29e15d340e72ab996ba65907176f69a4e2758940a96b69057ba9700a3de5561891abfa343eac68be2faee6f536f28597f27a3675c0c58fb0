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
exports.getLayerPath = exports.asErrorAndMessage = exports.isLayerIgnored = exports.getLayerMetadata = exports.getRouterPath = exports.storeLayerPath = void 0;
const ExpressLayerType_1 = require("./enums/ExpressLayerType");
const AttributeNames_1 = require("./enums/AttributeNames");
const internal_types_1 = require("./internal-types");
/**
 * Store layers path in the request to be able to construct route later
 * @param request The request where
 * @param [value] the value to push into the array
 */
const storeLayerPath = (request, value) => {
    if (Array.isArray(request[internal_types_1._LAYERS_STORE_PROPERTY]) === false) {
        Object.defineProperty(request, internal_types_1._LAYERS_STORE_PROPERTY, {
            enumerable: false,
            value: [],
        });
    }
    if (value === undefined)
        return;
    request[internal_types_1._LAYERS_STORE_PROPERTY].push(value);
};
exports.storeLayerPath = storeLayerPath;
/**
 * Recursively search the router path from layer stack
 * @param path The path to reconstruct
 * @param layer The layer to reconstruct from
 * @returns The reconstructed path
 */
const getRouterPath = (path, layer) => {
    var _a, _b, _c, _d;
    const stackLayer = (_b = (_a = layer.handle) === null || _a === void 0 ? void 0 : _a.stack) === null || _b === void 0 ? void 0 : _b[0];
    if ((_c = stackLayer === null || stackLayer === void 0 ? void 0 : stackLayer.route) === null || _c === void 0 ? void 0 : _c.path) {
        return `${path}${stackLayer.route.path}`;
    }
    if ((_d = stackLayer === null || stackLayer === void 0 ? void 0 : stackLayer.handle) === null || _d === void 0 ? void 0 : _d.stack) {
        return (0, exports.getRouterPath)(path, stackLayer);
    }
    return path;
};
exports.getRouterPath = getRouterPath;
/**
 * Parse express layer context to retrieve a name and attributes.
 * @param route The route of the layer
 * @param layer Express layer
 * @param [layerPath] if present, the path on which the layer has been mounted
 */
const getLayerMetadata = (route, layer, layerPath) => {
    var _a;
    if (layer.name === 'router') {
        const maybeRouterPath = (0, exports.getRouterPath)('', layer);
        const extractedRouterPath = maybeRouterPath
            ? maybeRouterPath
            : layerPath || route || '/';
        return {
            attributes: {
                [AttributeNames_1.AttributeNames.EXPRESS_NAME]: extractedRouterPath,
                [AttributeNames_1.AttributeNames.EXPRESS_TYPE]: ExpressLayerType_1.ExpressLayerType.ROUTER,
            },
            name: `router - ${extractedRouterPath}`,
        };
    }
    else if (layer.name === 'bound dispatch') {
        return {
            attributes: {
                [AttributeNames_1.AttributeNames.EXPRESS_NAME]: (_a = (route || layerPath)) !== null && _a !== void 0 ? _a : 'request handler',
                [AttributeNames_1.AttributeNames.EXPRESS_TYPE]: ExpressLayerType_1.ExpressLayerType.REQUEST_HANDLER,
            },
            name: `request handler${layer.path ? ` - ${route || layerPath}` : ''}`,
        };
    }
    else {
        return {
            attributes: {
                [AttributeNames_1.AttributeNames.EXPRESS_NAME]: layer.name,
                [AttributeNames_1.AttributeNames.EXPRESS_TYPE]: ExpressLayerType_1.ExpressLayerType.MIDDLEWARE,
            },
            name: `middleware - ${layer.name}`,
        };
    }
};
exports.getLayerMetadata = getLayerMetadata;
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
/**
 * Check whether the given request is ignored by configuration
 * It will not re-throw exceptions from `list` provided by the client
 * @param constant e.g URL of request
 * @param [list] List of ignore patterns
 * @param [onException] callback for doing something when an exception has
 *     occurred
 */
const isLayerIgnored = (name, type, config) => {
    var _a;
    if (Array.isArray(config === null || config === void 0 ? void 0 : config.ignoreLayersType) &&
        ((_a = config === null || config === void 0 ? void 0 : config.ignoreLayersType) === null || _a === void 0 ? void 0 : _a.includes(type))) {
        return true;
    }
    if (Array.isArray(config === null || config === void 0 ? void 0 : config.ignoreLayers) === false)
        return false;
    try {
        for (const pattern of config.ignoreLayers) {
            if (satisfiesPattern(name, pattern)) {
                return true;
            }
        }
    }
    catch (e) {
        /* catch block*/
    }
    return false;
};
exports.isLayerIgnored = isLayerIgnored;
/**
 * Converts a user-provided error value into an error and error message pair
 *
 * @param error - User-provided error value
 * @returns Both an Error or string representation of the value and an error message
 */
const asErrorAndMessage = (error) => error instanceof Error
    ? [error, error.message]
    : [String(error), String(error)];
exports.asErrorAndMessage = asErrorAndMessage;
/**
 * Extracts the layer path from the route arguments
 *
 * @param args - Arguments of the route
 * @returns The layer path
 */
const getLayerPath = (args) => {
    const firstArg = args[0];
    if (Array.isArray(firstArg)) {
        return firstArg.map(arg => extractLayerPathSegment(arg) || '').join(',');
    }
    return extractLayerPathSegment(firstArg);
};
exports.getLayerPath = getLayerPath;
const extractLayerPathSegment = (arg) => {
    if (typeof arg === 'string') {
        return arg;
    }
    if (arg instanceof RegExp || typeof arg === 'number') {
        return arg.toString();
    }
    return;
};
//# sourceMappingURL=utils.js.map