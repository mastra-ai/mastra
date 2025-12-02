import { ResourceMetrics } from '@opentelemetry/sdk-metrics';
import { IResource } from '@opentelemetry/resources';
export declare class PrometheusSerializer {
    private _prefix;
    private _appendTimestamp;
    constructor(prefix?: string, appendTimestamp?: boolean);
    serialize(resourceMetrics: ResourceMetrics): string;
    private _serializeScopeMetrics;
    private _serializeMetricData;
    private _serializeSingularDataPoint;
    private _serializeHistogramDataPoint;
    protected _serializeResource(resource: IResource): string;
}
//# sourceMappingURL=PrometheusSerializer.d.ts.map