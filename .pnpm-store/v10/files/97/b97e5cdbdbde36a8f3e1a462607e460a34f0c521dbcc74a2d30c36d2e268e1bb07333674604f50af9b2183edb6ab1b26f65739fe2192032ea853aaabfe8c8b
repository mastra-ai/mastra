// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../resource';
import * as Core from '../../../core';
import { SinglePage } from '../../../pagination';

export class Telemetry extends APIResource {
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
  keys(
    params: TelemetryKeysParams,
    options?: Core.RequestOptions,
  ): Core.PagePromise<TelemetryKeysResponsesSinglePage, TelemetryKeysResponse> {
    const { account_id, ...body } = params;
    return this._client.getAPIList(
      `/accounts/${account_id}/workers/observability/telemetry/keys`,
      TelemetryKeysResponsesSinglePage,
      { body, method: 'post', ...options },
    );
  }

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
  query(
    params: TelemetryQueryParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<TelemetryQueryResponse> {
    const { account_id, ...body } = params;
    return (
      this._client.post(`/accounts/${account_id}/workers/observability/telemetry/query`, {
        body,
        ...options,
      }) as Core.APIPromise<{ result: TelemetryQueryResponse }>
    )._thenUnwrap((obj) => obj.result);
  }

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
  values(
    params: TelemetryValuesParams,
    options?: Core.RequestOptions,
  ): Core.PagePromise<TelemetryValuesResponsesSinglePage, TelemetryValuesResponse> {
    const { account_id, ...body } = params;
    return this._client.getAPIList(
      `/accounts/${account_id}/workers/observability/telemetry/values`,
      TelemetryValuesResponsesSinglePage,
      { body, method: 'post', ...options },
    );
  }
}

export class TelemetryKeysResponsesSinglePage extends SinglePage<TelemetryKeysResponse> {}

export class TelemetryValuesResponsesSinglePage extends SinglePage<TelemetryValuesResponse> {}

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

  invocations?: { [key: string]: Array<TelemetryQueryResponse.Invocation> };

  patterns?: Array<TelemetryQueryResponse.Pattern>;
}

export namespace TelemetryQueryResponse {
  /**
   * A Workers Observability Query Object
   */
  export interface Run {
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

  export namespace Run {
    export interface Query {
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

    export namespace Query {
      export interface Parameters {
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

      export namespace Parameters {
        export interface Calculation {
          operator:
            | 'uniq'
            | 'count'
            | 'max'
            | 'min'
            | 'sum'
            | 'avg'
            | 'median'
            | 'p001'
            | 'p01'
            | 'p05'
            | 'p10'
            | 'p25'
            | 'p75'
            | 'p90'
            | 'p95'
            | 'p99'
            | 'p999'
            | 'stddev'
            | 'variance'
            | 'COUNT_DISTINCT'
            | 'COUNT'
            | 'MAX'
            | 'MIN'
            | 'SUM'
            | 'AVG'
            | 'MEDIAN'
            | 'P001'
            | 'P01'
            | 'P05'
            | 'P10'
            | 'P25'
            | 'P75'
            | 'P90'
            | 'P95'
            | 'P99'
            | 'P999'
            | 'STDDEV'
            | 'VARIANCE';

          alias?: string;

          key?: string;

          keyType?: 'string' | 'number' | 'boolean';
        }

        export interface Filter {
          key: string;

          operation:
            | 'includes'
            | 'not_includes'
            | 'starts_with'
            | 'regex'
            | 'exists'
            | 'is_null'
            | 'in'
            | 'not_in'
            | 'eq'
            | 'neq'
            | 'gt'
            | 'gte'
            | 'lt'
            | 'lte'
            | '='
            | '!='
            | '>'
            | '>='
            | '<'
            | '<='
            | 'INCLUDES'
            | 'DOES_NOT_INCLUDE'
            | 'MATCH_REGEX'
            | 'EXISTS'
            | 'DOES_NOT_EXIST'
            | 'IN'
            | 'NOT_IN'
            | 'STARTS_WITH';

          type: 'string' | 'number' | 'boolean';

          value?: string | number | boolean;
        }

        export interface GroupBy {
          type: 'string' | 'number' | 'boolean';

          value: string;
        }

        export interface Having {
          key: string;

          operation: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte';

          value: number;
        }

