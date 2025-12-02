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
import { awsEcsDetectorSync } from './AwsEcsDetectorSync';
/**
 * The AwsEcsDetector can be used to detect if a process is running in AWS
 * ECS and return a {@link Resource} populated with data about the ECS
 * plugins of AWS X-Ray.
 *
 * @deprecated Use {@link AwsEcsDetectorSync} class instead.
 */
var AwsEcsDetector = /** @class */ (function () {
    function AwsEcsDetector() {
    }
    AwsEcsDetector.prototype.detect = function () {
        return Promise.resolve(awsEcsDetectorSync.detect());
    };
    return AwsEcsDetector;
}());
export { AwsEcsDetector };
export var awsEcsDetector = new AwsEcsDetector();
//# sourceMappingURL=AwsEcsDetector.js.map