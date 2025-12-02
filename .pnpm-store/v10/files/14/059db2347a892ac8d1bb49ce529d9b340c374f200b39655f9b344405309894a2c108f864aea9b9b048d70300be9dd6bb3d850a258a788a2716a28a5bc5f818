import { DetectorSync, IResource } from '@opentelemetry/resources';
/**
 * The AwsEcsDetector can be used to detect if a process is running in AWS
 * ECS and return a {@link Resource} populated with data about the ECS
 * plugins of AWS X-Ray. Returns an empty Resource if detection fails.
 */
export declare class AwsEcsDetectorSync implements DetectorSync {
    static readonly CONTAINER_ID_LENGTH = 64;
    static readonly DEFAULT_CGROUP_PATH = "/proc/self/cgroup";
    private static readFileAsync;
    detect(): IResource;
    private _getAttributes;
    /**
     * Read container ID from cgroup file
     * In ECS, even if we fail to find target file
     * or target file does not contain container ID
     * we do not throw an error but throw warning message
     * and then return null string
     */
    private static _getContainerIdAndHostnameResource;
    private static _getMetadataV4Resource;
    private static _getLogResource;
    private static _getAccountFromArn;
    private static _getRegionFromArn;
    private static _getUrlAsJson;
}
export declare const awsEcsDetectorSync: AwsEcsDetectorSync;
//# sourceMappingURL=AwsEcsDetectorSync.d.ts.map