        /**
         * Define an expression to search using full-text search.
         */
        export interface Needle {
          value: string | number | boolean;

          isRegex?: boolean;

          matchCase?: boolean;
        }

        /**
         * Configure the order of the results returned by the query.
         */
        export interface OrderBy {
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

    export interface Timeframe {
      /**
       * Set the start time for your query using UNIX time in milliseconds.
       */
      from: number;

      /**
       * Set the end time for your query using UNIX time in milliseconds.
       */
      to: number;
    }

    export interface Statistics {
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
  export interface Statistics {
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

  export interface Calculation {
    aggregates: Array<Calculation.Aggregate>;

    calculation: string;

    series: Array<Calculation.Series>;

    alias?: string;
  }

  export namespace Calculation {
    export interface Aggregate {
      count: number;

      interval: number;

      sampleInterval: number;

      value: number;

      groups?: Array<Aggregate.Group>;
    }

    export namespace Aggregate {
      export interface Group {
        key: string;

        value: string | number | boolean;
      }
    }

    export interface Series {
      data: Array<Series.Data>;

      time: string;
    }

    export namespace Series {
      export interface Data {
        count: number;

        firstSeen: string;

        interval: number;

        lastSeen: string;

        sampleInterval: number;

        value: number;

        groups?: Array<Data.Group>;
      }

      export namespace Data {
        export interface Group {
          key: string;

          value: string | number | boolean;
        }
      }
    }
  }

  export interface Compare {
    aggregates: Array<Compare.Aggregate>;

    calculation: string;

    series: Array<Compare.Series>;

    alias?: string;
  }

  export namespace Compare {
    export interface Aggregate {
      count: number;

      interval: number;

      sampleInterval: number;

      value: number;

      groups?: Array<Aggregate.Group>;
    }

    export namespace Aggregate {
      export interface Group {
        key: string;

        value: string | number | boolean;
      }
    }

    export interface Series {
      data: Array<Series.Data>;

      time: string;
    }

    export namespace Series {
      export interface Data {
        count: number;

        firstSeen: string;

        interval: number;

        lastSeen: string;

        sampleInterval: number;

        value: number;

        groups?: Array<Data.Group>;
      }

      export namespace Data {
        export interface Group {
          key: string;

          value: string | number | boolean;
        }
      }
    }
  }

  export interface Events {
    count?: number;

    events?: Array<Events.Event>;

    fields?: Array<Events.Field>;

    series?: Array<Events.Series>;
  }

  export namespace Events {
    /**
     * The data structure of a telemetry event
     */
    export interface Event {
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

    export namespace Event {
      export interface Metadata {
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

      export interface UnionMember0 {
        eventType:
          | 'fetch'
          | 'scheduled'
          | 'alarm'
          | 'cron'
          | 'queue'
          | 'email'
          | 'tail'
          | 'rpc'
          | 'websocket'
          | 'unknown';

        outcome: string;

        requestId: string;

        scriptName: string;

        entrypoint?: string;

        event?: {
          [key: string]:
            | string
            | number
            | boolean
            | {
                [key: string]:
                  | string
                  | number
                  | boolean
                  | { [key: string]: Array<string | number | boolean> | string | number | boolean };
              };
        };

        executionModel?: 'durableObject' | 'stateless';

        scriptVersion?: UnionMember0.ScriptVersion;

        truncated?: boolean;
      }

      export namespace UnionMember0 {
        export interface ScriptVersion {
          id?: string;

          message?: string;

          tag?: string;
        }
      }

      export interface UnionMember1 {
        cpuTimeMs: number;

        eventType:
          | 'fetch'
          | 'scheduled'
          | 'alarm'
          | 'cron'
          | 'queue'
          | 'email'
          | 'tail'
          | 'rpc'
          | 'websocket'
          | 'unknown';

        outcome: string;

        requestId: string;

        scriptName: string;

        wallTimeMs: number;

        diagnosticsChannelEvents?: Array<UnionMember1.DiagnosticsChannelEvent>;

        dispatchNamespace?: string;

        entrypoint?: string;

        event?: { [key: string]: string | number | boolean };

        executionModel?: 'durableObject' | 'stateless';

        scriptVersion?: UnionMember1.ScriptVersion;

        truncated?: boolean;
      }

      export namespace UnionMember1 {
        export interface DiagnosticsChannelEvent {
          channel: string;

