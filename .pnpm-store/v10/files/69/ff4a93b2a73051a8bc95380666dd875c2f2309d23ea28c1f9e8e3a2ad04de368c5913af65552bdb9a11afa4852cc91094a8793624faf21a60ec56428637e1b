import { DetectorSync, IResource, ResourceDetectionConfig } from '@opentelemetry/resources';
/**
 * The AwsEksDetectorSync can be used to detect if a process is running in AWS Elastic
 * Kubernetes and return a {@link Resource} populated with data about the Kubernetes
 * plugins of AWS X-Ray. Returns an empty Resource if detection fails.
 *
 * See https://docs.amazonaws.cn/en_us/xray/latest/devguide/xray-guide.pdf
 * for more details about detecting information for Elastic Kubernetes plugins
 */
export declare class AwsEksDetectorSync implements DetectorSync {
    readonly K8S_SVC_URL = "kubernetes.default.svc";
    readonly K8S_TOKEN_PATH = "/var/run/secrets/kubernetes.io/serviceaccount/token";
    readonly K8S_CERT_PATH = "/var/run/secrets/kubernetes.io/serviceaccount/ca.crt";
    readonly AUTH_CONFIGMAP_PATH = "/api/v1/namespaces/kube-system/configmaps/aws-auth";
    readonly CW_CONFIGMAP_PATH = "/api/v1/namespaces/amazon-cloudwatch/configmaps/cluster-info";
    readonly CONTAINER_ID_LENGTH = 64;
    readonly DEFAULT_CGROUP_PATH = "/proc/self/cgroup";
    readonly TIMEOUT_MS = 2000;
    readonly UTF8_UNICODE = "utf8";
    private static readFileAsync;
    private static fileAccessAsync;
    detect(_config?: ResourceDetectionConfig): IResource;
    /**
     * The AwsEksDetector can be used to detect if a process is running on Amazon
     * Elastic Kubernetes and returns a promise containing a {@link ResourceAttributes}
     * object with instance metadata. Returns a promise containing an
     * empty {@link ResourceAttributes} if the connection to kubernetes process
     * or aws config maps fails
     */
    private _getAttributes;
    /**
     * Attempts to make a connection to AWS Config map which will
     * determine whether the process is running on an EKS
     * process if the config map is empty or not
     */
    private _isEks;
    /**
     * Attempts to make a connection to Amazon Cloudwatch
     * Config Maps to grab cluster name
     */
    private _getClusterName;
    /**
     * Reads the Kubernetes token path and returns kubernetes
     * credential header
     */
    private _getK8sCredHeader;
    /**
     * Read container ID from cgroup file generated from docker which lists the full
     * untruncated docker container ID at the end of each line.
     *
     * The predefined structure of calling /proc/self/cgroup when in a docker container has the structure:
     *
     * #:xxxxxx:/
     *
     * or
     *
     * #:xxxxxx:/docker/64characterID
     *
     * This function takes advantage of that fact by just reading the 64-character ID from the end of the
     * first line. In EKS, even if we fail to find target file or target file does
     * not contain container ID we do not throw an error but throw warning message
     * and then return null string
     */
    private _getContainerId;
    /**
     * Establishes an HTTP connection to AWS instance document url.
     * If the application is running on an EKS instance, we should be able
     * to get back a valid JSON document. Parses that document and stores
     * the identity properties in a local map.
     */
    private _fetchString;
}
export declare const awsEksDetectorSync: AwsEksDetectorSync;
//# sourceMappingURL=AwsEksDetectorSync.d.ts.map