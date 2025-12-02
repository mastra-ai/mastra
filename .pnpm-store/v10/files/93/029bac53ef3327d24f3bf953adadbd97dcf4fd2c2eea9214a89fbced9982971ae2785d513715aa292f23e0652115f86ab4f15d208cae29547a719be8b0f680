import { CommandParser } from '@redis/client/dist/lib/client/parser';
import { ArrayReply, BlobStringReply, MapReply, NumberReply, RedisArgument, ReplyUnion, TypeMapping, UnwrapReply } from '@redis/client/dist/lib/RESP/types';
import { RediSearchProperty } from './CREATE';
import { FtSearchParams } from './SEARCH';
type LoadField = RediSearchProperty | {
    identifier: RediSearchProperty;
    AS?: RedisArgument;
};
export declare const FT_AGGREGATE_STEPS: {
    readonly GROUPBY: "GROUPBY";
    readonly SORTBY: "SORTBY";
    readonly APPLY: "APPLY";
    readonly LIMIT: "LIMIT";
    readonly FILTER: "FILTER";
};
type FT_AGGREGATE_STEPS = typeof FT_AGGREGATE_STEPS;
export type FtAggregateStep = FT_AGGREGATE_STEPS[keyof FT_AGGREGATE_STEPS];
interface AggregateStep<T extends FtAggregateStep> {
    type: T;
}
export declare const FT_AGGREGATE_GROUP_BY_REDUCERS: {
    readonly COUNT: "COUNT";
    readonly COUNT_DISTINCT: "COUNT_DISTINCT";
    readonly COUNT_DISTINCTISH: "COUNT_DISTINCTISH";
    readonly SUM: "SUM";
    readonly MIN: "MIN";
    readonly MAX: "MAX";
    readonly AVG: "AVG";
    readonly STDDEV: "STDDEV";
    readonly QUANTILE: "QUANTILE";
    readonly TOLIST: "TOLIST";
    readonly FIRST_VALUE: "FIRST_VALUE";
    readonly RANDOM_SAMPLE: "RANDOM_SAMPLE";
};
type FT_AGGREGATE_GROUP_BY_REDUCERS = typeof FT_AGGREGATE_GROUP_BY_REDUCERS;
export type FtAggregateGroupByReducer = FT_AGGREGATE_GROUP_BY_REDUCERS[keyof FT_AGGREGATE_GROUP_BY_REDUCERS];
interface GroupByReducer<T extends FtAggregateGroupByReducer> {
    type: T;
    AS?: RedisArgument;
}
interface GroupByReducerWithProperty<T extends FtAggregateGroupByReducer> extends GroupByReducer<T> {
    property: RediSearchProperty;
}
type CountReducer = GroupByReducer<FT_AGGREGATE_GROUP_BY_REDUCERS['COUNT']>;
type CountDistinctReducer = GroupByReducerWithProperty<FT_AGGREGATE_GROUP_BY_REDUCERS['COUNT_DISTINCT']>;
type CountDistinctishReducer = GroupByReducerWithProperty<FT_AGGREGATE_GROUP_BY_REDUCERS['COUNT_DISTINCTISH']>;
type SumReducer = GroupByReducerWithProperty<FT_AGGREGATE_GROUP_BY_REDUCERS['SUM']>;
type MinReducer = GroupByReducerWithProperty<FT_AGGREGATE_GROUP_BY_REDUCERS['MIN']>;
type MaxReducer = GroupByReducerWithProperty<FT_AGGREGATE_GROUP_BY_REDUCERS['MAX']>;
type AvgReducer = GroupByReducerWithProperty<FT_AGGREGATE_GROUP_BY_REDUCERS['AVG']>;
type StdDevReducer = GroupByReducerWithProperty<FT_AGGREGATE_GROUP_BY_REDUCERS['STDDEV']>;
interface QuantileReducer extends GroupByReducerWithProperty<FT_AGGREGATE_GROUP_BY_REDUCERS['QUANTILE']> {
    quantile: number;
}
type ToListReducer = GroupByReducerWithProperty<FT_AGGREGATE_GROUP_BY_REDUCERS['TOLIST']>;
interface FirstValueReducer extends GroupByReducerWithProperty<FT_AGGREGATE_GROUP_BY_REDUCERS['FIRST_VALUE']> {
    BY?: RediSearchProperty | {
        property: RediSearchProperty;
        direction?: 'ASC' | 'DESC';
    };
}
interface RandomSampleReducer extends GroupByReducerWithProperty<FT_AGGREGATE_GROUP_BY_REDUCERS['RANDOM_SAMPLE']> {
    sampleSize: number;
}
type GroupByReducers = CountReducer | CountDistinctReducer | CountDistinctishReducer | SumReducer | MinReducer | MaxReducer | AvgReducer | StdDevReducer | QuantileReducer | ToListReducer | FirstValueReducer | RandomSampleReducer;
interface GroupByStep extends AggregateStep<FT_AGGREGATE_STEPS['GROUPBY']> {
    properties?: RediSearchProperty | Array<RediSearchProperty>;
    REDUCE: GroupByReducers | Array<GroupByReducers>;
}
type SortByProperty = RedisArgument | {
    BY: RediSearchProperty;
    DIRECTION?: 'ASC' | 'DESC';
};
interface SortStep extends AggregateStep<FT_AGGREGATE_STEPS['SORTBY']> {
    BY: SortByProperty | Array<SortByProperty>;
    MAX?: number;
}
interface ApplyStep extends AggregateStep<FT_AGGREGATE_STEPS['APPLY']> {
    expression: RedisArgument;
    AS: RedisArgument;
}
interface LimitStep extends AggregateStep<FT_AGGREGATE_STEPS['LIMIT']> {
    from: number;
    size: number;
}
interface FilterStep extends AggregateStep<FT_AGGREGATE_STEPS['FILTER']> {
    expression: RedisArgument;
}
export interface FtAggregateOptions {
    VERBATIM?: boolean;
    ADDSCORES?: boolean;
    LOAD?: LoadField | Array<LoadField>;
    TIMEOUT?: number;
    STEPS?: Array<GroupByStep | SortStep | ApplyStep | LimitStep | FilterStep>;
    PARAMS?: FtSearchParams;
    DIALECT?: number;
}
export type AggregateRawReply = [
    total: UnwrapReply<NumberReply>,
    ...results: UnwrapReply<ArrayReply<ArrayReply<BlobStringReply>>>
];
export interface AggregateReply {
    total: number;
    results: Array<MapReply<BlobStringReply, BlobStringReply>>;
}
declare const _default: {
    readonly NOT_KEYED_COMMAND: true;
    readonly IS_READ_ONLY: false;
    /**
     * Performs an aggregation query on a RediSearch index.
     * @param parser - The command parser
     * @param index - The index name to query
     * @param query - The text query to use as filter, use * to indicate no filtering
     * @param options - Optional parameters for aggregation:
     *   - VERBATIM: disable stemming in query evaluation
     *   - LOAD: specify fields to load from documents
     *   - STEPS: sequence of aggregation steps (GROUPBY, SORTBY, APPLY, LIMIT, FILTER)
     *   - PARAMS: bind parameters for query evaluation
     *   - TIMEOUT: maximum time to run the query
     */
    readonly parseCommand: (this: void, parser: CommandParser, index: RedisArgument, query: RedisArgument, options?: FtAggregateOptions) => void;
    readonly transformReply: {
        readonly 2: (rawReply: [total: UnwrapReply<NumberReply<number>>, ...results: ArrayReply<BlobStringReply<string>>[]], preserve?: any, typeMapping?: TypeMapping) => AggregateReply;
        readonly 3: () => ReplyUnion;
    };
    readonly unstableResp3: true;
};
export default _default;
export declare function parseAggregateOptions(parser: CommandParser, options?: FtAggregateOptions): void;
//# sourceMappingURL=AGGREGATE.d.ts.map