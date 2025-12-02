import { DetectorSync, IResource, ResourceAttributes, ResourceDetectionConfig } from '@opentelemetry/resources';
export declare class AwsBeanstalkDetectorSync implements DetectorSync {
    BEANSTALK_CONF_PATH: string;
    private static readFileAsync;
    private static fileAccessAsync;
    constructor();
    detect(config?: ResourceDetectionConfig): IResource;
    /**
     * Attempts to obtain AWS Beanstalk configuration from the file
     * system. If file is accesible and read succesfully it returns
     * a promise containing a {@link ResourceAttributes}
     * object with instance metadata. Returns a promise containing an
     * empty {@link ResourceAttributes} if the file is not accesible or
     * fails in the reading process.
     */
    _getAttributes(_config?: ResourceDetectionConfig): Promise<ResourceAttributes>;
}
export declare const awsBeanstalkDetectorSync: AwsBeanstalkDetectorSync;
//# sourceMappingURL=AwsBeanstalkDetectorSync.d.ts.map