import { APIResource } from "../../../resource.js";
import * as Core from "../../../core.js";
import { SinglePage } from "../../../pagination.js";
export declare class Telemetry extends APIResource {
    /**
     * List all the keys in your telemetry events.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const telemetryKeysResponse of client.workers.observability.telemetry.keys(
     *   { account_id: 'account_id' },
     * )) {
     *   // ...
     * }
     * ```
     */
    keys(params: TelemetryKeysParams, options?: Core.RequestOptions): Core.PagePromise<TelemetryKeysResponsesSinglePage, TelemetryKeysResponse>;
    /**
     * Runs a temporary or saved query
     *
     * @example
     * ```ts
     * const response =
     *   await client.workers.observability.telemetry.query({
     *     account_id: 'account_id',
     *     queryId: 'queryId',
     *     timeframe: { from: 0, to: 0 },
     *   });
     * ```
     */
    query(params: TelemetryQueryParams, options?: Core.RequestOptions): Core.APIPromise<TelemetryQueryResponse>;
    /**
     * List unique values found in your events
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const telemetryValuesResponse of client.workers.observability.telemetry.values(
     *   {
     *     account_id: 'account_id',
     *     datasets: ['string'],
     *     key: 'key',
     *     timeframe: { from: 0, to: 0 },
     *     type: 'string',
     *   },
     * )) {
     *   // ...
     * }
     * ```
     */
    values(params: TelemetryValuesParams, options?: Core.RequestOptions): Core.PagePromise<TelemetryValuesResponsesSinglePage, TelemetryValuesResponse>;
}
export declare class TelemetryKeysResponsesSinglePage extends SinglePage<TelemetryKeysResponse> {
}
export declare class TelemetryValuesResponsesSinglePage extends SinglePage<TelemetryValuesResponse> {
}
export interface TelemetryKeysResponse {
    key: string;
    lastSeenAt: number;
    type: 'string' | 'boolean' | 'number';
}
export interface TelemetryQueryResponse {
    /**
     * A Workers Observability Query Object
     */
    run: TelemetryQueryResponse.Run;
    /**
     * The statistics object contains information about query performance from the
     * database, it does not include any network latency
     */
    statistics: TelemetryQueryResponse.Statistics;
    calculations?: Array<TelemetryQueryResponse.Calculation>;
    compare?: Array<TelemetryQueryResponse.Compare>;
    events?: TelemetryQueryResponse.Events;
    invocations?: {
        [key: string]: Array<TelemetryQueryResponse.Invocation>;
    };
    patterns?: Array<TelemetryQueryResponse.Pattern>;
}
export declare namespace TelemetryQueryResponse {
    /**
     * A Workers Observability Query Object
     */
    interface Run {
        id: string;
        accountId: string;
        dry: boolean;
        /**
         * @deprecated
         */
        environmentId: string;
        granularity: number;
        query: Run.Query;
        status: 'STARTED' | 'COMPLETED';
        timeframe: Run.Timeframe;
        userId: string;
        /**
         * @deprecated
         */
        workspaceId: string;
        created?: string;
        statistics?: Run.Statistics;
        updated?: string;
    }
    namespace Run {
        interface Query {
            /**
             * ID of the query
             */
            id: string;
            created: string;
            description: string | null;
            /**
             * ID of your environment
             */
            environmentId: string;
            /**
             * Flag for alerts automatically created
             */
            generated: boolean | null;
            /**
             * Query name
             */
            name: string | null;
            parameters: Query.Parameters;
            updated: string;
            userId: string;
            /**
             * ID of your workspace
             */
            workspaceId: string;
        }
        namespace Query {
            interface Parameters {
                /**
                 * Create Calculations to compute as part of the query.
                 */
                calculations?: Array<Parameters.Calculation>;
                /**
                 * Set the Datasets to query. Leave it empty to query all the datasets.
                 */
                datasets?: Array<string>;
                /**
                 * Set a Flag to describe how to combine the filters on the query.
                 */
                filterCombination?: 'and' | 'or' | 'AND' | 'OR';
                /**
                 * Configure the Filters to apply to the query.
                 */
                filters?: Array<Parameters.Filter>;
                /**
                 * Define how to group the results of the query.
                 */
                groupBys?: Array<Parameters.GroupBy>;
                /**
                 * Configure the Having clauses that filter on calculations in the query result.
                 */
                havings?: Array<Parameters.Having>;
                /**
                 * Set a limit on the number of results / records returned by the query
                 */
                limit?: number;
                /**
                 * Define an expression to search using full-text search.
                 */
                needle?: Parameters.Needle;
                /**
                 * Configure the order of the results returned by the query.
                 */
                orderBy?: Parameters.OrderBy;
            }
            namespace Parameters {
                interface Calculation {
                    operator: 'uniq' | 'count' | 'max' | 'min' | 'sum' | 'avg' | 'median' | 'p001' | 'p01' | 'p05' | 'p10' | 'p25' | 'p75' | 'p90' | 'p95' | 'p99' | 'p999' | 'stddev' | 'variance' | 'COUNT_DISTINCT' | 'COUNT' | 'MAX' | 'MIN' | 'SUM' | 'AVG' | 'MEDIAN' | 'P001' | 'P01' | 'P05' | 'P10' | 'P25' | 'P75' | 'P90' | 'P95' | 'P99' | 'P999' | 'STDDEV' | 'VARIANCE';
                    alias?: string;
                    key?: string;
                    keyType?: 'string' | 'number' | 'boolean';
                }
                interface Filter {
                    key: string;
                    operation: 'includes' | 'not_includes' | 'starts_with' | 'regex' | 'exists' | 'is_null' | 'in' | 'not_in' | 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | '=' | '!=' | '>' | '>=' | '<' | '<=' | 'INCLUDES' | 'DOES_NOT_INCLUDE' | 'MATCH_REGEX' | 'EXISTS' | 'DOES_NOT_EXIST' | 'IN' | 'NOT_IN' | 'STARTS_WITH';
                    type: 'string' | 'number' | 'boolean';
                    value?: string | number | boolean;
                }
                interface GroupBy {
                    type: 'string' | 'number' | 'boolean';
                    value: string;
                }
                interface Having {
                    key: string;
                    operation: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte';
                    value: number;
                }
                /**
                 * Define an expression to search using full-text search.
                 */
                interface Needle {
                    value: string | number | boolean;
                    isRegex?: boolean;
                    matchCase?: boolean;
                }
                /**
                 * Configure the order of the results returned by the query.
                 */
                interface OrderBy {
                    /**
                     * Configure which Calculation to order the results by.
                     */
                    value: string;
                    /**
                     * Set the order of the results
                     */
                    order?: 'asc' | 'desc';
                }
            }
        }
        interface Timeframe {
            /**
             * Set the start time for your query using UNIX time in milliseconds.
             */
            from: number;
            /**
             * Set the end time for your query using UNIX time in milliseconds.
             */
            to: number;
        }
        interface Statistics {
            /**
             * Number of uncompressed bytes read from the table.
             */
            bytes_read: number;
            /**
             * Time in seconds for the query to run.
             */
            elapsed: number;
            /**
             * Number of rows scanned from the table.
             */
            rows_read: number;
        }
    }
    /**
     * The statistics object contains information about query performance from the
     * database, it does not include any network latency
     */
    interface Statistics {
        /**
         * Number of uncompressed bytes read from the table.
         */
        bytes_read: number;
        /**
         * Time in seconds for the query to run.
         */
        elapsed: number;
        /**
         * Number of rows scanned from the table.
         */
        rows_read: number;
    }
    interface Calculation {
        aggregates: Array<Calculation.Aggregate>;
        calculation: string;
        series: Array<Calculation.Series>;
        alias?: string;
    }
    namespace Calculation {
        interface Aggregate {
            count: number;
            interval: number;
            sampleInterval: number;
            value: number;
            groups?: Array<Aggregate.Group>;
        }
        namespace Aggregate {
            interface Group {
                key: string;
                value: string | number | boolean;
            }
        }
        interface Series {
            data: Array<Series.Data>;
            time: string;
        }
        namespace Series {
            interface Data {
                count: number;
                firstSeen: string;
                interval: number;
                lastSeen: string;
                sampleInterval: number;
                value: number;
                groups?: Array<Data.Group>;
            }
            namespace Data {
                interface Group {
                    key: string;
                    value: string | number | boolean;
                }
            }
        }
    }
    interface Compare {
        aggregates: Array<Compare.Aggregate>;
        calculation: string;
        series: Array<Compare.Series>;
        alias?: string;
    }
    namespace Compare {
        interface Aggregate {
            count: number;
            interval: number;
            sampleInterval: number;
            value: number;
            groups?: Array<Aggregate.Group>;
        }
        namespace Aggregate {
            interface Group {
                key: string;
                value: string | number | boolean;
            }
        }
        interface Series {
            data: Array<Series.Data>;
            time: string;
        }
        namespace Series {
            interface Data {
                count: number;
                firstSeen: string;
                interval: number;
                lastSeen: string;
                sampleInterval: number;
                value: number;
                groups?: Array<Data.Group>;
            }
            namespace Data {
                interface Group {
                    key: string;
                    value: string | number | boolean;
                }
            }
        }
    }
    interface Events {
        count?: number;
        events?: Array<Events.Event>;
        fields?: Array<Events.Field>;
        series?: Array<Events.Series>;
    }
    namespace Events {
        /**
         * The data structure of a telemetry event
         */
        interface Event {
            $metadata: Event.Metadata;
            dataset: string;
            source: string | unknown;
            timestamp: number;
            /**
             * Cloudflare Workers event information enriches your logs so you can easily
             * identify and debug issues.
             */
            $workers?: Event.UnionMember0 | Event.UnionMember1;
        }
        namespace Event {
            interface Metadata {
                id: string;
                account?: string;
                cloudService?: string;
                coldStart?: number;
                cost?: number;
                duration?: number;
                endTime?: number;
                error?: string;
                errorTemplate?: string;
                fingerprint?: string;
                level?: string;
                message?: string;
                messageTemplate?: string;
                metricName?: string;
                origin?: string;
                parentSpanId?: string;
                provider?: string;
                region?: string;
                requestId?: string;
                service?: string;
                spanId?: string;
                spanName?: string;
                stackId?: string;
                startTime?: number;
                statusCode?: number;
                traceDuration?: number;
                traceId?: string;
                trigger?: string;
                type?: string;
                url?: string;
            }
            interface UnionMember0 {
                eventType: 'fetch' | 'scheduled' | 'alarm' | 'cron' | 'queue' | 'email' | 'tail' | 'rpc' | 'websocket' | 'unknown';
                outcome: string;
                requestId: string;
                scriptName: string;
                entrypoint?: string;
                event?: {
                    [key: string]: string | number | boolean | {
                        [key: string]: string | number | boolean | {
                            [key: string]: Array<string | number | boolean> | string | number | boolean;
                        };
                    };
                };
                executionModel?: 'durableObject' | 'stateless';
                scriptVersion?: UnionMember0.ScriptVersion;
                truncated?: boolean;
            }
            namespace UnionMember0 {
                interface ScriptVersion {
                    id?: string;
                    message?: string;
                    tag?: string;
                }
            }
            interface UnionMember1 {
                cpuTimeMs: number;
                eventType: 'fetch' | 'scheduled' | 'alarm' | 'cron' | 'queue' | 'email' | 'tail' | 'rpc' | 'websocket' | 'unknown';
                outcome: string;
                requestId: string;
                scriptName: string;
                wallTimeMs: number;
                diagnosticsChannelEvents?: Array<UnionMember1.DiagnosticsChannelEvent>;
                dispatchNamespace?: string;
                entrypoint?: string;
                event?: {
                    [key: string]: string | number | boolean;
                };
                executionModel?: 'durableObject' | 'stateless';
                scriptVersion?: UnionMember1.ScriptVersion;
                truncated?: boolean;
            }
            namespace UnionMember1 {
                interface DiagnosticsChannelEvent {
                    channel: string;
                    message: string;
                    timestamp: number;
                }
                interface ScriptVersion {
                    id?: string;
                    message?: string;
                    tag?: string;
                }
            }
        }
        interface Field {
            key: string;
            type: string;
        }
        interface Series {
            data: Array<Series.Data>;
            time: string;
        }
        namespace Series {
            interface Data {
                aggregates: Data.Aggregates;
                count: number;
                interval: number;
                sampleInterval: number;
                errors?: number;
                /**
                 * Groups in the query results.
                 */
                groups?: {
                    [key: string]: string | number | boolean;
                };
            }
            namespace Data {
                interface Aggregates {
                    /**
                     * @deprecated
                     */
                    _count: number;
                    /**
                     * @deprecated
                     */
                    _firstSeen: string;
                    /**
                     * @deprecated
                     */
                    _interval: number;
                    /**
                     * @deprecated
                     */
                    _lastSeen: string;
                    /**
                     * @deprecated
                     */
                    bin?: unknown;
                }
            }
        }
    }
    /**
     * The data structure of a telemetry event
     */
    interface Invocation {
        $metadata: Invocation.Metadata;
        dataset: string;
        source: string | unknown;
        timestamp: number;
        /**
         * Cloudflare Workers event information enriches your logs so you can easily
         * identify and debug issues.
         */
        $workers?: Invocation.UnionMember0 | Invocation.UnionMember1;
    }
    namespace Invocation {
        interface Metadata {
            id: string;
            account?: string;
            cloudService?: string;
            coldStart?: number;
            cost?: number;
            duration?: number;
            endTime?: number;
            error?: string;
            errorTemplate?: string;
            fingerprint?: string;
            level?: string;
            message?: string;
            messageTemplate?: string;
            metricName?: string;
            origin?: string;
            parentSpanId?: string;
            provider?: string;
            region?: string;
            requestId?: string;
            service?: string;
            spanId?: string;
            spanName?: string;
            stackId?: string;
            startTime?: number;
            statusCode?: number;
            traceDuration?: number;
            traceId?: string;
            trigger?: string;
            type?: string;
            url?: string;
        }
        interface UnionMember0 {
            eventType: 'fetch' | 'scheduled' | 'alarm' | 'cron' | 'queue' | 'email' | 'tail' | 'rpc' | 'websocket' | 'unknown';
            outcome: string;
            requestId: string;
            scriptName: string;
            entrypoint?: string;
            event?: {
                [key: string]: string | number | boolean | {
                    [key: string]: string | number | boolean | {
                        [key: string]: Array<string | number | boolean> | string | number | boolean;
                    };
                };
            };
            executionModel?: 'durableObject' | 'stateless';
            scriptVersion?: UnionMember0.ScriptVersion;
            truncated?: boolean;
        }
        namespace UnionMember0 {
            interface ScriptVersion {
                id?: string;
                message?: string;
                tag?: string;
            }
        }
        interface UnionMember1 {
            cpuTimeMs: number;
            eventType: 'fetch' | 'scheduled' | 'alarm' | 'cron' | 'queue' | 'email' | 'tail' | 'rpc' | 'websocket' | 'unknown';
            outcome: string;
            requestId: string;
            scriptName: string;
            wallTimeMs: number;
            diagnosticsChannelEvents?: Array<UnionMember1.DiagnosticsChannelEvent>;
            dispatchNamespace?: string;
            entrypoint?: string;
            event?: {
                [key: string]: string | number | boolean;
            };
            executionModel?: 'durableObject' | 'stateless';
            scriptVersion?: UnionMember1.ScriptVersion;
            truncated?: boolean;
        }
        namespace UnionMember1 {
            interface DiagnosticsChannelEvent {
                channel: string;
                message: string;
                timestamp: number;
            }
            interface ScriptVersion {
                id?: string;
                message?: string;
                tag?: string;
            }
        }
    }
    interface Pattern {
        count: number;
        pattern: string;
        series: Array<Pattern.Series>;
        service: string;
    }
    namespace Pattern {
        interface Series {
            data: Series.Data;
            time: string;
        }
        namespace Series {
            interface Data {
                count: number;
                interval: number;
                sampleInterval: number;
                value: number;
                groups?: Array<Data.Group>;
            }
            namespace Data {
                interface Group {
                    key: string;
                    value: string | number | boolean;
                }
            }
        }
    }
}
export interface TelemetryValuesResponse {
    dataset: string;
    key: string;
    type: 'string' | 'boolean' | 'number';
    value: string | number | boolean;
}
export interface TelemetryKeysParams {
    /**
     * Path param: Your Cloudflare account ID.
     */
    account_id: string;
    /**
     * Body param:
     */
    datasets?: Array<string>;
    /**
     * Body param:
     */
    filters?: Array<TelemetryKeysParams.Filter>;
    /**
     * Body param: Search for a specific substring in the keys.
     */
    keyNeedle?: TelemetryKeysParams.KeyNeedle;
    /**
     * Body param:
     */
    limit?: number;
    /**
     * Body param: Search for a specific substring in the event.
     */
    needle?: TelemetryKeysParams.Needle;
    /**
     * Body param:
     */
    timeframe?: TelemetryKeysParams.Timeframe;
}
export declare namespace TelemetryKeysParams {
    interface Filter {
        key: string;
        operation: 'includes' | 'not_includes' | 'starts_with' | 'regex' | 'exists' | 'is_null' | 'in' | 'not_in' | 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | '=' | '!=' | '>' | '>=' | '<' | '<=' | 'INCLUDES' | 'DOES_NOT_INCLUDE' | 'MATCH_REGEX' | 'EXISTS' | 'DOES_NOT_EXIST' | 'IN' | 'NOT_IN' | 'STARTS_WITH';
        type: 'string' | 'number' | 'boolean';
        value?: string | number | boolean;
    }
    /**
     * Search for a specific substring in the keys.
     */
    interface KeyNeedle {
        value: string | number | boolean;
        isRegex?: boolean;
        matchCase?: boolean;
    }
    /**
     * Search for a specific substring in the event.
     */
    interface Needle {
        value: string | number | boolean;
        isRegex?: boolean;
        matchCase?: boolean;
    }
    interface Timeframe {
        from: number;
        to: number;
    }
}
export interface TelemetryQueryParams {
    /**
     * Path param: Your Cloudflare account ID.
     */
    account_id: string;
    /**
     * Body param:
     */
    queryId: string;
    /**
     * Body param:
     */
    timeframe: TelemetryQueryParams.Timeframe;
    /**
     * Body param:
     */
    chart?: boolean;
    /**
     * Body param:
     */
    compare?: boolean;
    /**
     * Body param:
     */
    dry?: boolean;
    /**
     * Body param:
     */
    granularity?: number;
    /**
     * Body param:
     */
    ignoreSeries?: boolean;
    /**
     * Body param:
     */
    limit?: number;
    /**
     * Body param:
     */
    offset?: string;
    /**
     * Body param:
     */
    offsetBy?: number;
    /**
     * Body param:
     */
    offsetDirection?: string;
    /**
     * Body param:
     */
    parameters?: TelemetryQueryParams.Parameters;
    /**
     * Body param:
     */
    patternType?: 'message' | 'error';
    /**
     * Body param:
     */
    view?: 'traces' | 'events' | 'calculations' | 'invocations' | 'requests' | 'patterns';
}
export declare namespace TelemetryQueryParams {
    interface Timeframe {
        from: number;
        to: number;
    }
    interface Parameters {
        /**
         * Create Calculations to compute as part of the query.
         */
        calculations?: Array<Parameters.Calculation>;
        /**
         * Set the Datasets to query. Leave it empty to query all the datasets.
         */
        datasets?: Array<string>;
        /**
         * Set a Flag to describe how to combine the filters on the query.
         */
        filterCombination?: 'and' | 'or' | 'AND' | 'OR';
        /**
         * Configure the Filters to apply to the query.
         */
        filters?: Array<Parameters.Filter>;
        /**
         * Define how to group the results of the query.
         */
        groupBys?: Array<Parameters.GroupBy>;
        /**
         * Configure the Having clauses that filter on calculations in the query result.
         */
        havings?: Array<Parameters.Having>;
        /**
         * Set a limit on the number of results / records returned by the query
         */
        limit?: number;
        /**
         * Define an expression to search using full-text search.
         */
        needle?: Parameters.Needle;
        /**
         * Configure the order of the results returned by the query.
         */
        orderBy?: Parameters.OrderBy;
    }
    namespace Parameters {
        interface Calculation {
            operator: 'uniq' | 'count' | 'max' | 'min' | 'sum' | 'avg' | 'median' | 'p001' | 'p01' | 'p05' | 'p10' | 'p25' | 'p75' | 'p90' | 'p95' | 'p99' | 'p999' | 'stddev' | 'variance' | 'COUNT_DISTINCT' | 'COUNT' | 'MAX' | 'MIN' | 'SUM' | 'AVG' | 'MEDIAN' | 'P001' | 'P01' | 'P05' | 'P10' | 'P25' | 'P75' | 'P90' | 'P95' | 'P99' | 'P999' | 'STDDEV' | 'VARIANCE';
            alias?: string;
            key?: string;
            keyType?: 'string' | 'number' | 'boolean';
        }
        interface Filter {
            key: string;
            operation: 'includes' | 'not_includes' | 'starts_with' | 'regex' | 'exists' | 'is_null' | 'in' | 'not_in' | 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | '=' | '!=' | '>' | '>=' | '<' | '<=' | 'INCLUDES' | 'DOES_NOT_INCLUDE' | 'MATCH_REGEX' | 'EXISTS' | 'DOES_NOT_EXIST' | 'IN' | 'NOT_IN' | 'STARTS_WITH';
            type: 'string' | 'number' | 'boolean';
            value?: string | number | boolean;
        }
        interface GroupBy {
            type: 'string' | 'number' | 'boolean';
            value: string;
        }
        interface Having {
            key: string;
            operation: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte';
            value: number;
        }
        /**
         * Define an expression to search using full-text search.
         */
        interface Needle {
            value: string | number | boolean;
            isRegex?: boolean;
            matchCase?: boolean;
        }
        /**
         * Configure the order of the results returned by the query.
         */
        interface OrderBy {
            /**
             * Configure which Calculation to order the results by.
             */
            value: string;
            /**
             * Set the order of the results
             */
            order?: 'asc' | 'desc';
        }
    }
}
export interface TelemetryValuesParams {
    /**
     * Path param: Your Cloudflare account ID.
     */
    account_id: string;
    /**
     * Body param:
     */
    datasets: Array<string>;
    /**
     * Body param:
     */
    key: string;
    /**
     * Body param:
     */
    timeframe: TelemetryValuesParams.Timeframe;
    /**
     * Body param:
     */
    type: 'string' | 'boolean' | 'number';
    /**
     * Body param:
     */
    filters?: Array<TelemetryValuesParams.Filter>;
    /**
     * Body param:
     */
    limit?: number;
    /**
     * Body param: Search for a specific substring in the event.
     */
    needle?: TelemetryValuesParams.Needle;
}
export declare namespace TelemetryValuesParams {
    interface Timeframe {
        from: number;
        to: number;
    }
    interface Filter {
        key: string;
        operation: 'includes' | 'not_includes' | 'starts_with' | 'regex' | 'exists' | 'is_null' | 'in' | 'not_in' | 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | '=' | '!=' | '>' | '>=' | '<' | '<=' | 'INCLUDES' | 'DOES_NOT_INCLUDE' | 'MATCH_REGEX' | 'EXISTS' | 'DOES_NOT_EXIST' | 'IN' | 'NOT_IN' | 'STARTS_WITH';
        type: 'string' | 'number' | 'boolean';
        value?: string | number | boolean;
    }
    /**
     * Search for a specific substring in the event.
     */
    interface Needle {
        value: string | number | boolean;
        isRegex?: boolean;
        matchCase?: boolean;
    }
}
export declare namespace Telemetry {
    export { type TelemetryKeysResponse as TelemetryKeysResponse, type TelemetryQueryResponse as TelemetryQueryResponse, type TelemetryValuesResponse as TelemetryValuesResponse, TelemetryKeysResponsesSinglePage as TelemetryKeysResponsesSinglePage, TelemetryValuesResponsesSinglePage as TelemetryValuesResponsesSinglePage, type TelemetryKeysParams as TelemetryKeysParams, type TelemetryQueryParams as TelemetryQueryParams, type TelemetryValuesParams as TelemetryValuesParams, };
}
//# sourceMappingURL=telemetry.d.ts.map