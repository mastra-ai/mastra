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
exports.azureVmDetector = void 0;
const http = require("http");
const api_1 = require("@opentelemetry/api");
const core_1 = require("@opentelemetry/core");
const resources_1 = require("@opentelemetry/resources");
const semantic_conventions_1 = require("@opentelemetry/semantic-conventions");
const types_1 = require("../types");
/**
 * The AzureVmDetector can be used to detect if a process is running in an Azure VM.
 * @returns a {@link Resource} populated with data about the environment or an empty Resource if detection fails.
 */
class AzureVmResourceDetector {
    detect() {
        const attributes = api_1.context.with((0, core_1.suppressTracing)(api_1.context.active()), () => this.getAzureVmMetadata());
        return new resources_1.Resource({}, attributes);
    }
    async getAzureVmMetadata() {
        const options = {
            host: types_1.AZURE_VM_METADATA_HOST,
            path: types_1.AZURE_VM_METADATA_PATH,
            method: 'GET',
            timeout: 5000,
            headers: {
                Metadata: 'True',
            },
        };
        const metadata = await new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => {
                req.destroy();
                reject(new Error('Azure metadata service request timed out.'));
            }, 1000);
            const req = http.request(options, res => {
                clearTimeout(timeoutId);
                const { statusCode } = res;
                res.setEncoding('utf8');
                let rawData = '';
                res.on('data', chunk => (rawData += chunk));
                res.on('end', () => {
                    if (statusCode && statusCode >= 200 && statusCode < 300) {
                        try {
                            resolve(JSON.parse(rawData));
                        }
                        catch (error) {
                            reject(error);
                        }
                    }
                    else {
                        reject(new Error('Failed to load page, status code: ' + statusCode));
                    }
                });
            });
            req.on('error', err => {
                clearTimeout(timeoutId);
                reject(err);
            });
            req.end();
        });
        const attributes = {
            [types_1.AZURE_VM_SCALE_SET_NAME_ATTRIBUTE]: metadata['vmScaleSetName'],
            [types_1.AZURE_VM_SKU_ATTRIBUTE]: metadata['sku'],
            [semantic_conventions_1.SEMRESATTRS_CLOUD_PLATFORM]: semantic_conventions_1.CLOUDPLATFORMVALUES_AZURE_VM,
            [semantic_conventions_1.SEMRESATTRS_CLOUD_PROVIDER]: semantic_conventions_1.CLOUDPROVIDERVALUES_AZURE,
            [semantic_conventions_1.SEMRESATTRS_CLOUD_REGION]: metadata['location'],
            [types_1.CLOUD_RESOURCE_ID_RESOURCE_ATTRIBUTE]: metadata['resourceId'],
            [semantic_conventions_1.SEMRESATTRS_HOST_ID]: metadata['vmId'],
            [semantic_conventions_1.SEMRESATTRS_HOST_NAME]: metadata['name'],
            [semantic_conventions_1.SEMRESATTRS_HOST_TYPE]: metadata['vmSize'],
            [semantic_conventions_1.SEMRESATTRS_OS_VERSION]: metadata['version'],
        };
        return attributes;
    }
}
exports.azureVmDetector = new AzureVmResourceDetector();
//# sourceMappingURL=AzureVmDetector.js.map