import { InstrumentationConfig } from '@opentelemetry/instrumentation';
import { Span } from '@opentelemetry/api';
export interface Row {
    get(columnName: string | number): any;
    keys(): string[];
    forEach(callback: (row: Row) => void): void;
    values(): any[];
    [key: string]: any;
}
export interface ResultSet {
    rows: Row[];
}
export interface ResponseHookInfo {
    response: ResultSet;
}
export interface CassandraDriverResponseCustomAttributeFunction {
    (span: Span, responseInfo: ResponseHookInfo): void;
}
export interface CassandraDriverInstrumentationConfig extends InstrumentationConfig {
    /**
     * Include database statements with spans.
     * These can contain sensitive information when using unescaped queries.
     * @default false
     */
    enhancedDatabaseReporting?: boolean;
    /**
     * Max recorded query length.
     * @default 65536
     */
    maxQueryLength?: number;
    /**
     * Function for adding custom attributes before response is handled.
     * @param span the current span
     * @param responseInfo array of the resulting rows. This will only return the first page of results
     */
    responseHook?: CassandraDriverResponseCustomAttributeFunction;
}
//# sourceMappingURL=types.d.ts.map