          message: string;

          timestamp: number;
        }

        export interface ScriptVersion {
          id?: string;

          message?: string;

          tag?: string;
        }
      }
    }

    export interface Field {
      key: string;

      type: string;
    }

    export interface Series {
      data: Array<Series.Data>;

      time: string;
    }

    export namespace Series {
      export interface Data {
        aggregates: Data.Aggregates;

        count: number;

        interval: number;

        sampleInterval: number;

        errors?: number;

        /**
         * Groups in the query results.
         */
        groups?: { [key: string]: string | number | boolean };
      }

      export namespace Data {
        export interface Aggregates {
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
  export interface Invocation {
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

  export namespace Invocation {
    export interface Metadata {
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

    export interface UnionMember0 {
      eventType:
        | 'fetch'
        | 'scheduled'
        | 'alarm'
        | 'cron'
        | 'queue'
        | 'email'
        | 'tail'
        | 'rpc'
        | 'websocket'
        | 'unknown';

      outcome: string;

      requestId: string;

      scriptName: string;

      entrypoint?: string;

      event?: {
        [key: string]:
          | string
          | number
          | boolean
          | {
              [key: string]:
                | string
                | number
                | boolean
                | { [key: string]: Array<string | number | boolean> | string | number | boolean };
            };
      };

      executionModel?: 'durableObject' | 'stateless';

      scriptVersion?: UnionMember0.ScriptVersion;

      truncated?: boolean;
    }

    export namespace UnionMember0 {
      export interface ScriptVersion {
        id?: string;

        message?: string;

        tag?: string;
      }
    }

    export interface UnionMember1 {
      cpuTimeMs: number;

      eventType:
        | 'fetch'
        | 'scheduled'
        | 'alarm'
        | 'cron'
        | 'queue'
        | 'email'
        | 'tail'
        | 'rpc'
        | 'websocket'
        | 'unknown';

      outcome: string;

      requestId: string;

      scriptName: string;

      wallTimeMs: number;

      diagnosticsChannelEvents?: Array<UnionMember1.DiagnosticsChannelEvent>;

      dispatchNamespace?: string;

      entrypoint?: string;

      event?: { [key: string]: string | number | boolean };

      executionModel?: 'durableObject' | 'stateless';

      scriptVersion?: UnionMember1.ScriptVersion;

      truncated?: boolean;
    }

    export namespace UnionMember1 {
      export interface DiagnosticsChannelEvent {
        channel: string;

        message: string;

        timestamp: number;
      }

      export interface ScriptVersion {
        id?: string;

        message?: string;

        tag?: string;
      }
    }
  }

  export interface Pattern {
    count: number;

    pattern: string;

    series: Array<Pattern.Series>;

    service: string;
  }

  export namespace Pattern {
    export interface Series {
      data: Series.Data;

      time: string;
    }

    export namespace Series {
      export interface Data {
        count: number;

        interval: number;

        sampleInterval: number;

        value: number;

        groups?: Array<Data.Group>;
      }

      export namespace Data {
        export interface Group {
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

export namespace TelemetryKeysParams {
  export interface Filter {
    key: string;

    operation:
      | 'includes'
      | 'not_includes'
      | 'starts_with'
      | 'regex'
      | 'exists'
      | 'is_null'
      | 'in'
      | 'not_in'
      | 'eq'
      | 'neq'
      | 'gt'
      | 'gte'
      | 'lt'
      | 'lte'
      | '='
      | '!='
      | '>'
      | '>='
      | '<'
      | '<='
      | 'INCLUDES'
      | 'DOES_NOT_INCLUDE'
      | 'MATCH_REGEX'
      | 'EXISTS'
      | 'DOES_NOT_EXIST'
      | 'IN'
      | 'NOT_IN'
      | 'STARTS_WITH';

    type: 'string' | 'number' | 'boolean';

    value?: string | number | boolean;
  }

  /**
   * Search for a specific substring in the keys.
   */
  export interface KeyNeedle {
    value: string | number | boolean;

    isRegex?: boolean;

    matchCase?: boolean;
  }

  /**
   * Search for a specific substring in the event.
   */
  export interface Needle {
    value: string | number | boolean;

    isRegex?: boolean;

    matchCase?: boolean;
  }

