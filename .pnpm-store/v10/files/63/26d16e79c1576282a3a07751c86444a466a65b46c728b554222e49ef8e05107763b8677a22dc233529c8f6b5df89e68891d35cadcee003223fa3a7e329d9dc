import { DetectorSync, IResource, ResourceAttributes, ResourceDetectionConfig } from '@opentelemetry/resources';
/**
 * The AlibabaCloudEcsDetector can be used to detect if a process is running in
 * AlibabaCloud ECS and return a {@link Resource} populated with metadata about
 * the ECS instance. Returns an empty Resource if detection fails.
 */
declare class AlibabaCloudEcsDetector implements DetectorSync {
    /**
     * See https://www.alibabacloud.com/help/doc-detail/67254.htm for
     * documentation about the AlibabaCloud instance identity document.
     */
    readonly ALIBABA_CLOUD_IDMS_ENDPOINT = "100.100.100.200";
    readonly ALIBABA_CLOUD_INSTANCE_IDENTITY_DOCUMENT_PATH = "/latest/dynamic/instance-identity/document";
    readonly ALIBABA_CLOUD_INSTANCE_HOST_DOCUMENT_PATH = "/latest/meta-data/hostname";
    readonly MILLISECONDS_TIME_OUT = 1000;
    /**
     * Attempts to connect and obtain an AlibabaCloud instance Identity document.
     * If the connection is successful it returns a promise containing a
     * {@link Resource} populated with instance metadata.
     *
     * @param config (unused) The resource detection config
     */
    detect(_config?: ResourceDetectionConfig): IResource;
    /** Gets identity and host info and returns them as attribs. Empty object if fails */
    _getAttributes(_config?: ResourceDetectionConfig): Promise<ResourceAttributes>;
    /**
     * Fetch AlibabaCloud instance document url with http requests. If the
     * application is running on an ECS instance, we should be able to get back a
     * valid JSON document. Parses that document and stores the identity
     * properties in a local map.
     */
    private _fetchIdentity;
    private _fetchHost;
    private _fetchString;
}
export declare const alibabaCloudEcsDetector: AlibabaCloudEcsDetector;
export {};
//# sourceMappingURL=AlibabaCloudEcsDetector.d.ts.map