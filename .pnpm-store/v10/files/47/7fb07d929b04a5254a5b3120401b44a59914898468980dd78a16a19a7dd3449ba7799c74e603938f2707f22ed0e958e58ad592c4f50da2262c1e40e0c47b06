"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseAggregateOptions = exports.FT_AGGREGATE_GROUP_BY_REDUCERS = exports.FT_AGGREGATE_STEPS = void 0;
const SEARCH_1 = require("./SEARCH");
const generic_transformers_1 = require("@redis/client/dist/lib/commands/generic-transformers");
const default_1 = require("../dialect/default");
exports.FT_AGGREGATE_STEPS = {
    GROUPBY: 'GROUPBY',
    SORTBY: 'SORTBY',
    APPLY: 'APPLY',
    LIMIT: 'LIMIT',
    FILTER: 'FILTER'
};
exports.FT_AGGREGATE_GROUP_BY_REDUCERS = {
    COUNT: 'COUNT',
    COUNT_DISTINCT: 'COUNT_DISTINCT',
    COUNT_DISTINCTISH: 'COUNT_DISTINCTISH',
    SUM: 'SUM',
    MIN: 'MIN',
    MAX: 'MAX',
    AVG: 'AVG',
    STDDEV: 'STDDEV',
    QUANTILE: 'QUANTILE',
    TOLIST: 'TOLIST',
    FIRST_VALUE: 'FIRST_VALUE',
    RANDOM_SAMPLE: 'RANDOM_SAMPLE'
};
;
exports.default = {
    NOT_KEYED_COMMAND: true,
    IS_READ_ONLY: false,
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
    parseCommand(parser, index, query, options) {
        parser.push('FT.AGGREGATE', index, query);
        return parseAggregateOptions(parser, options);
    },
    transformReply: {
        2: (rawReply, preserve, typeMapping) => {
            const results = [];
            for (let i = 1; i < rawReply.length; i++) {
                results.push((0, generic_transformers_1.transformTuplesReply)(rawReply[i], preserve, typeMapping));
            }
            return {
                //  https://redis.io/docs/latest/commands/ft.aggregate/#return
                //  FT.AGGREGATE returns an array reply where each row is an array reply and represents a single aggregate result.
                // The integer reply at position 1 does not represent a valid value.
                total: Number(rawReply[0]),
                results
            };
        },
        3: undefined
    },
    unstableResp3: true
};
function parseAggregateOptions(parser, options) {
    if (options?.VERBATIM) {
        parser.push('VERBATIM');
    }
    if (options?.ADDSCORES) {
        parser.push('ADDSCORES');
    }
    if (options?.LOAD) {
        const args = [];
        if (Array.isArray(options.LOAD)) {
            for (const load of options.LOAD) {
                pushLoadField(args, load);
            }
        }
        else {
            pushLoadField(args, options.LOAD);
        }
        parser.push('LOAD');
        parser.pushVariadicWithLength(args);
    }
    if (options?.TIMEOUT !== undefined) {
        parser.push('TIMEOUT', options.TIMEOUT.toString());
    }
    if (options?.STEPS) {
        for (const step of options.STEPS) {
            parser.push(step.type);
            switch (step.type) {
                case exports.FT_AGGREGATE_STEPS.GROUPBY:
                    if (!step.properties) {
                        parser.push('0');
                    }
                    else {
                        parser.pushVariadicWithLength(step.properties);
                    }
                    if (Array.isArray(step.REDUCE)) {
                        for (const reducer of step.REDUCE) {
                            parseGroupByReducer(parser, reducer);
                        }
                    }
                    else {
                        parseGroupByReducer(parser, step.REDUCE);
                    }
                    break;
                case exports.FT_AGGREGATE_STEPS.SORTBY:
                    const args = [];
                    if (Array.isArray(step.BY)) {
                        for (const by of step.BY) {
                            pushSortByProperty(args, by);
                        }
                    }
                    else {
                        pushSortByProperty(args, step.BY);
                    }
                    if (step.MAX) {
                        args.push('MAX', step.MAX.toString());
                    }
                    parser.pushVariadicWithLength(args);
                    break;
                case exports.FT_AGGREGATE_STEPS.APPLY:
                    parser.push(step.expression, 'AS', step.AS);
                    break;
                case exports.FT_AGGREGATE_STEPS.LIMIT:
                    parser.push(step.from.toString(), step.size.toString());
                    break;
                case exports.FT_AGGREGATE_STEPS.FILTER:
                    parser.push(step.expression);
                    break;
            }
        }
    }
    (0, SEARCH_1.parseParamsArgument)(parser, options?.PARAMS);
    if (options?.DIALECT) {
        parser.push('DIALECT', options.DIALECT.toString());
    }
    else {
        parser.push('DIALECT', default_1.DEFAULT_DIALECT);
    }
}
exports.parseAggregateOptions = parseAggregateOptions;
function pushLoadField(args, toLoad) {
    if (typeof toLoad === 'string' || toLoad instanceof Buffer) {
        args.push(toLoad);
    }
    else {
        args.push(toLoad.identifier);
        if (toLoad.AS) {
            args.push('AS', toLoad.AS);
        }
    }
}
function parseGroupByReducer(parser, reducer) {
    parser.push('REDUCE', reducer.type);
    switch (reducer.type) {
        case exports.FT_AGGREGATE_GROUP_BY_REDUCERS.COUNT:
            parser.push('0');
            break;
        case exports.FT_AGGREGATE_GROUP_BY_REDUCERS.COUNT_DISTINCT:
        case exports.FT_AGGREGATE_GROUP_BY_REDUCERS.COUNT_DISTINCTISH:
        case exports.FT_AGGREGATE_GROUP_BY_REDUCERS.SUM:
        case exports.FT_AGGREGATE_GROUP_BY_REDUCERS.MIN:
        case exports.FT_AGGREGATE_GROUP_BY_REDUCERS.MAX:
        case exports.FT_AGGREGATE_GROUP_BY_REDUCERS.AVG:
        case exports.FT_AGGREGATE_GROUP_BY_REDUCERS.STDDEV:
        case exports.FT_AGGREGATE_GROUP_BY_REDUCERS.TOLIST:
            parser.push('1', reducer.property);
            break;
        case exports.FT_AGGREGATE_GROUP_BY_REDUCERS.QUANTILE:
            parser.push('2', reducer.property, reducer.quantile.toString());
            break;
        case exports.FT_AGGREGATE_GROUP_BY_REDUCERS.FIRST_VALUE: {
            const args = [reducer.property];
            if (reducer.BY) {
                args.push('BY');
                if (typeof reducer.BY === 'string' || reducer.BY instanceof Buffer) {
                    args.push(reducer.BY);
                }
                else {
                    args.push(reducer.BY.property);
                    if (reducer.BY.direction) {
                        args.push(reducer.BY.direction);
                    }
                }
            }
            parser.pushVariadicWithLength(args);
            break;
        }
        case exports.FT_AGGREGATE_GROUP_BY_REDUCERS.RANDOM_SAMPLE:
            parser.push('2', reducer.property, reducer.sampleSize.toString());
            break;
    }
    if (reducer.AS) {
        parser.push('AS', reducer.AS);
    }
}
function pushSortByProperty(args, sortBy) {
    if (typeof sortBy === 'string' || sortBy instanceof Buffer) {
        args.push(sortBy);
    }
    else {
        args.push(sortBy.BY);
        if (sortBy.DIRECTION) {
            args.push(sortBy.DIRECTION);
        }
    }
}
//# sourceMappingURL=AGGREGATE.js.map