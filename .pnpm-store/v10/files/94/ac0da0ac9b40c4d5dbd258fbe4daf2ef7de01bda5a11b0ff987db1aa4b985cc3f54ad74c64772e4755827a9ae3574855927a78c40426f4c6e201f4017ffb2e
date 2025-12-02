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
exports.azureAppServiceDetector = void 0;
const resources_1 = require("@opentelemetry/resources");
const types_1 = require("../types");
const semantic_conventions_1 = require("@opentelemetry/semantic-conventions");
const utils_1 = require("../utils");
const APP_SERVICE_ATTRIBUTE_ENV_VARS = {
    [semantic_conventions_1.SEMRESATTRS_CLOUD_REGION]: types_1.REGION_NAME,
    [semantic_conventions_1.SEMRESATTRS_DEPLOYMENT_ENVIRONMENT]: types_1.WEBSITE_SLOT_NAME,
    [semantic_conventions_1.SEMRESATTRS_HOST_ID]: types_1.WEBSITE_HOSTNAME,
    [semantic_conventions_1.SEMRESATTRS_SERVICE_INSTANCE_ID]: types_1.WEBSITE_INSTANCE_ID,
    [types_1.AZURE_APP_SERVICE_STAMP_RESOURCE_ATTRIBUTE]: types_1.WEBSITE_HOME_STAMPNAME,
};
/**
 * The AzureAppServiceDetector can be used to detect if a process is running in an Azure App Service
 * @returns a {@link Resource} populated with data about the environment or an empty Resource if detection fails.
 */
class AzureAppServiceDetector {
    detect() {
        let attributes = {};
        const websiteSiteName = process.env[types_1.WEBSITE_SITE_NAME];
        if (websiteSiteName && !(0, utils_1.isAzureFunction)()) {
            attributes = Object.assign(Object.assign({}, attributes), { [semantic_conventions_1.SEMRESATTRS_SERVICE_NAME]: websiteSiteName });
            attributes = Object.assign(Object.assign({}, attributes), { [semantic_conventions_1.SEMRESATTRS_CLOUD_PROVIDER]: semantic_conventions_1.CLOUDPROVIDERVALUES_AZURE });
            attributes = Object.assign(Object.assign({}, attributes), { [semantic_conventions_1.SEMRESATTRS_CLOUD_PLATFORM]: semantic_conventions_1.CLOUDPLATFORMVALUES_AZURE_APP_SERVICE });
            const azureResourceUri = (0, utils_1.getAzureResourceUri)(websiteSiteName);
            if (azureResourceUri) {
                attributes = Object.assign(Object.assign({}, attributes), { [types_1.CLOUD_RESOURCE_ID_RESOURCE_ATTRIBUTE]: azureResourceUri });
            }
            for (const [key, value] of Object.entries(APP_SERVICE_ATTRIBUTE_ENV_VARS)) {
                const envVar = process.env[value];
                if (envVar) {
                    attributes = Object.assign(Object.assign({}, attributes), { [key]: envVar });
                }
            }
        }
        return new resources_1.Resource(attributes);
    }
}
exports.azureAppServiceDetector = new AzureAppServiceDetector();
//# sourceMappingURL=AzureAppServiceDetector.js.map