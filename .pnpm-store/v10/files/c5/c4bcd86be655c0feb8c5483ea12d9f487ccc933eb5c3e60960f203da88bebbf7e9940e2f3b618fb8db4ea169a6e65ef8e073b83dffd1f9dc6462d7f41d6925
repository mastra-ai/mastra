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
import { AZURE_APP_SERVICE_STAMP_RESOURCE_ATTRIBUTE, REGION_NAME, WEBSITE_HOME_STAMPNAME, WEBSITE_HOSTNAME, WEBSITE_INSTANCE_ID, WEBSITE_SITE_NAME, WEBSITE_SLOT_NAME, CLOUD_RESOURCE_ID_RESOURCE_ATTRIBUTE, } from '../types';
import { SEMRESATTRS_CLOUD_REGION, SEMRESATTRS_DEPLOYMENT_ENVIRONMENT, SEMRESATTRS_HOST_ID, SEMRESATTRS_SERVICE_INSTANCE_ID, SEMRESATTRS_SERVICE_NAME, SEMRESATTRS_CLOUD_PROVIDER, SEMRESATTRS_CLOUD_PLATFORM, CLOUDPROVIDERVALUES_AZURE, CLOUDPLATFORMVALUES_AZURE_APP_SERVICE, } from '@opentelemetry/semantic-conventions';
import { getAzureResourceUri, isAzureFunction } from '../utils';
var APP_SERVICE_ATTRIBUTE_ENV_VARS = (_a = {},
    _a[SEMRESATTRS_CLOUD_REGION] = REGION_NAME,
    _a[SEMRESATTRS_DEPLOYMENT_ENVIRONMENT] = WEBSITE_SLOT_NAME,
    _a[SEMRESATTRS_HOST_ID] = WEBSITE_HOSTNAME,
    _a[SEMRESATTRS_SERVICE_INSTANCE_ID] = WEBSITE_INSTANCE_ID,
    _a[AZURE_APP_SERVICE_STAMP_RESOURCE_ATTRIBUTE] = WEBSITE_HOME_STAMPNAME,
    _a);
/**
 * The AzureAppServiceDetector can be used to detect if a process is running in an Azure App Service
 * @returns a {@link Resource} populated with data about the environment or an empty Resource if detection fails.
 */
var AzureAppServiceDetector = /** @class */ (function () {
    function AzureAppServiceDetector() {
    }
    AzureAppServiceDetector.prototype.detect = function () {
        var _a, _b, _c, _d, _e;
        var attributes = {};
        var websiteSiteName = process.env[WEBSITE_SITE_NAME];
        if (websiteSiteName && !isAzureFunction()) {
            attributes = __assign(__assign({}, attributes), (_a = {}, _a[SEMRESATTRS_SERVICE_NAME] = websiteSiteName, _a));
            attributes = __assign(__assign({}, attributes), (_b = {}, _b[SEMRESATTRS_CLOUD_PROVIDER] = CLOUDPROVIDERVALUES_AZURE, _b));
            attributes = __assign(__assign({}, attributes), (_c = {}, _c[SEMRESATTRS_CLOUD_PLATFORM] = CLOUDPLATFORMVALUES_AZURE_APP_SERVICE, _c));
            var azureResourceUri = getAzureResourceUri(websiteSiteName);
            if (azureResourceUri) {
                attributes = __assign(__assign({}, attributes), (_d = {}, _d[CLOUD_RESOURCE_ID_RESOURCE_ATTRIBUTE] = azureResourceUri, _d));
            }
            for (var _i = 0, _f = Object.entries(APP_SERVICE_ATTRIBUTE_ENV_VARS); _i < _f.length; _i++) {
                var _g = _f[_i], key = _g[0], value = _g[1];
                var envVar = process.env[value];
                if (envVar) {
                    attributes = __assign(__assign({}, attributes), (_e = {}, _e[key] = envVar, _e));
                }
            }
        }
        return new Resource(attributes);
    };
    return AzureAppServiceDetector;
}());
export var azureAppServiceDetector = new AzureAppServiceDetector();
//# sourceMappingURL=AzureAppServiceDetector.js.map