  export interface Timeframe {
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

export namespace TelemetryQueryParams {
  export interface Timeframe {
    from: number;

    to: number;
  }

  export interface Parameters {
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

  export namespace Parameters {
    export interface Calculation {
      operator:
        | 'uniq'
        | 'count'
        | 'max'
        | 'min'
        | 'sum'
        | 'avg'
        | 'median'
        | 'p001'
        | 'p01'
        | 'p05'
        | 'p10'
        | 'p25'
        | 'p75'
        | 'p90'
        | 'p95'
        | 'p99'
        | 'p999'
        | 'stddev'
        | 'variance'
        | 'COUNT_DISTINCT'
        | 'COUNT'
        | 'MAX'
        | 'MIN'
        | 'SUM'
        | 'AVG'
        | 'MEDIAN'
        | 'P001'
        | 'P01'
        | 'P05'
        | 'P10'
        | 'P25'
        | 'P75'
        | 'P90'
        | 'P95'
        | 'P99'
        | 'P999'
        | 'STDDEV'
        | 'VARIANCE';

      alias?: string;

      key?: string;

      keyType?: 'string' | 'number' | 'boolean';
    }

    export interface Filter {
      key: string;

      operation:
        | 'includes'
        | 'not_includes'
        | 'starts_with'
        | 'regex'
        | 'exists'
        | 'is_null'
        | 'in'
        | 'not_in'
        | 'eq'
        | 'neq'
        | 'gt'
        | 'gte'
        | 'lt'
        | 'lte'
        | '='
        | '!='
        | '>'
        | '>='
        | '<'
        | '<='
        | 'INCLUDES'
        | 'DOES_NOT_INCLUDE'
        | 'MATCH_REGEX'
        | 'EXISTS'
        | 'DOES_NOT_EXIST'
        | 'IN'
        | 'NOT_IN'
        | 'STARTS_WITH';

      type: 'string' | 'number' | 'boolean';

      value?: string | number | boolean;
    }

    export interface GroupBy {
      type: 'string' | 'number' | 'boolean';

      value: string;
    }

    export interface Having {
      key: string;

      operation: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte';

      value: number;
    }

    /**
     * Define an expression to search using full-text search.
     */
    export interface Needle {
      value: string | number | boolean;

      isRegex?: boolean;

      matchCase?: boolean;
    }

    /**
     * Configure the order of the results returned by the query.
     */
    export interface OrderBy {
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

export namespace TelemetryValuesParams {
  export interface Timeframe {
    from: number;

    to: number;
  }

  export interface Filter {
    key: string;

    operation:
      | 'includes'
      | 'not_includes'
      | 'starts_with'
      | 'regex'
      | 'exists'
      | 'is_null'
      | 'in'
      | 'not_in'
      | 'eq'
      | 'neq'
      | 'gt'
      | 'gte'
      | 'lt'
      | 'lte'
      | '='
      | '!='
      | '>'
      | '>='
      | '<'
      | '<='
      | 'INCLUDES'
      | 'DOES_NOT_INCLUDE'
      | 'MATCH_REGEX'
      | 'EXISTS'
      | 'DOES_NOT_EXIST'
      | 'IN'
      | 'NOT_IN'
      | 'STARTS_WITH';

    type: 'string' | 'number' | 'boolean';

    value?: string | number | boolean;
  }

  /**
   * Search for a specific substring in the event.
   */
  export interface Needle {
    value: string | number | boolean;

    isRegex?: boolean;

    matchCase?: boolean;
  }
}

Telemetry.TelemetryKeysResponsesSinglePage = TelemetryKeysResponsesSinglePage;
Telemetry.TelemetryValuesResponsesSinglePage = TelemetryValuesResponsesSinglePage;

export declare namespace Telemetry {
  export {
    type TelemetryKeysResponse as TelemetryKeysResponse,
    type TelemetryQueryResponse as TelemetryQueryResponse,
    type TelemetryValuesResponse as TelemetryValuesResponse,
    TelemetryKeysResponsesSinglePage as TelemetryKeysResponsesSinglePage,
    TelemetryValuesResponsesSinglePage as TelemetryValuesResponsesSinglePage,
    type TelemetryKeysParams as TelemetryKeysParams,
    type TelemetryQueryParams as TelemetryQueryParams,
    type TelemetryValuesParams as TelemetryValuesParams,
  };
}
