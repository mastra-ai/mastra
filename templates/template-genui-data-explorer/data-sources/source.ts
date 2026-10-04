export type Scalar = string | number | boolean | null;
export type SourceSettings = Readonly<Record<string, Scalar>>;
export interface DateRange {
  start: string;
  end: string;
}

export interface AnalysisRequest {
  metric: string;
  period?: DateRange;
  asOf?: string;
  baseline?: DateRange;
  horizon?: DateRange;
  filters?: Readonly<Record<string, Scalar>>;
}

export interface SourceDescriptor {
  id: string;
  title: string;
  version: string;
  datasetVersion: string;
  coverage?: DateRange;
  asOf?: string;
  metadata: Readonly<Record<string, Scalar>>;
  capabilities: readonly {
    metric: string;
    description: string;
    unit: string;
    fields: readonly (keyof Omit<AnalysisRequest, "metric">)[];
    filters: readonly string[];
  }[];
  examples: readonly { title: string; request: AnalysisRequest }[];
}

export interface AnalysisResult {
  metric: string;
  request: AnalysisRequest;
  status: "available" | "unavailable";
  value: number | null;
  unit: string;
  numerator: number | null;
  denominator: number | null;
  reason: string | null;
  period?: DateRange;
  details?: Readonly<
    Record<
      string,
      | Scalar
      | DateRange
      | Readonly<Record<string, number>>
      | readonly Readonly<Record<string, Scalar>>[]
    >
  >;
  provenance: {
    sourceId: string;
    sourceVersion: string;
    datasetVersion: string;
    metricVersion: string;
    asOf?: string;
    coverage?: DateRange;
    complete: boolean;
  };
}

/** Read-only analyses advertised by a source; no shared business metric is mandatory. */
export interface DataSource {
  describe(): SourceDescriptor;
  execute(request: AnalysisRequest): Promise<AnalysisResult>;
  close(): void | Promise<void>;
}

export interface SourceRegistration {
  id: string;
  enabled?: boolean;
  open(settings: SourceSettings): DataSource | Promise<DataSource>;
}
