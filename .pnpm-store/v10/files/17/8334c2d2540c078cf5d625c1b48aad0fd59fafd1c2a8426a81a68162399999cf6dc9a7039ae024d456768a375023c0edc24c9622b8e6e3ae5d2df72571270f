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
exports.awsEc2DetectorSync = void 0;
const api_1 = require("@opentelemetry/api");
const core_1 = require("@opentelemetry/core");
const resources_1 = require("@opentelemetry/resources");
const semconv_1 = require("../semconv");
const http = require("http");
/**
 * The AwsEc2DetectorSync can be used to detect if a process is running in AWS EC2
 * and return a {@link Resource} populated with metadata about the EC2
 * instance. Returns an empty Resource if detection fails.
 */
class AwsEc2DetectorSync {
    constructor() {
        /**
         * See https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/instance-identity-documents.html
         * for documentation about the AWS instance identity document
         * and standard of IMDSv2.
         */
        this.AWS_IDMS_ENDPOINT = '169.254.169.254';
        this.AWS_INSTANCE_TOKEN_DOCUMENT_PATH = '/latest/api/token';
        this.AWS_INSTANCE_IDENTITY_DOCUMENT_PATH = '/latest/dynamic/instance-identity/document';
        this.AWS_INSTANCE_HOST_DOCUMENT_PATH = '/latest/meta-data/hostname';
        this.AWS_METADATA_TTL_HEADER = 'X-aws-ec2-metadata-token-ttl-seconds';
        this.AWS_METADATA_TOKEN_HEADER = 'X-aws-ec2-metadata-token';
        this.MILLISECOND_TIME_OUT = 5000;
    }
    detect(_config) {
        const attributes = api_1.context.with((0, core_1.suppressTracing)(api_1.context.active()), () => this._getAttributes());
        return new resources_1.Resource({}, attributes);
    }
    /**
     * Attempts to connect and obtain an AWS instance Identity document. If the
     * connection is successful it returns a promise containing a {@link ResourceAttributes}
     * object with instance metadata. Returns a promise containing an
     * empty {@link ResourceAttributes} if the connection or parsing of the identity
     * document fails.
     */
    async _getAttributes() {
        try {
            const token = await this._fetchToken();
            const { accountId, instanceId, instanceType, region, availabilityZone } = await this._fetchIdentity(token);
            const hostname = await this._fetchHost(token);
            return {
                [semconv_1.ATTR_CLOUD_PROVIDER]: semconv_1.CLOUD_PROVIDER_VALUE_AWS,
                [semconv_1.ATTR_CLOUD_PLATFORM]: semconv_1.CLOUD_PLATFORM_VALUE_AWS_EC2,
                [semconv_1.ATTR_CLOUD_ACCOUNT_ID]: accountId,
                [semconv_1.ATTR_CLOUD_REGION]: region,
                [semconv_1.ATTR_CLOUD_AVAILABILITY_ZONE]: availabilityZone,
                [semconv_1.ATTR_HOST_ID]: instanceId,
                [semconv_1.ATTR_HOST_TYPE]: instanceType,
                [semconv_1.ATTR_HOST_NAME]: hostname,
            };
        }
        catch (_a) {
            return {};
        }
    }
    async _fetchToken() {
        const options = {
            host: this.AWS_IDMS_ENDPOINT,
            path: this.AWS_INSTANCE_TOKEN_DOCUMENT_PATH,
            method: 'PUT',
            timeout: this.MILLISECOND_TIME_OUT,
            headers: {
                [this.AWS_METADATA_TTL_HEADER]: '60',
            },
        };
        return await this._fetchString(options);
    }
    async _fetchIdentity(token) {
        const options = {
            host: this.AWS_IDMS_ENDPOINT,
            path: this.AWS_INSTANCE_IDENTITY_DOCUMENT_PATH,
            method: 'GET',
            timeout: this.MILLISECOND_TIME_OUT,
            headers: {
                [this.AWS_METADATA_TOKEN_HEADER]: token,
            },
        };
        const identity = await this._fetchString(options);
        return JSON.parse(identity);
    }
    async _fetchHost(token) {
        const options = {
            host: this.AWS_IDMS_ENDPOINT,
            path: this.AWS_INSTANCE_HOST_DOCUMENT_PATH,
            method: 'GET',
            timeout: this.MILLISECOND_TIME_OUT,
            headers: {
                [this.AWS_METADATA_TOKEN_HEADER]: token,
            },
        };
        return await this._fetchString(options);
    }
    /**
     * Establishes an HTTP connection to AWS instance document url.
     * If the application is running on an EC2 instance, we should be able
     * to get back a valid JSON document. Parses that document and stores
     * the identity properties in a local map.
     */
    async _fetchString(options) {
        return new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => {
                req.abort();
                reject(new Error('EC2 metadata api request timed out.'));
            }, this.MILLISECOND_TIME_OUT);
            const req = http.request(options, res => {
                clearTimeout(timeoutId);
                const { statusCode } = res;
                res.setEncoding('utf8');
                let rawData = '';
                res.on('data', chunk => (rawData += chunk));
                res.on('end', () => {
                    if (statusCode && statusCode >= 200 && statusCode < 300) {
                        try {
                            resolve(rawData);
                        }
                        catch (e) {
                            reject(e);
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
    }
}
exports.awsEc2DetectorSync = new AwsEc2DetectorSync();
//# sourceMappingURL=AwsEc2DetectorSync.js.map