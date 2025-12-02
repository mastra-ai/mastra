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
var _a;
import { Resource } from '@opentelemetry/resources';
import { SEMRESATTRS_FAAS_MAX_MEMORY, SEMRESATTRS_FAAS_INSTANCE, SEMRESATTRS_CLOUD_PROVIDER, SEMRESATTRS_CLOUD_PLATFORM, SEMRESATTRS_CLOUD_REGION, CLOUDPROVIDERVALUES_AZURE, CLOUDPLATFORMVALUES_AZURE_FUNCTIONS, SEMRESATTRS_SERVICE_NAME, SEMRESATTRS_PROCESS_PID, } from '@opentelemetry/semantic-conventions';
import { WEBSITE_SITE_NAME, WEBSITE_INSTANCE_ID, FUNCTIONS_MEM_LIMIT, REGION_NAME, CLOUD_RESOURCE_ID_RESOURCE_ATTRIBUTE, } from '../types';
import { getAzureResourceUri, isAzureFunction } from '../utils';
var AZURE_FUNCTIONS_ATTRIBUTE_ENV_VARS = (_a = {},
    _a[SEMRESATTRS_SERVICE_NAME] = WEBSITE_SITE_NAME,
    _a[SEMRESATTRS_FAAS_INSTANCE] = WEBSITE_INSTANCE_ID,
    _a[SEMRESATTRS_FAAS_MAX_MEMORY] = FUNCTIONS_MEM_LIMIT,
    _a);
/**
 * The AzureFunctionsDetector can be used to detect if a process is running in Azure Functions
 * @returns a {@link Resource} populated with data about the environment or an empty Resource if detection fails.
 */
var AzureFunctionsDetector = /** @class */ (function () {
    function AzureFunctionsDetector() {
    }
    AzureFunctionsDetector.prototype.detect = function () {
        var _a, _b, _c, _d, _e, _f;
        var attributes = {};
        var serviceName = process.env[WEBSITE_SITE_NAME];
        /**
         * Checks that we are operating within an Azure Function using the function version since WEBSITE_SITE_NAME
         * will exist in Azure App Service as well and detectors should be mutually exclusive.
         * If the function version is not present, we check for the website sku to determine if it is a function.
         */
        if (serviceName && isAzureFunction()) {
            var functionInstance = process.env[WEBSITE_INSTANCE_ID];
            var functionMemLimit = process.env[FUNCTIONS_MEM_LIMIT];
            attributes = (_a = {},
                _a[SEMRESATTRS_CLOUD_PROVIDER] = CLOUDPROVIDERVALUES_AZURE,
                _a[SEMRESATTRS_CLOUD_PLATFORM] = CLOUDPLATFORMVALUES_AZURE_FUNCTIONS,
                _a[SEMRESATTRS_CLOUD_REGION] = process.env[REGION_NAME],
                _a[SEMRESATTRS_PROCESS_PID] = process.pid,
                _a);
            if (serviceName) {
                attributes = __assign(__assign({}, attributes), (_b = {}, _b[SEMRESATTRS_SERVICE_NAME] = serviceName, _b));
            }
            if (functionInstance) {
                attributes = __assign(__assign({}, attributes), (_c = {}, _c[SEMRESATTRS_FAAS_INSTANCE] = functionInstance, _c));
            }
            if (functionMemLimit) {
                attributes = __assign(__assign({}, attributes), (_d = {}, _d[SEMRESATTRS_FAAS_MAX_MEMORY] = functionMemLimit, _d));
            }
            var azureResourceUri = getAzureResourceUri(serviceName);
            if (azureResourceUri) {
                attributes = __assign(__assign({}, attributes), (_e = {}, _e[CLOUD_RESOURCE_ID_RESOURCE_ATTRIBUTE] = azureResourceUri, _e));
            }
            for (var _i = 0, _g = Object.entries(AZURE_FUNCTIONS_ATTRIBUTE_ENV_VARS); _i < _g.length; _i++) {
                var _h = _g[_i], key = _h[0], value = _h[1];
                var envVar = process.env[value];
                if (envVar) {
                    attributes = __assign(__assign({}, attributes), (_f = {}, _f[key] = envVar, _f));
                }
            }
        }
        return new Resource(attributes);
    };
    return AzureFunctionsDetector;
}());
export var azureFunctionsDetector = new AzureFunctionsDetector();
//# sourceMappingURL=AzureFunctionsDetector.js.map