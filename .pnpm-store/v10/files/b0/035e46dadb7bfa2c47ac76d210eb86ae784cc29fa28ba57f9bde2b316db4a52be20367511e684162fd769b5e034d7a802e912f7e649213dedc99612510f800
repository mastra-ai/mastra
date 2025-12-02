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
import { awsEksDetectorSync } from './AwsEksDetectorSync';
/**
 * The AwsEksDetector can be used to detect if a process is running in AWS Elastic
 * Kubernetes and return a {@link Resource} populated with data about the Kubernetes
 * plugins of AWS X-Ray. Returns an empty Resource if detection fails.
 *
 * See https://docs.amazonaws.cn/en_us/xray/latest/devguide/xray-guide.pdf
 * for more details about detecting information for Elastic Kubernetes plugins
 *
 * @deprecated Use the new {@link AwsEksDetectorSync} class instead.
 */
var AwsEksDetector = /** @class */ (function () {
    function AwsEksDetector() {
        // NOTE: these readonly props are kept for testing purposes
        this.K8S_SVC_URL = 'kubernetes.default.svc';
        this.AUTH_CONFIGMAP_PATH = '/api/v1/namespaces/kube-system/configmaps/aws-auth';
        this.CW_CONFIGMAP_PATH = '/api/v1/namespaces/amazon-cloudwatch/configmaps/cluster-info';
        this.TIMEOUT_MS = 2000;
    }
    AwsEksDetector.prototype.detect = function (_config) {
        return Promise.resolve(awsEksDetectorSync.detect());
    };
    return AwsEksDetector;
}());
export { AwsEksDetector };
export var awsEksDetector = new AwsEksDetector();
//# sourceMappingURL=AwsEksDetector.js.map