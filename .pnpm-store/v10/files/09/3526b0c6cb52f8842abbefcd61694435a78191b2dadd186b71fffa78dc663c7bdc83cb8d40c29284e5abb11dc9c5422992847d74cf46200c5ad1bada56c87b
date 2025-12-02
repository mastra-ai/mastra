"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.inferenceOperationsBuilder = void 0;
var control_1 = require("../pinecone-generated-ts-fetch/control");
var utils_1 = require("../utils");
var middleware_1 = require("../utils/middleware");
var inferenceOperationsBuilder = function (config) {
    var apiKey = config.apiKey;
    var controllerPath = (0, utils_1.normalizeUrl)(config.controllerHostUrl) || 'https://api.pinecone.io';
    var headers = config.additionalHeaders || null;
    var apiConfig = {
        basePath: controllerPath,
        apiKey: apiKey,
        queryParamsStringify: utils_1.queryParamsStringify,
        headers: __assign({ 'User-Agent': (0, utils_1.buildUserAgent)(config), 'X-Pinecone-Api-Version': control_1.X_PINECONE_API_VERSION }, headers),
        fetchApi: (0, utils_1.getFetch)(config),
        middleware: middleware_1.middleware,
    };
    return new control_1.InferenceApi(new control_1.Configuration(apiConfig));
};
exports.inferenceOperationsBuilder = inferenceOperationsBuilder;
//# sourceMappingURL=inferenceOperationsBuilder.js.map