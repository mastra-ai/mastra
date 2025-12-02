import { Detector, IResource, ResourceDetectionConfig } from '@opentelemetry/resources';
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
export declare class AwsEksDetector implements Detector {
    readonly K8S_SVC_URL = "kubernetes.default.svc";
    readonly AUTH_CONFIGMAP_PATH = "/api/v1/namespaces/kube-system/configmaps/aws-auth";
    readonly CW_CONFIGMAP_PATH = "/api/v1/namespaces/amazon-cloudwatch/configmaps/cluster-info";
    readonly TIMEOUT_MS = 2000;
    detect(_config?: ResourceDetectionConfig): Promise<IResource>;
}
export declare const awsEksDetector: AwsEksDetector;
//# sourceMappingURL=AwsEksDetector.d.ts.map