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
exports.awsLambdaDetectorSync = exports.AwsLambdaDetectorSync = void 0;
const resources_1 = require("@opentelemetry/resources");
const semconv_1 = require("../semconv");
/**
 * The AwsLambdaDetector can be used to detect if a process is running in AWS Lambda
 * and return a {@link Resource} populated with data about the environment.
 * Returns an empty Resource if detection fails.
 */
class AwsLambdaDetectorSync {
    detect(_config) {
        // Check if running inside AWS Lambda environment
        const executionEnv = process.env.AWS_EXECUTION_ENV;
        if (!(executionEnv === null || executionEnv === void 0 ? void 0 : executionEnv.startsWith('AWS_Lambda_'))) {
            return resources_1.Resource.empty();
        }
        // These environment variables are guaranteed to be present in Lambda environment
        // https://docs.aws.amazon.com/lambda/latest/dg/configuration-envvars.html#configuration-envvars-runtime
        const region = process.env.AWS_REGION;
        const functionName = process.env.AWS_LAMBDA_FUNCTION_NAME;
        const functionVersion = process.env.AWS_LAMBDA_FUNCTION_VERSION;
        const memorySize = process.env.AWS_LAMBDA_FUNCTION_MEMORY_SIZE;
        // These environment variables are not available in Lambda SnapStart functions
        const logGroupName = process.env.AWS_LAMBDA_LOG_GROUP_NAME;
        const logStreamName = process.env.AWS_LAMBDA_LOG_STREAM_NAME;
        const attributes = {
            [semconv_1.ATTR_CLOUD_PROVIDER]: semconv_1.CLOUD_PROVIDER_VALUE_AWS,
            [semconv_1.ATTR_CLOUD_PLATFORM]: semconv_1.CLOUD_PLATFORM_VALUE_AWS_LAMBDA,
            [semconv_1.ATTR_CLOUD_REGION]: region,
            [semconv_1.ATTR_FAAS_NAME]: functionName,
            [semconv_1.ATTR_FAAS_VERSION]: functionVersion,
            [semconv_1.ATTR_FAAS_MAX_MEMORY]: parseInt(memorySize) * 1024 * 1024,
        };
        if (logGroupName) {
            attributes[semconv_1.ATTR_AWS_LOG_GROUP_NAMES] = [logGroupName];
        }
        if (logStreamName) {
            attributes[semconv_1.ATTR_FAAS_INSTANCE] = logStreamName;
        }
        return new resources_1.Resource(attributes);
    }
}
exports.AwsLambdaDetectorSync = AwsLambdaDetectorSync;
exports.awsLambdaDetectorSync = new AwsLambdaDetectorSync();
//# sourceMappingURL=AwsLambdaDetectorSync.js.map