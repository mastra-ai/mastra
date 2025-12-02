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
exports.awsBeanstalkDetectorSync = exports.AwsBeanstalkDetectorSync = void 0;
const api_1 = require("@opentelemetry/api");
const core_1 = require("@opentelemetry/core");
const resources_1 = require("@opentelemetry/resources");
const semantic_conventions_1 = require("@opentelemetry/semantic-conventions");
const semconv_1 = require("../semconv");
const fs = require("fs");
const util = require("util");
/**
 * The AwsBeanstalkDetector can be used to detect if a process is running in AWS Elastic
 * Beanstalk and return a {@link Resource} populated with data about the beanstalk
 * plugins of AWS X-Ray. Returns an empty Resource if detection fails.
 *
 * See https://docs.amazonaws.cn/en_us/xray/latest/devguide/xray-guide.pdf
 * for more details about detecting information of Elastic Beanstalk plugins
 */
const DEFAULT_BEANSTALK_CONF_PATH = '/var/elasticbeanstalk/xray/environment.conf';
const WIN_OS_BEANSTALK_CONF_PATH = 'C:\\Program Files\\Amazon\\XRay\\environment.conf';
class AwsBeanstalkDetectorSync {
    constructor() {
        if (process.platform === 'win32') {
            this.BEANSTALK_CONF_PATH = WIN_OS_BEANSTALK_CONF_PATH;
        }
        else {
            this.BEANSTALK_CONF_PATH = DEFAULT_BEANSTALK_CONF_PATH;
        }
    }
    detect(config) {
        const attributes = api_1.context.with((0, core_1.suppressTracing)(api_1.context.active()), () => this._getAttributes());
        return new resources_1.Resource({}, attributes);
    }
    /**
     * Attempts to obtain AWS Beanstalk configuration from the file
     * system. If file is accesible and read succesfully it returns
     * a promise containing a {@link ResourceAttributes}
     * object with instance metadata. Returns a promise containing an
     * empty {@link ResourceAttributes} if the file is not accesible or
     * fails in the reading process.
     */
    async _getAttributes(_config) {
        try {
            await AwsBeanstalkDetectorSync.fileAccessAsync(this.BEANSTALK_CONF_PATH, fs.constants.R_OK);
            const rawData = await AwsBeanstalkDetectorSync.readFileAsync(this.BEANSTALK_CONF_PATH, 'utf8');
            const parsedData = JSON.parse(rawData);
            return {
                [semconv_1.ATTR_CLOUD_PROVIDER]: semconv_1.CLOUD_PROVIDER_VALUE_AWS,
                [semconv_1.ATTR_CLOUD_PLATFORM]: semconv_1.CLOUD_PLATFORM_VALUE_AWS_ELASTIC_BEANSTALK,
                [semantic_conventions_1.ATTR_SERVICE_NAME]: semconv_1.CLOUD_PLATFORM_VALUE_AWS_ELASTIC_BEANSTALK,
                [semconv_1.ATTR_SERVICE_NAMESPACE]: parsedData.environment_name,
                [semantic_conventions_1.ATTR_SERVICE_VERSION]: parsedData.version_label,
                [semconv_1.ATTR_SERVICE_INSTANCE_ID]: parsedData.deployment_id,
            };
        }
        catch (e) {
            api_1.diag.debug(`AwsBeanstalkDetectorSync failed: ${e.message}`);
            return {};
        }
    }
}
exports.AwsBeanstalkDetectorSync = AwsBeanstalkDetectorSync;
AwsBeanstalkDetectorSync.readFileAsync = util.promisify(fs.readFile);
AwsBeanstalkDetectorSync.fileAccessAsync = util.promisify(fs.access);
exports.awsBeanstalkDetectorSync = new AwsBeanstalkDetectorSync();
//# sourceMappingURL=AwsBeanstalkDetectorSync.js.map