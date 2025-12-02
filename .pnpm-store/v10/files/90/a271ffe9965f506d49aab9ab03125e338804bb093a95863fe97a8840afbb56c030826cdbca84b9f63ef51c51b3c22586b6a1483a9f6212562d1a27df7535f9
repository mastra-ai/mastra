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
exports.awsEcsDetectorSync = exports.AwsEcsDetectorSync = void 0;
const api_1 = require("@opentelemetry/api");
const core_1 = require("@opentelemetry/core");
const resources_1 = require("@opentelemetry/resources");
const semconv_1 = require("../semconv");
const http = require("http");
const util = require("util");
const fs = require("fs");
const os = require("os");
const HTTP_TIMEOUT_IN_MS = 1000;
/**
 * The AwsEcsDetector can be used to detect if a process is running in AWS
 * ECS and return a {@link Resource} populated with data about the ECS
 * plugins of AWS X-Ray. Returns an empty Resource if detection fails.
 */
class AwsEcsDetectorSync {
    detect() {
        const attributes = api_1.context.with((0, core_1.suppressTracing)(api_1.context.active()), () => this._getAttributes());
        return new resources_1.Resource({}, attributes);
    }
    async _getAttributes() {
        if (!process.env.ECS_CONTAINER_METADATA_URI_V4 &&
            !process.env.ECS_CONTAINER_METADATA_URI) {
            api_1.diag.debug('AwsEcsDetector failed: Process is not on ECS');
            return {};
        }
        try {
            let resource = new resources_1.Resource({
                [semconv_1.ATTR_CLOUD_PROVIDER]: semconv_1.CLOUD_PROVIDER_VALUE_AWS,
                [semconv_1.ATTR_CLOUD_PLATFORM]: semconv_1.CLOUD_PLATFORM_VALUE_AWS_ECS,
            }).merge(await AwsEcsDetectorSync._getContainerIdAndHostnameResource());
            const metadataUrl = process.env.ECS_CONTAINER_METADATA_URI_V4;
            if (metadataUrl) {
                const [containerMetadata, taskMetadata] = await Promise.all([
                    AwsEcsDetectorSync._getUrlAsJson(metadataUrl),
                    AwsEcsDetectorSync._getUrlAsJson(`${metadataUrl}/task`),
                ]);
                const metadatav4Resource = await AwsEcsDetectorSync._getMetadataV4Resource(containerMetadata, taskMetadata);
                const logsResource = await AwsEcsDetectorSync._getLogResource(containerMetadata);
                resource = resource.merge(metadatav4Resource).merge(logsResource);
            }
            return resource.attributes;
        }
        catch (_a) {
            return {};
        }
    }
    /**
     * Read container ID from cgroup file
     * In ECS, even if we fail to find target file
     * or target file does not contain container ID
     * we do not throw an error but throw warning message
     * and then return null string
     */
    static async _getContainerIdAndHostnameResource() {
        const hostName = os.hostname();
        let containerId = '';
        try {
            const rawData = await AwsEcsDetectorSync.readFileAsync(AwsEcsDetectorSync.DEFAULT_CGROUP_PATH, 'utf8');
            const splitData = rawData.trim().split('\n');
            for (const str of splitData) {
                if (str.length > AwsEcsDetectorSync.CONTAINER_ID_LENGTH) {
                    containerId = str.substring(str.length - AwsEcsDetectorSync.CONTAINER_ID_LENGTH);
                    break;
                }
            }
        }
        catch (e) {
            api_1.diag.debug('AwsEcsDetector failed to read container ID', e);
        }
        if (hostName || containerId) {
            return new resources_1.Resource({
                [semconv_1.ATTR_CONTAINER_NAME]: hostName || '',
                [semconv_1.ATTR_CONTAINER_ID]: containerId || '',
            });
        }
        return resources_1.Resource.empty();
    }
    static async _getMetadataV4Resource(containerMetadata, taskMetadata) {
        const launchType = taskMetadata['LaunchType'];
        const taskArn = taskMetadata['TaskARN'];
        const baseArn = taskArn.substring(0, taskArn.lastIndexOf(':'));
        const cluster = taskMetadata['Cluster'];
        const accountId = AwsEcsDetectorSync._getAccountFromArn(taskArn);
        const region = AwsEcsDetectorSync._getRegionFromArn(taskArn);
        const availabilityZone = taskMetadata === null || taskMetadata === void 0 ? void 0 : taskMetadata.AvailabilityZone;
        const clusterArn = cluster.startsWith('arn:')
            ? cluster
            : `${baseArn}:cluster/${cluster}`;
        const containerArn = containerMetadata['ContainerARN'];
        // https://github.com/open-telemetry/semantic-conventions/blob/main/semantic_conventions/resource/cloud_provider/aws/ecs.yaml
        const attributes = {
            [semconv_1.ATTR_AWS_ECS_CONTAINER_ARN]: containerArn,
            [semconv_1.ATTR_AWS_ECS_CLUSTER_ARN]: clusterArn,
            [semconv_1.ATTR_AWS_ECS_LAUNCHTYPE]: launchType === null || launchType === void 0 ? void 0 : launchType.toLowerCase(),
            [semconv_1.ATTR_AWS_ECS_TASK_ARN]: taskArn,
            [semconv_1.ATTR_AWS_ECS_TASK_FAMILY]: taskMetadata['Family'],
            [semconv_1.ATTR_AWS_ECS_TASK_REVISION]: taskMetadata['Revision'],
            [semconv_1.ATTR_CLOUD_ACCOUNT_ID]: accountId,
            [semconv_1.ATTR_CLOUD_REGION]: region,
            [semconv_1.ATTR_CLOUD_RESOURCE_ID]: containerArn,
        };
        // The availability zone is not available in all Fargate runtimes
        if (availabilityZone) {
            attributes[semconv_1.ATTR_CLOUD_AVAILABILITY_ZONE] = availabilityZone;
        }
        return new resources_1.Resource(attributes);
    }
    static async _getLogResource(containerMetadata) {
        if (containerMetadata['LogDriver'] !== 'awslogs' ||
            !containerMetadata['LogOptions']) {
            return resources_1.Resource.EMPTY;
        }
        const containerArn = containerMetadata['ContainerARN'];
        const logOptions = containerMetadata['LogOptions'];
        const logsRegion = logOptions['awslogs-region'] ||
            AwsEcsDetectorSync._getRegionFromArn(containerArn);
        const awsAccount = AwsEcsDetectorSync._getAccountFromArn(containerArn);
        const logsGroupName = logOptions['awslogs-group'];
        const logsGroupArn = `arn:aws:logs:${logsRegion}:${awsAccount}:log-group:${logsGroupName}`;
        const logsStreamName = logOptions['awslogs-stream'];
        const logsStreamArn = `arn:aws:logs:${logsRegion}:${awsAccount}:log-group:${logsGroupName}:log-stream:${logsStreamName}`;
        return new resources_1.Resource({
            [semconv_1.ATTR_AWS_LOG_GROUP_NAMES]: [logsGroupName],
            [semconv_1.ATTR_AWS_LOG_GROUP_ARNS]: [logsGroupArn],
            [semconv_1.ATTR_AWS_LOG_STREAM_NAMES]: [logsStreamName],
            [semconv_1.ATTR_AWS_LOG_STREAM_ARNS]: [logsStreamArn],
        });
    }
    static _getAccountFromArn(containerArn) {
        const match = /arn:aws:ecs:[^:]+:([^:]+):.*/.exec(containerArn);
        return match[1];
    }
    static _getRegionFromArn(containerArn) {
        const match = /arn:aws:ecs:([^:]+):.*/.exec(containerArn);
        return match[1];
    }
    static _getUrlAsJson(url) {
        return new Promise((resolve, reject) => {
            const request = http.get(url, (response) => {
                if (response.statusCode && response.statusCode >= 400) {
                    reject(new Error(`Request to '${url}' failed with status ${response.statusCode}`));
                }
                /*
                 * Concatenate the response out of chunks:
                 * https://nodejs.org/api/stream.html#stream_event_data
                 */
                let responseBody = '';
                response.on('data', (chunk) => (responseBody += chunk.toString()));
                // All the data has been read, resolve the Promise
                response.on('end', () => resolve(responseBody));
                /*
                 * https://nodejs.org/api/http.html#httprequesturl-options-callback, see the
                 * 'In the case of a premature connection close after the response is received'
                 * case
                 */
                request.on('error', reject);
            });
            // Set an aggressive timeout to prevent lock-ups
            request.setTimeout(HTTP_TIMEOUT_IN_MS, () => {
                request.destroy();
            });
            // Connection error, disconnection, etc.
            request.on('error', reject);
            request.end();
        }).then(responseBodyRaw => JSON.parse(responseBodyRaw));
    }
}
exports.AwsEcsDetectorSync = AwsEcsDetectorSync;
AwsEcsDetectorSync.CONTAINER_ID_LENGTH = 64;
AwsEcsDetectorSync.DEFAULT_CGROUP_PATH = '/proc/self/cgroup';
AwsEcsDetectorSync.readFileAsync = util.promisify(fs.readFile);
exports.awsEcsDetectorSync = new AwsEcsDetectorSync();
//# sourceMappingURL=AwsEcsDetectorSync.js.map