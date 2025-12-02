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
exports.azureFunctionsDetector = void 0;
const resources_1 = require("@opentelemetry/resources");
const semantic_conventions_1 = require("@opentelemetry/semantic-conventions");
const types_1 = require("../types");
const utils_1 = require("../utils");
const AZURE_FUNCTIONS_ATTRIBUTE_ENV_VARS = {
    [semantic_conventions_1.SEMRESATTRS_SERVICE_NAME]: types_1.WEBSITE_SITE_NAME,
    [semantic_conventions_1.SEMRESATTRS_FAAS_INSTANCE]: types_1.WEBSITE_INSTANCE_ID,
    [semantic_conventions_1.SEMRESATTRS_FAAS_MAX_MEMORY]: types_1.FUNCTIONS_MEM_LIMIT,
};
/**
 * The AzureFunctionsDetector can be used to detect if a process is running in Azure Functions
 * @returns a {@link Resource} populated with data about the environment or an empty Resource if detection fails.
 */
class AzureFunctionsDetector {
    detect() {
        let attributes = {};
        const serviceName = process.env[types_1.WEBSITE_SITE_NAME];
        /**
         * Checks that we are operating within an Azure Function using the function version since WEBSITE_SITE_NAME
         * will exist in Azure App Service as well and detectors should be mutually exclusive.
         * If the function version is not present, we check for the website sku to determine if it is a function.
         */
        if (serviceName && (0, utils_1.isAzureFunction)()) {
            const functionInstance = process.env[types_1.WEBSITE_INSTANCE_ID];
            const functionMemLimit = process.env[types_1.FUNCTIONS_MEM_LIMIT];
            attributes = {
                [semantic_conventions_1.SEMRESATTRS_CLOUD_PROVIDER]: semantic_conventions_1.CLOUDPROVIDERVALUES_AZURE,
                [semantic_conventions_1.SEMRESATTRS_CLOUD_PLATFORM]: semantic_conventions_1.CLOUDPLATFORMVALUES_AZURE_FUNCTIONS,
                [semantic_conventions_1.SEMRESATTRS_CLOUD_REGION]: process.env[types_1.REGION_NAME],
                [semantic_conventions_1.SEMRESATTRS_PROCESS_PID]: process.pid,
            };
            if (serviceName) {
                attributes = Object.assign(Object.assign({}, attributes), { [semantic_conventions_1.SEMRESATTRS_SERVICE_NAME]: serviceName });
            }
            if (functionInstance) {
                attributes = Object.assign(Object.assign({}, attributes), { [semantic_conventions_1.SEMRESATTRS_FAAS_INSTANCE]: functionInstance });
            }
            if (functionMemLimit) {
                attributes = Object.assign(Object.assign({}, attributes), { [semantic_conventions_1.SEMRESATTRS_FAAS_MAX_MEMORY]: functionMemLimit });
            }
            const azureResourceUri = (0, utils_1.getAzureResourceUri)(serviceName);
            if (azureResourceUri) {
                attributes = Object.assign(Object.assign({}, attributes), { [types_1.CLOUD_RESOURCE_ID_RESOURCE_ATTRIBUTE]: azureResourceUri });
            }
            for (const [key, value] of Object.entries(AZURE_FUNCTIONS_ATTRIBUTE_ENV_VARS)) {
                const envVar = process.env[value];
                if (envVar) {
                    attributes = Object.assign(Object.assign({}, attributes), { [key]: envVar });
                }
            }
        }
        return new resources_1.Resource(attributes);
    }
}
exports.azureFunctionsDetector = new AzureFunctionsDetector();
//# sourceMappingURL=AzureFunctionsDetector.js.map