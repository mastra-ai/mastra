import { DetectorSync, ResourceDetectionConfig, IResource } from '@opentelemetry/resources';
/**
 * The GcpDetector can be used to detect if a process is running in the Google
 * Cloud Platform and return a {@link Resource} populated with metadata about
 * the instance. Returns an empty Resource if detection fails.
 */
declare class GcpDetector implements DetectorSync {
    detect(_config?: ResourceDetectionConfig): IResource;
    /**
     * Attempts to connect and obtain instance configuration data from the GCP metadata service.
     * If the connection is successful it returns a promise containing a {@link ResourceAttributes}
     * object with instance metadata. Returns a promise containing an
     * empty {@link ResourceAttributes} if the connection or parsing of the metadata fails.
     */
    private _getAttributes;
    /** Add resource attributes for K8s */
    private _addK8sAttributes;
    /** Gets project id from GCP project metadata. */
    private _getProjectId;
    /** Gets instance id from GCP instance metadata. */
    private _getInstanceId;
    /** Gets zone from GCP instance metadata. */
    private _getZone;
    /** Gets cluster name from GCP instance metadata. */
    private _getClusterName;
    /** Gets hostname from GCP instance metadata. */
    private _getHostname;
}
export declare const gcpDetector: GcpDetector;
export {};
//# sourceMappingURL=GcpDetector.d.ts.map