import { DetectorSync, IResource, ResourceAttributes, ResourceDetectionConfig } from '@opentelemetry/resources';
/**
 * The AwsEc2DetectorSync can be used to detect if a process is running in AWS EC2
 * and return a {@link Resource} populated with metadata about the EC2
 * instance. Returns an empty Resource if detection fails.
 */
declare class AwsEc2DetectorSync implements DetectorSync {
    /**
     * See https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/instance-identity-documents.html
     * for documentation about the AWS instance identity document
     * and standard of IMDSv2.
     */
    readonly AWS_IDMS_ENDPOINT = "169.254.169.254";
    readonly AWS_INSTANCE_TOKEN_DOCUMENT_PATH = "/latest/api/token";
    readonly AWS_INSTANCE_IDENTITY_DOCUMENT_PATH = "/latest/dynamic/instance-identity/document";
    readonly AWS_INSTANCE_HOST_DOCUMENT_PATH = "/latest/meta-data/hostname";
    readonly AWS_METADATA_TTL_HEADER = "X-aws-ec2-metadata-token-ttl-seconds";
    readonly AWS_METADATA_TOKEN_HEADER = "X-aws-ec2-metadata-token";
    readonly MILLISECOND_TIME_OUT = 5000;
    detect(_config?: ResourceDetectionConfig): IResource;
    /**
     * Attempts to connect and obtain an AWS instance Identity document. If the
     * connection is successful it returns a promise containing a {@link ResourceAttributes}
     * object with instance metadata. Returns a promise containing an
     * empty {@link ResourceAttributes} if the connection or parsing of the identity
     * document fails.
     */
    _getAttributes(): Promise<ResourceAttributes>;
    private _fetchToken;
    private _fetchIdentity;
    private _fetchHost;
    /**
     * Establishes an HTTP connection to AWS instance document url.
     * If the application is running on an EC2 instance, we should be able
     * to get back a valid JSON document. Parses that document and stores
     * the identity properties in a local map.
     */
    private _fetchString;
}
export declare const awsEc2DetectorSync: AwsEc2DetectorSync;
export {};
//# sourceMappingURL=AwsEc2DetectorSync.d.ts.map