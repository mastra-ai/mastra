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
exports.awsLambdaDetector = exports.AwsLambdaDetector = void 0;
const AwsLambdaDetectorSync_1 = require("./AwsLambdaDetectorSync");
/**
 * The AwsLambdaDetector can be used to detect if a process is running in AWS Lambda
 * and return a {@link Resource} populated with data about the environment.
 *
 * @deprecated Use {@link AwsLambdaDetectorSync} class instead
 */
class AwsLambdaDetector {
    detect(_config) {
        return Promise.resolve(AwsLambdaDetectorSync_1.awsLambdaDetectorSync.detect(_config));
    }
}
exports.AwsLambdaDetector = AwsLambdaDetector;
exports.awsLambdaDetector = new AwsLambdaDetector();
//# sourceMappingURL=AwsLambdaDetector.js.map