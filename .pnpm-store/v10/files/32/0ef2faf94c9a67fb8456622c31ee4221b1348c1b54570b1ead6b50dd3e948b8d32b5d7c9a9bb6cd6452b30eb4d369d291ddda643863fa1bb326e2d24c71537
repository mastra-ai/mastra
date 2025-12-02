/// <reference types="node" />
export * from './helpers';
declare const _default: {
    readonly ADD: {
        readonly IS_READ_ONLY: false;
        readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, key: import("@redis/client/dist/lib/RESP/types").RedisArgument, timestamp: import("./helpers").Timestamp, value: number, options?: import("./ADD").TsAddOptions | undefined) => void;
        readonly transformReply: () => import("@redis/client/dist/lib/RESP/types").NumberReply<number>;
    };
    readonly add: {
        readonly IS_READ_ONLY: false;
        readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, key: import("@redis/client/dist/lib/RESP/types").RedisArgument, timestamp: import("./helpers").Timestamp, value: number, options?: import("./ADD").TsAddOptions | undefined) => void;
        readonly transformReply: () => import("@redis/client/dist/lib/RESP/types").NumberReply<number>;
    };
    readonly ALTER: {
        readonly IS_READ_ONLY: false;
        readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, key: import("@redis/client/dist/lib/RESP/types").RedisArgument, options?: import("./ALTER").TsAlterOptions | undefined) => void;
        readonly transformReply: () => import("@redis/client/dist/lib/RESP/types").SimpleStringReply<"OK">;
    };
    readonly alter: {
        readonly IS_READ_ONLY: false;
        readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, key: import("@redis/client/dist/lib/RESP/types").RedisArgument, options?: import("./ALTER").TsAlterOptions | undefined) => void;
        readonly transformReply: () => import("@redis/client/dist/lib/RESP/types").SimpleStringReply<"OK">;
    };
    readonly CREATE: {
        readonly IS_READ_ONLY: false;
        readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, key: import("@redis/client/dist/lib/RESP/types").RedisArgument, options?: import("./CREATE").TsCreateOptions | undefined) => void;
        readonly transformReply: () => import("@redis/client/dist/lib/RESP/types").SimpleStringReply<"OK">;
    };
    readonly create: {
        readonly IS_READ_ONLY: false;
        readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, key: import("@redis/client/dist/lib/RESP/types").RedisArgument, options?: import("./CREATE").TsCreateOptions | undefined) => void;
        readonly transformReply: () => import("@redis/client/dist/lib/RESP/types").SimpleStringReply<"OK">;
    };
    readonly CREATERULE: {
        readonly IS_READ_ONLY: false;
        readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, sourceKey: import("@redis/client/dist/lib/RESP/types").RedisArgument, destinationKey: import("@redis/client/dist/lib/RESP/types").RedisArgument, aggregationType: import("./CREATERULE").TimeSeriesAggregationType, bucketDuration: number, alignTimestamp?: number | undefined) => void;
        readonly transformReply: () => import("@redis/client/dist/lib/RESP/types").SimpleStringReply<"OK">;
    };
    readonly createRule: {
        readonly IS_READ_ONLY: false;
        readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, sourceKey: import("@redis/client/dist/lib/RESP/types").RedisArgument, destinationKey: import("@redis/client/dist/lib/RESP/types").RedisArgument, aggregationType: import("./CREATERULE").TimeSeriesAggregationType, bucketDuration: number, alignTimestamp?: number | undefined) => void;
        readonly transformReply: () => import("@redis/client/dist/lib/RESP/types").SimpleStringReply<"OK">;
    };
    readonly DECRBY: {
        readonly IS_READ_ONLY: false;
        readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, key: import("@redis/client/dist/lib/RESP/types").RedisArgument, value: number, options?: import("./INCRBY").TsIncrByOptions | undefined) => void;
        readonly transformReply: () => import("@redis/client/dist/lib/RESP/types").NumberReply<number>;
    };
    readonly decrBy: {
        readonly IS_READ_ONLY: false;
        readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, key: import("@redis/client/dist/lib/RESP/types").RedisArgument, value: number, options?: import("./INCRBY").TsIncrByOptions | undefined) => void;
        readonly transformReply: () => import("@redis/client/dist/lib/RESP/types").NumberReply<number>;
    };
    readonly DEL: {
        readonly IS_READ_ONLY: false;
        readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, key: import("@redis/client/dist/lib/RESP/types").RedisArgument, fromTimestamp: import("./helpers").Timestamp, toTimestamp: import("./helpers").Timestamp) => void;
        readonly transformReply: () => import("@redis/client/dist/lib/RESP/types").NumberReply<number>;
    };
    readonly del: {
        readonly IS_READ_ONLY: false;
        readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, key: import("@redis/client/dist/lib/RESP/types").RedisArgument, fromTimestamp: import("./helpers").Timestamp, toTimestamp: import("./helpers").Timestamp) => void;
        readonly transformReply: () => import("@redis/client/dist/lib/RESP/types").NumberReply<number>;
    };
    readonly DELETERULE: {
        readonly IS_READ_ONLY: false;
        readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, sourceKey: import("@redis/client/dist/lib/RESP/types").RedisArgument, destinationKey: import("@redis/client/dist/lib/RESP/types").RedisArgument) => void;
        readonly transformReply: () => import("@redis/client/dist/lib/RESP/types").SimpleStringReply<"OK">;
    };
    readonly deleteRule: {
        readonly IS_READ_ONLY: false;
        readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, sourceKey: import("@redis/client/dist/lib/RESP/types").RedisArgument, destinationKey: import("@redis/client/dist/lib/RESP/types").RedisArgument) => void;
        readonly transformReply: () => import("@redis/client/dist/lib/RESP/types").SimpleStringReply<"OK">;
    };
    readonly GET: {
        readonly IS_READ_ONLY: true;
        readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, key: import("@redis/client/dist/lib/RESP/types").RedisArgument, options?: import("./GET").TsGetOptions | undefined) => void;
        readonly transformReply: {
            readonly 2: (this: void, reply: import("@redis/client/dist/lib/RESP/types").UnwrapReply<import("@redis/client/dist/lib/RESP/types").Resp2Reply<import("./GET").TsGetReply>>) => {
                timestamp: import("@redis/client/dist/lib/RESP/types").NumberReply<number>;
                value: number;
            } | null;
            readonly 3: (this: void, reply: import("@redis/client/dist/lib/RESP/types").UnwrapReply<import("./GET").TsGetReply>) => {
                timestamp: import("@redis/client/dist/lib/RESP/types").NumberReply<number>;
                value: import("@redis/client/dist/lib/RESP/types").DoubleReply<number>;
            } | null;
        };
    };
    readonly get: {
        readonly IS_READ_ONLY: true;
        readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, key: import("@redis/client/dist/lib/RESP/types").RedisArgument, options?: import("./GET").TsGetOptions | undefined) => void;
        readonly transformReply: {
            readonly 2: (this: void, reply: import("@redis/client/dist/lib/RESP/types").UnwrapReply<import("@redis/client/dist/lib/RESP/types").Resp2Reply<import("./GET").TsGetReply>>) => {
                timestamp: import("@redis/client/dist/lib/RESP/types").NumberReply<number>;
                value: number;
            } | null;
            readonly 3: (this: void, reply: import("@redis/client/dist/lib/RESP/types").UnwrapReply<import("./GET").TsGetReply>) => {
                timestamp: import("@redis/client/dist/lib/RESP/types").NumberReply<number>;
                value: import("@redis/client/dist/lib/RESP/types").DoubleReply<number>;
            } | null;
        };
    };
    readonly INCRBY: {
        readonly IS_READ_ONLY: false;
        readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, key: import("@redis/client/dist/lib/RESP/types").RedisArgument, value: number, options?: import("./INCRBY").TsIncrByOptions | undefined) => void;
        readonly transformReply: () => import("@redis/client/dist/lib/RESP/types").NumberReply<number>;
    };
    readonly incrBy: {
        readonly IS_READ_ONLY: false;
        readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, key: import("@redis/client/dist/lib/RESP/types").RedisArgument, value: number, options?: import("./INCRBY").TsIncrByOptions | undefined) => void;
        readonly transformReply: () => import("@redis/client/dist/lib/RESP/types").NumberReply<number>;
    };
    readonly INFO_DEBUG: {
        readonly IS_READ_ONLY: true;
        readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, key: string) => void;
        readonly transformReply: {
            readonly 2: (this: void, reply: [...import("./INFO").InfoRawReplyTypes[], "keySelfName", import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>, "Chunks", ["startTimestamp", import("@redis/client/dist/lib/RESP/types").NumberReply<number>, "endTimestamp", import("@redis/client/dist/lib/RESP/types").NumberReply<number>, "samples", import("@redis/client/dist/lib/RESP/types").NumberReply<number>, "size", import("@redis/client/dist/lib/RESP/types").NumberReply<number>, "bytesPerSample", import("@redis/client/dist/lib/RESP/types").SimpleStringReply<string>][]], _: any, typeMapping?: import("@redis/client/dist/lib/RESP/types").TypeMapping | undefined) => import("./INFO_DEBUG").InfoDebugReply;
            readonly 3: () => import("@redis/client/dist/lib/RESP/types").ReplyUnion;
        };
        readonly unstableResp3: true;
    };
    readonly infoDebug: {
        readonly IS_READ_ONLY: true;
        readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, key: string) => void;
        readonly transformReply: {
            readonly 2: (this: void, reply: [...import("./INFO").InfoRawReplyTypes[], "keySelfName", import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>, "Chunks", ["startTimestamp", import("@redis/client/dist/lib/RESP/types").NumberReply<number>, "endTimestamp", import("@redis/client/dist/lib/RESP/types").NumberReply<number>, "samples", import("@redis/client/dist/lib/RESP/types").NumberReply<number>, "size", import("@redis/client/dist/lib/RESP/types").NumberReply<number>, "bytesPerSample", import("@redis/client/dist/lib/RESP/types").SimpleStringReply<string>][]], _: any, typeMapping?: import("@redis/client/dist/lib/RESP/types").TypeMapping | undefined) => import("./INFO_DEBUG").InfoDebugReply;
            readonly 3: () => import("@redis/client/dist/lib/RESP/types").ReplyUnion;
        };
        readonly unstableResp3: true;
    };
    readonly INFO: {
        readonly IS_READ_ONLY: true;
        readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, key: string) => void;
        readonly transformReply: {
            readonly 2: (this: void, reply: import("./INFO").InfoRawReply, _: any, typeMapping?: import("@redis/client/dist/lib/RESP/types").TypeMapping | undefined) => import("./INFO").InfoReply;
            readonly 3: () => import("@redis/client/dist/lib/RESP/types").ReplyUnion;
        };
        readonly unstableResp3: true;
    };
    readonly info: {
        readonly IS_READ_ONLY: true;
        readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, key: string) => void;
        readonly transformReply: {
            readonly 2: (this: void, reply: import("./INFO").InfoRawReply, _: any, typeMapping?: import("@redis/client/dist/lib/RESP/types").TypeMapping | undefined) => import("./INFO").InfoReply;
            readonly 3: () => import("@redis/client/dist/lib/RESP/types").ReplyUnion;
        };
        readonly unstableResp3: true;
    };
    readonly MADD: {
        readonly IS_READ_ONLY: false;
        readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, toAdd: import("./MADD").TsMAddSample[]) => void;
        readonly transformReply: () => import("@redis/client/dist/lib/RESP/types").ArrayReply<import("@redis/client/dist/lib/RESP/types").SimpleErrorReply | import("@redis/client/dist/lib/RESP/types").NumberReply<number>>;
    };
    readonly mAdd: {
        readonly IS_READ_ONLY: false;
        readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, toAdd: import("./MADD").TsMAddSample[]) => void;
        readonly transformReply: () => import("@redis/client/dist/lib/RESP/types").ArrayReply<import("@redis/client/dist/lib/RESP/types").SimpleErrorReply | import("@redis/client/dist/lib/RESP/types").NumberReply<number>>;
    };
    readonly MGET_SELECTED_LABELS: {
        readonly IS_READ_ONLY: true;
        readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, filter: import("@redis/client/dist/lib/commands/generic-transformers").RedisVariadicArgument, selectedLabels: import("@redis/client/dist/lib/commands/generic-transformers").RedisVariadicArgument, options?: import("./MGET").TsMGetOptions | undefined) => void;
        readonly transformReply: {
            2(this: void, reply: import("./MGET_WITHLABELS").MGetLabelsRawReply2<import("@redis/client/dist/lib/RESP/types").NullReply | import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>>, _: any, typeMapping?: import("@redis/client/dist/lib/RESP/types").TypeMapping | undefined): import("@redis/client/dist/lib/RESP/types").MapReply<import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>, {
                labels: import("@redis/client/dist/lib/RESP/types").MapReply<import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>, import("@redis/client/dist/lib/RESP/types").NullReply | import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>>;
                sample: {
                    timestamp: import("@redis/client/dist/lib/RESP/types").NumberReply<number>;
                    value: number;
                };
            }>;
            3(this: void, reply: import("./MGET_WITHLABELS").MGetLabelsRawReply3<import("@redis/client/dist/lib/RESP/types").NullReply | import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>>): import("@redis/client/dist/lib/RESP/types").MapReply<import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>, {
                labels: import("@redis/client/dist/lib/RESP/types").MapReply<import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>, import("@redis/client/dist/lib/RESP/types").NullReply | import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>>;
                sample: {
                    timestamp: import("@redis/client/dist/lib/RESP/types").NumberReply<number>;
                    value: import("@redis/client/dist/lib/RESP/types").DoubleReply<number>;
                };
            }>;
        };
    };
    readonly mGetSelectedLabels: {
        readonly IS_READ_ONLY: true;
        readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, filter: import("@redis/client/dist/lib/commands/generic-transformers").RedisVariadicArgument, selectedLabels: import("@redis/client/dist/lib/commands/generic-transformers").RedisVariadicArgument, options?: import("./MGET").TsMGetOptions | undefined) => void;
        readonly transformReply: {
            2(this: void, reply: import("./MGET_WITHLABELS").MGetLabelsRawReply2<import("@redis/client/dist/lib/RESP/types").NullReply | import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>>, _: any, typeMapping?: import("@redis/client/dist/lib/RESP/types").TypeMapping | undefined): import("@redis/client/dist/lib/RESP/types").MapReply<import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>, {
                labels: import("@redis/client/dist/lib/RESP/types").MapReply<import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>, import("@redis/client/dist/lib/RESP/types").NullReply | import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>>;
                sample: {
                    timestamp: import("@redis/client/dist/lib/RESP/types").NumberReply<number>;
                    value: number;
                };
            }>;
            3(this: void, reply: import("./MGET_WITHLABELS").MGetLabelsRawReply3<import("@redis/client/dist/lib/RESP/types").NullReply | import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>>): import("@redis/client/dist/lib/RESP/types").MapReply<import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>, {
                labels: import("@redis/client/dist/lib/RESP/types").MapReply<import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>, import("@redis/client/dist/lib/RESP/types").NullReply | import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>>;
                sample: {
                    timestamp: import("@redis/client/dist/lib/RESP/types").NumberReply<number>;
                    value: import("@redis/client/dist/lib/RESP/types").DoubleReply<number>;
                };
            }>;
        };
    };
    readonly MGET_WITHLABELS: {
        readonly IS_READ_ONLY: true;
        readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, filter: import("@redis/client/dist/lib/commands/generic-transformers").RedisVariadicArgument, options?: import("./MGET_WITHLABELS").TsMGetWithLabelsOptions | undefined) => void;
        readonly transformReply: {
            2(this: void, reply: import("./MGET_WITHLABELS").MGetLabelsRawReply2<import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>>, _: any, typeMapping?: import("@redis/client/dist/lib/RESP/types").TypeMapping | undefined): import("@redis/client/dist/lib/RESP/types").MapReply<import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>, {
                labels: import("@redis/client/dist/lib/RESP/types").MapReply<import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>, import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>>;
                sample: {
                    timestamp: import("@redis/client/dist/lib/RESP/types").NumberReply<number>;
                    value: number;
                };
            }>;
            3(this: void, reply: import("./MGET_WITHLABELS").MGetLabelsRawReply3<import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>>): import("@redis/client/dist/lib/RESP/types").MapReply<import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>, {
                labels: import("@redis/client/dist/lib/RESP/types").MapReply<import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>, import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>>;
                sample: {
                    timestamp: import("@redis/client/dist/lib/RESP/types").NumberReply<number>;
                    value: import("@redis/client/dist/lib/RESP/types").DoubleReply<number>;
                };
            }>;
        };
    };
    readonly mGetWithLabels: {
        readonly IS_READ_ONLY: true;
        readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, filter: import("@redis/client/dist/lib/commands/generic-transformers").RedisVariadicArgument, options?: import("./MGET_WITHLABELS").TsMGetWithLabelsOptions | undefined) => void;
        readonly transformReply: {
            2(this: void, reply: import("./MGET_WITHLABELS").MGetLabelsRawReply2<import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>>, _: any, typeMapping?: import("@redis/client/dist/lib/RESP/types").TypeMapping | undefined): import("@redis/client/dist/lib/RESP/types").MapReply<import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>, {
                labels: import("@redis/client/dist/lib/RESP/types").MapReply<import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>, import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>>;
                sample: {
                    timestamp: import("@redis/client/dist/lib/RESP/types").NumberReply<number>;
                    value: number;
                };
            }>;
            3(this: void, reply: import("./MGET_WITHLABELS").MGetLabelsRawReply3<import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>>): import("@redis/client/dist/lib/RESP/types").MapReply<import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>, {
                labels: import("@redis/client/dist/lib/RESP/types").MapReply<import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>, import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>>;
                sample: {
                    timestamp: import("@redis/client/dist/lib/RESP/types").NumberReply<number>;
                    value: import("@redis/client/dist/lib/RESP/types").DoubleReply<number>;
                };
            }>;
        };
    };
    readonly MGET: {
        readonly NOT_KEYED_COMMAND: true;
        readonly IS_READ_ONLY: true;
        readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, filter: import("@redis/client/dist/lib/commands/generic-transformers").RedisVariadicArgument, options?: import("./MGET").TsMGetOptions | undefined) => void;
        readonly transformReply: {
            readonly 2: (this: void, reply: import("./MGET").MGetRawReply2, _: any, typeMapping?: import("@redis/client/dist/lib/RESP/types").TypeMapping | undefined) => import("@redis/client/dist/lib/RESP/types").MapReply<import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>, {
                sample: {
                    timestamp: import("@redis/client/dist/lib/RESP/types").NumberReply<number>;
                    value: number;
                };
            }>;
            readonly 3: (this: void, reply: import("./MGET").MGetRawReply3) => import("@redis/client/dist/lib/RESP/types").MapReply<import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>, {
                sample: {
                    timestamp: import("@redis/client/dist/lib/RESP/types").NumberReply<number>;
                    value: import("@redis/client/dist/lib/RESP/types").DoubleReply<number>;
                };
            }>;
        };
    };
    readonly mGet: {
        readonly NOT_KEYED_COMMAND: true;
        readonly IS_READ_ONLY: true;
        readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, filter: import("@redis/client/dist/lib/commands/generic-transformers").RedisVariadicArgument, options?: import("./MGET").TsMGetOptions | undefined) => void;
        readonly transformReply: {
            readonly 2: (this: void, reply: import("./MGET").MGetRawReply2, _: any, typeMapping?: import("@redis/client/dist/lib/RESP/types").TypeMapping | undefined) => import("@redis/client/dist/lib/RESP/types").MapReply<import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>, {
                sample: {
                    timestamp: import("@redis/client/dist/lib/RESP/types").NumberReply<number>;
                    value: number;
                };
            }>;
            readonly 3: (this: void, reply: import("./MGET").MGetRawReply3) => import("@redis/client/dist/lib/RESP/types").MapReply<import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>, {
                sample: {
                    timestamp: import("@redis/client/dist/lib/RESP/types").NumberReply<number>;
                    value: import("@redis/client/dist/lib/RESP/types").DoubleReply<number>;
                };
            }>;
        };
    };
    readonly MRANGE_GROUPBY: {
        readonly IS_READ_ONLY: true;
        readonly parseCommand: (parser: import("@redis/client").CommandParser, fromTimestamp: import("./helpers").Timestamp, toTimestamp: import("./helpers").Timestamp, filter: import("@redis/client/dist/lib/commands/generic-transformers").RedisVariadicArgument, groupBy: import("./MRANGE_GROUPBY").TsMRangeGroupBy, options?: import("./RANGE").TsRangeOptions | undefined) => void;
        readonly transformReply: {
            readonly 2: (this: void, reply: import("./MRANGE_GROUPBY").TsMRangeGroupByRawReply2, _?: any, typeMapping?: import("@redis/client/dist/lib/RESP/types").TypeMapping | undefined) => import("@redis/client/dist/lib/RESP/types").MapReply<import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>, {
                samples: {
                    timestamp: import("@redis/client/dist/lib/RESP/types").NumberReply<number>;
                    value: number;
                }[];
            }>;
            readonly 3: (this: void, reply: import("./MRANGE_GROUPBY").TsMRangeGroupByRawReply3) => import("@redis/client/dist/lib/RESP/types").MapReply<import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>, {
                sources: import("@redis/client/dist/lib/RESP/types").ArrayReply<import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>>;
                samples: {
                    timestamp: import("@redis/client/dist/lib/RESP/types").NumberReply<number>;
                    value: import("@redis/client/dist/lib/RESP/types").DoubleReply<number>;
                }[];
            }>;
        };
    };
    readonly mRangeGroupBy: {
        readonly IS_READ_ONLY: true;
        readonly parseCommand: (parser: import("@redis/client").CommandParser, fromTimestamp: import("./helpers").Timestamp, toTimestamp: import("./helpers").Timestamp, filter: import("@redis/client/dist/lib/commands/generic-transformers").RedisVariadicArgument, groupBy: import("./MRANGE_GROUPBY").TsMRangeGroupBy, options?: import("./RANGE").TsRangeOptions | undefined) => void;
        readonly transformReply: {
            readonly 2: (this: void, reply: import("./MRANGE_GROUPBY").TsMRangeGroupByRawReply2, _?: any, typeMapping?: import("@redis/client/dist/lib/RESP/types").TypeMapping | undefined) => import("@redis/client/dist/lib/RESP/types").MapReply<import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>, {
                samples: {
                    timestamp: import("@redis/client/dist/lib/RESP/types").NumberReply<number>;
                    value: number;
                }[];
            }>;
            readonly 3: (this: void, reply: import("./MRANGE_GROUPBY").TsMRangeGroupByRawReply3) => import("@redis/client/dist/lib/RESP/types").MapReply<import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>, {
                sources: import("@redis/client/dist/lib/RESP/types").ArrayReply<import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>>;
                samples: {
                    timestamp: import("@redis/client/dist/lib/RESP/types").NumberReply<number>;
                    value: import("@redis/client/dist/lib/RESP/types").DoubleReply<number>;
                }[];
            }>;
        };
    };
    readonly MRANGE_SELECTED_LABELS_GROUPBY: {
        readonly IS_READ_ONLY: true;
        readonly parseCommand: (parser: import("@redis/client").CommandParser, fromTimestamp: import("./helpers").Timestamp, toTimestamp: import("./helpers").Timestamp, selectedLabels: import("@redis/client/dist/lib/commands/generic-transformers").RedisVariadicArgument, filter: import("@redis/client/dist/lib/commands/generic-transformers").RedisVariadicArgument, groupBy: import("./MRANGE_GROUPBY").TsMRangeGroupBy, options?: import("./RANGE").TsRangeOptions | undefined) => void;
        readonly transformReply: {
            readonly 2: (this: void, reply: import("./MRANGE_SELECTED_LABELS").TsMRangeSelectedLabelsRawReply2, _?: any, typeMapping?: import("@redis/client/dist/lib/RESP/types").TypeMapping | undefined) => import("@redis/client/dist/lib/RESP/types").MapReply<import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>, {
                labels: import("@redis/client/dist/lib/RESP/types").MapReply<import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>, import("@redis/client/dist/lib/RESP/types").NullReply | import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>>;
                samples: {
                    timestamp: import("@redis/client/dist/lib/RESP/types").NumberReply<number>;
                    value: number;
                }[];
            }>;
            readonly 3: (this: void, reply: import("./MRANGE_SELECTED_LABELS_GROUPBY").TsMRangeWithLabelsGroupByRawReply3) => import("@redis/client/dist/lib/RESP/types").MapReply<import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>, {
                labels: import("@redis/client/dist/lib/RESP/types").MapReply<import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>, import("@redis/client/dist/lib/RESP/types").NullReply | import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>>;
                sources: import("@redis/client/dist/lib/RESP/types").ArrayReply<import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>>;
                samples: {
                    timestamp: import("@redis/client/dist/lib/RESP/types").NumberReply<number>;
                    value: import("@redis/client/dist/lib/RESP/types").DoubleReply<number>;
                }[];
            }>;
        };
    };
    readonly mRangeSelectedLabelsGroupBy: {
        readonly IS_READ_ONLY: true;
        readonly parseCommand: (parser: import("@redis/client").CommandParser, fromTimestamp: import("./helpers").Timestamp, toTimestamp: import("./helpers").Timestamp, selectedLabels: import("@redis/client/dist/lib/commands/generic-transformers").RedisVariadicArgument, filter: import("@redis/client/dist/lib/commands/generic-transformers").RedisVariadicArgument, groupBy: import("./MRANGE_GROUPBY").TsMRangeGroupBy, options?: import("./RANGE").TsRangeOptions | undefined) => void;
        readonly transformReply: {
            readonly 2: (this: void, reply: import("./MRANGE_SELECTED_LABELS").TsMRangeSelectedLabelsRawReply2, _?: any, typeMapping?: import("@redis/client/dist/lib/RESP/types").TypeMapping | undefined) => import("@redis/client/dist/lib/RESP/types").MapReply<import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>, {
                labels: import("@redis/client/dist/lib/RESP/types").MapReply<import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>, import("@redis/client/dist/lib/RESP/types").NullReply | import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>>;
                samples: {
                    timestamp: import("@redis/client/dist/lib/RESP/types").NumberReply<number>;
                    value: number;
                }[];
            }>;
            readonly 3: (this: void, reply: import("./MRANGE_SELECTED_LABELS_GROUPBY").TsMRangeWithLabelsGroupByRawReply3) => import("@redis/client/dist/lib/RESP/types").MapReply<import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>, {
                labels: import("@redis/client/dist/lib/RESP/types").MapReply<import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>, import("@redis/client/dist/lib/RESP/types").NullReply | import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>>;
                sources: import("@redis/client/dist/lib/RESP/types").ArrayReply<import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>>;
                samples: {
                    timestamp: import("@redis/client/dist/lib/RESP/types").NumberReply<number>;
                    value: import("@redis/client/dist/lib/RESP/types").DoubleReply<number>;
                }[];
            }>;
        };
    };
    readonly MRANGE_SELECTED_LABELS: {
        readonly IS_READ_ONLY: true;
        readonly parseCommand: (parser: import("@redis/client").CommandParser, fromTimestamp: import("./helpers").Timestamp, toTimestamp: import("./helpers").Timestamp, selectedLabels: import("@redis/client/dist/lib/commands/generic-transformers").RedisVariadicArgument, filter: import("@redis/client/dist/lib/commands/generic-transformers").RedisVariadicArgument, options?: import("./RANGE").TsRangeOptions | undefined) => void;
        readonly transformReply: {
            readonly 2: (this: void, reply: import("./MRANGE_SELECTED_LABELS").TsMRangeSelectedLabelsRawReply2, _?: any, typeMapping?: import("@redis/client/dist/lib/RESP/types").TypeMapping | undefined) => import("@redis/client/dist/lib/RESP/types").MapReply<import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>, {
                labels: import("@redis/client/dist/lib/RESP/types").MapReply<import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>, import("@redis/client/dist/lib/RESP/types").NullReply | import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>>;
                samples: {
                    timestamp: import("@redis/client/dist/lib/RESP/types").NumberReply<number>;
                    value: number;
                }[];
            }>;
            readonly 3: (this: void, reply: import("./MRANGE_SELECTED_LABELS").TsMRangeSelectedLabelsRawReply3) => import("@redis/client/dist/lib/RESP/types").MapReply<import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>, {
                labels: never;
                samples: {
                    timestamp: import("@redis/client/dist/lib/RESP/types").NumberReply<number>;
                    value: import("@redis/client/dist/lib/RESP/types").DoubleReply<number>;
                }[];
            }>;
        };
    };
    readonly mRangeSelectedLabels: {
        readonly IS_READ_ONLY: true;
        readonly parseCommand: (parser: import("@redis/client").CommandParser, fromTimestamp: import("./helpers").Timestamp, toTimestamp: import("./helpers").Timestamp, selectedLabels: import("@redis/client/dist/lib/commands/generic-transformers").RedisVariadicArgument, filter: import("@redis/client/dist/lib/commands/generic-transformers").RedisVariadicArgument, options?: import("./RANGE").TsRangeOptions | undefined) => void;
        readonly transformReply: {
            readonly 2: (this: void, reply: import("./MRANGE_SELECTED_LABELS").TsMRangeSelectedLabelsRawReply2, _?: any, typeMapping?: import("@redis/client/dist/lib/RESP/types").TypeMapping | undefined) => import("@redis/client/dist/lib/RESP/types").MapReply<import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>, {
                labels: import("@redis/client/dist/lib/RESP/types").MapReply<import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>, import("@redis/client/dist/lib/RESP/types").NullReply | import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>>;
                samples: {
                    timestamp: import("@redis/client/dist/lib/RESP/types").NumberReply<number>;
                    value: number;
                }[];
            }>;
            readonly 3: (this: void, reply: import("./MRANGE_SELECTED_LABELS").TsMRangeSelectedLabelsRawReply3) => import("@redis/client/dist/lib/RESP/types").MapReply<import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>, {
                labels: never;
                samples: {
                    timestamp: import("@redis/client/dist/lib/RESP/types").NumberReply<number>;
                    value: import("@redis/client/dist/lib/RESP/types").DoubleReply<number>;
                }[];
            }>;
        };
    };
    readonly MRANGE_WITHLABELS_GROUPBY: {
        readonly IS_READ_ONLY: true;
        readonly parseCommand: (parser: import("@redis/client").CommandParser, fromTimestamp: import("./helpers").Timestamp, toTimestamp: import("./helpers").Timestamp, filter: import("@redis/client/dist/lib/commands/generic-transformers").RedisVariadicArgument, groupBy: import("./MRANGE_GROUPBY").TsMRangeGroupBy, options?: import("./RANGE").TsRangeOptions | undefined) => void;
        readonly transformReply: {
            readonly 2: (this: void, reply: import("./MRANGE_WITHLABELS_GROUPBY").TsMRangeWithLabelsGroupByRawReply2, _?: any, typeMapping?: import("@redis/client/dist/lib/RESP/types").TypeMapping | undefined) => import("@redis/client/dist/lib/RESP/types").MapReply<import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>, {
                labels: import("@redis/client/dist/lib/RESP/types").MapReply<import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>, import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>>;
                sources: string[] | Buffer[];
                samples: {
                    timestamp: import("@redis/client/dist/lib/RESP/types").NumberReply<number>;
                    value: number;
                }[];
            }>;
            readonly 3: (this: void, reply: import("./MRANGE_WITHLABELS_GROUPBY").TsMRangeWithLabelsGroupByRawReply3) => import("@redis/client/dist/lib/RESP/types").MapReply<import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>, {
                labels: import("@redis/client/dist/lib/RESP/types").MapReply<import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>, import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>>;
                sources: import("@redis/client/dist/lib/RESP/types").ArrayReply<import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>>;
                samples: {
                    timestamp: import("@redis/client/dist/lib/RESP/types").NumberReply<number>;
                    value: import("@redis/client/dist/lib/RESP/types").DoubleReply<number>;
                }[];
            }>;
        };
    };
    readonly mRangeWithLabelsGroupBy: {
        readonly IS_READ_ONLY: true;
        readonly parseCommand: (parser: import("@redis/client").CommandParser, fromTimestamp: import("./helpers").Timestamp, toTimestamp: import("./helpers").Timestamp, filter: import("@redis/client/dist/lib/commands/generic-transformers").RedisVariadicArgument, groupBy: import("./MRANGE_GROUPBY").TsMRangeGroupBy, options?: import("./RANGE").TsRangeOptions | undefined) => void;
        readonly transformReply: {
            readonly 2: (this: void, reply: import("./MRANGE_WITHLABELS_GROUPBY").TsMRangeWithLabelsGroupByRawReply2, _?: any, typeMapping?: import("@redis/client/dist/lib/RESP/types").TypeMapping | undefined) => import("@redis/client/dist/lib/RESP/types").MapReply<import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>, {
                labels: import("@redis/client/dist/lib/RESP/types").MapReply<import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>, import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>>;
                sources: string[] | Buffer[];
                samples: {
                    timestamp: import("@redis/client/dist/lib/RESP/types").NumberReply<number>;
                    value: number;
                }[];
            }>;
            readonly 3: (this: void, reply: import("./MRANGE_WITHLABELS_GROUPBY").TsMRangeWithLabelsGroupByRawReply3) => import("@redis/client/dist/lib/RESP/types").MapReply<import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>, {
                labels: import("@redis/client/dist/lib/RESP/types").MapReply<import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>, import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>>;
                sources: import("@redis/client/dist/lib/RESP/types").ArrayReply<import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>>;
                samples: {
                    timestamp: import("@redis/client/dist/lib/RESP/types").NumberReply<number>;
                    value: import("@redis/client/dist/lib/RESP/types").DoubleReply<number>;
                }[];
            }>;
        };
    };
    readonly MRANGE_WITHLABELS: {
        readonly NOT_KEYED_COMMAND: true;
        readonly IS_READ_ONLY: true;
        readonly parseCommand: (parser: import("@redis/client").CommandParser, fromTimestamp: import("./helpers").Timestamp, toTimestamp: import("./helpers").Timestamp, filter: import("@redis/client/dist/lib/commands/generic-transformers").RedisVariadicArgument, options?: import("./RANGE").TsRangeOptions | undefined) => void;
        readonly transformReply: {
            readonly 2: (this: void, reply: import("./MRANGE_WITHLABELS").TsMRangeWithLabelsRawReply2, _?: any, typeMapping?: import("@redis/client/dist/lib/RESP/types").TypeMapping | undefined) => import("@redis/client/dist/lib/RESP/types").MapReply<import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>, {
                labels: Record<string, import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>>;
                samples: {
                    timestamp: import("@redis/client/dist/lib/RESP/types").NumberReply<number>;
                    value: number;
                }[];
            }>;
            readonly 3: (this: void, reply: import("./MRANGE_WITHLABELS").TsMRangeWithLabelsRawReply3) => import("@redis/client/dist/lib/RESP/types").MapReply<import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>, {
                labels: import("@redis/client/dist/lib/RESP/types").MapReply<import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>, import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>>;
                samples: {
                    timestamp: import("@redis/client/dist/lib/RESP/types").NumberReply<number>;
                    value: import("@redis/client/dist/lib/RESP/types").DoubleReply<number>;
                }[];
            }>;
        };
    };
    readonly mRangeWithLabels: {
        readonly NOT_KEYED_COMMAND: true;
        readonly IS_READ_ONLY: true;
        readonly parseCommand: (parser: import("@redis/client").CommandParser, fromTimestamp: import("./helpers").Timestamp, toTimestamp: import("./helpers").Timestamp, filter: import("@redis/client/dist/lib/commands/generic-transformers").RedisVariadicArgument, options?: import("./RANGE").TsRangeOptions | undefined) => void;
        readonly transformReply: {
            readonly 2: (this: void, reply: import("./MRANGE_WITHLABELS").TsMRangeWithLabelsRawReply2, _?: any, typeMapping?: import("@redis/client/dist/lib/RESP/types").TypeMapping | undefined) => import("@redis/client/dist/lib/RESP/types").MapReply<import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>, {
                labels: Record<string, import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>>;
                samples: {
                    timestamp: import("@redis/client/dist/lib/RESP/types").NumberReply<number>;
                    value: number;
                }[];
            }>;
            readonly 3: (this: void, reply: import("./MRANGE_WITHLABELS").TsMRangeWithLabelsRawReply3) => import("@redis/client/dist/lib/RESP/types").MapReply<import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>, {
                labels: import("@redis/client/dist/lib/RESP/types").MapReply<import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>, import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>>;
                samples: {
                    timestamp: import("@redis/client/dist/lib/RESP/types").NumberReply<number>;
                    value: import("@redis/client/dist/lib/RESP/types").DoubleReply<number>;
                }[];
            }>;
        };
    };
    readonly MRANGE: {
        readonly NOT_KEYED_COMMAND: true;
        readonly IS_READ_ONLY: true;
        readonly parseCommand: (parser: import("@redis/client").CommandParser, fromTimestamp: import("./helpers").Timestamp, toTimestamp: import("./helpers").Timestamp, filter: import("@redis/client/dist/lib/commands/generic-transformers").RedisVariadicArgument, options?: import("./RANGE").TsRangeOptions | undefined) => void;
        readonly transformReply: {
            readonly 2: (this: void, reply: import("./MRANGE").TsMRangeRawReply2, _?: any, typeMapping?: import("@redis/client/dist/lib/RESP/types").TypeMapping | undefined) => import("@redis/client/dist/lib/RESP/types").MapReply<import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>, {
                timestamp: import("@redis/client/dist/lib/RESP/types").NumberReply<number>;
                value: number;
            }[]>;
            readonly 3: (this: void, reply: import("./MRANGE").TsMRangeRawReply3) => import("@redis/client/dist/lib/RESP/types").MapReply<import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>, {
                timestamp: import("@redis/client/dist/lib/RESP/types").NumberReply<number>;
                value: import("@redis/client/dist/lib/RESP/types").DoubleReply<number>;
            }[]>;
        };
    };
    readonly mRange: {
        readonly NOT_KEYED_COMMAND: true;
        readonly IS_READ_ONLY: true;
        readonly parseCommand: (parser: import("@redis/client").CommandParser, fromTimestamp: import("./helpers").Timestamp, toTimestamp: import("./helpers").Timestamp, filter: import("@redis/client/dist/lib/commands/generic-transformers").RedisVariadicArgument, options?: import("./RANGE").TsRangeOptions | undefined) => void;
        readonly transformReply: {
            readonly 2: (this: void, reply: import("./MRANGE").TsMRangeRawReply2, _?: any, typeMapping?: import("@redis/client/dist/lib/RESP/types").TypeMapping | undefined) => import("@redis/client/dist/lib/RESP/types").MapReply<import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>, {
                timestamp: import("@redis/client/dist/lib/RESP/types").NumberReply<number>;
                value: number;
            }[]>;
            readonly 3: (this: void, reply: import("./MRANGE").TsMRangeRawReply3) => import("@redis/client/dist/lib/RESP/types").MapReply<import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>, {
                timestamp: import("@redis/client/dist/lib/RESP/types").NumberReply<number>;
                value: import("@redis/client/dist/lib/RESP/types").DoubleReply<number>;
            }[]>;
        };
    };
    readonly MREVRANGE_GROUPBY: {
        readonly IS_READ_ONLY: true;
        readonly parseCommand: (parser: import("@redis/client").CommandParser, fromTimestamp: import("./helpers").Timestamp, toTimestamp: import("./helpers").Timestamp, filter: import("@redis/client/dist/lib/commands/generic-transformers").RedisVariadicArgument, groupBy: import("./MRANGE_GROUPBY").TsMRangeGroupBy, options?: import("./RANGE").TsRangeOptions | undefined) => void;
        readonly transformReply: {
            readonly 2: (this: void, reply: import("./MRANGE_GROUPBY").TsMRangeGroupByRawReply2, _?: any, typeMapping?: import("@redis/client/dist/lib/RESP/types").TypeMapping | undefined) => import("@redis/client/dist/lib/RESP/types").MapReply<import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>, {
                samples: {
                    timestamp: import("@redis/client/dist/lib/RESP/types").NumberReply<number>;
                    value: number;
                }[];
            }>;
            readonly 3: (this: void, reply: import("./MRANGE_GROUPBY").TsMRangeGroupByRawReply3) => import("@redis/client/dist/lib/RESP/types").MapReply<import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>, {
                sources: import("@redis/client/dist/lib/RESP/types").ArrayReply<import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>>;
                samples: {
                    timestamp: import("@redis/client/dist/lib/RESP/types").NumberReply<number>;
                    value: import("@redis/client/dist/lib/RESP/types").DoubleReply<number>;
                }[];
            }>;
        };
    };
    readonly mRevRangeGroupBy: {
        readonly IS_READ_ONLY: true;
        readonly parseCommand: (parser: import("@redis/client").CommandParser, fromTimestamp: import("./helpers").Timestamp, toTimestamp: import("./helpers").Timestamp, filter: import("@redis/client/dist/lib/commands/generic-transformers").RedisVariadicArgument, groupBy: import("./MRANGE_GROUPBY").TsMRangeGroupBy, options?: import("./RANGE").TsRangeOptions | undefined) => void;
        readonly transformReply: {
            readonly 2: (this: void, reply: import("./MRANGE_GROUPBY").TsMRangeGroupByRawReply2, _?: any, typeMapping?: import("@redis/client/dist/lib/RESP/types").TypeMapping | undefined) => import("@redis/client/dist/lib/RESP/types").MapReply<import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>, {
                samples: {
                    timestamp: import("@redis/client/dist/lib/RESP/types").NumberReply<number>;
                    value: number;
                }[];
            }>;
            readonly 3: (this: void, reply: import("./MRANGE_GROUPBY").TsMRangeGroupByRawReply3) => import("@redis/client/dist/lib/RESP/types").MapReply<import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>, {
                sources: import("@redis/client/dist/lib/RESP/types").ArrayReply<import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>>;
                samples: {
                    timestamp: import("@redis/client/dist/lib/RESP/types").NumberReply<number>;
                    value: import("@redis/client/dist/lib/RESP/types").DoubleReply<number>;
                }[];
            }>;
        };
    };
    readonly MREVRANGE_SELECTED_LABELS_GROUPBY: {
        readonly IS_READ_ONLY: true;
        readonly parseCommand: (parser: import("@redis/client").CommandParser, fromTimestamp: import("./helpers").Timestamp, toTimestamp: import("./helpers").Timestamp, selectedLabels: import("@redis/client/dist/lib/commands/generic-transformers").RedisVariadicArgument, filter: import("@redis/client/dist/lib/commands/generic-transformers").RedisVariadicArgument, groupBy: import("./MRANGE_GROUPBY").TsMRangeGroupBy, options?: import("./RANGE").TsRangeOptions | undefined) => void;
        readonly transformReply: {
            readonly 2: (this: void, reply: import("./MRANGE_SELECTED_LABELS").TsMRangeSelectedLabelsRawReply2, _?: any, typeMapping?: import("@redis/client/dist/lib/RESP/types").TypeMapping | undefined) => import("@redis/client/dist/lib/RESP/types").MapReply<import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>, {
                labels: import("@redis/client/dist/lib/RESP/types").MapReply<import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>, import("@redis/client/dist/lib/RESP/types").NullReply | import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>>;
                samples: {
                    timestamp: import("@redis/client/dist/lib/RESP/types").NumberReply<number>;
                    value: number;
                }[];
            }>;
            readonly 3: (this: void, reply: import("./MRANGE_SELECTED_LABELS_GROUPBY").TsMRangeWithLabelsGroupByRawReply3) => import("@redis/client/dist/lib/RESP/types").MapReply<import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>, {
                labels: import("@redis/client/dist/lib/RESP/types").MapReply<import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>, import("@redis/client/dist/lib/RESP/types").NullReply | import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>>;
                sources: import("@redis/client/dist/lib/RESP/types").ArrayReply<import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>>;
                samples: {
                    timestamp: import("@redis/client/dist/lib/RESP/types").NumberReply<number>;
                    value: import("@redis/client/dist/lib/RESP/types").DoubleReply<number>;
                }[];
            }>;
        };
    };
    readonly mRevRangeSelectedLabelsGroupBy: {
        readonly IS_READ_ONLY: true;
        readonly parseCommand: (parser: import("@redis/client").CommandParser, fromTimestamp: import("./helpers").Timestamp, toTimestamp: import("./helpers").Timestamp, selectedLabels: import("@redis/client/dist/lib/commands/generic-transformers").RedisVariadicArgument, filter: import("@redis/client/dist/lib/commands/generic-transformers").RedisVariadicArgument, groupBy: import("./MRANGE_GROUPBY").TsMRangeGroupBy, options?: import("./RANGE").TsRangeOptions | undefined) => void;
        readonly transformReply: {
            readonly 2: (this: void, reply: import("./MRANGE_SELECTED_LABELS").TsMRangeSelectedLabelsRawReply2, _?: any, typeMapping?: import("@redis/client/dist/lib/RESP/types").TypeMapping | undefined) => import("@redis/client/dist/lib/RESP/types").MapReply<import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>, {
                labels: import("@redis/client/dist/lib/RESP/types").MapReply<import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>, import("@redis/client/dist/lib/RESP/types").NullReply | import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>>;
                samples: {
                    timestamp: import("@redis/client/dist/lib/RESP/types").NumberReply<number>;
                    value: number;
                }[];
            }>;
            readonly 3: (this: void, reply: import("./MRANGE_SELECTED_LABELS_GROUPBY").TsMRangeWithLabelsGroupByRawReply3) => import("@redis/client/dist/lib/RESP/types").MapReply<import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>, {
                labels: import("@redis/client/dist/lib/RESP/types").MapReply<import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>, import("@redis/client/dist/lib/RESP/types").NullReply | import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>>;
                sources: import("@redis/client/dist/lib/RESP/types").ArrayReply<import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>>;
                samples: {
                    timestamp: import("@redis/client/dist/lib/RESP/types").NumberReply<number>;
                    value: import("@redis/client/dist/lib/RESP/types").DoubleReply<number>;
                }[];
            }>;
        };
    };
    readonly MREVRANGE_SELECTED_LABELS: {
        readonly IS_READ_ONLY: true;
        readonly parseCommand: (parser: import("@redis/client").CommandParser, fromTimestamp: import("./helpers").Timestamp, toTimestamp: import("./helpers").Timestamp, selectedLabels: import("@redis/client/dist/lib/commands/generic-transformers").RedisVariadicArgument, filter: import("@redis/client/dist/lib/commands/generic-transformers").RedisVariadicArgument, options?: import("./RANGE").TsRangeOptions | undefined) => void;
        readonly transformReply: {
            readonly 2: (this: void, reply: import("./MRANGE_SELECTED_LABELS").TsMRangeSelectedLabelsRawReply2, _?: any, typeMapping?: import("@redis/client/dist/lib/RESP/types").TypeMapping | undefined) => import("@redis/client/dist/lib/RESP/types").MapReply<import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>, {
                labels: import("@redis/client/dist/lib/RESP/types").MapReply<import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>, import("@redis/client/dist/lib/RESP/types").NullReply | import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>>;
                samples: {
                    timestamp: import("@redis/client/dist/lib/RESP/types").NumberReply<number>;
                    value: number;
                }[];
            }>;
            readonly 3: (this: void, reply: import("./MRANGE_SELECTED_LABELS").TsMRangeSelectedLabelsRawReply3) => import("@redis/client/dist/lib/RESP/types").MapReply<import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>, {
                labels: never;
                samples: {
                    timestamp: import("@redis/client/dist/lib/RESP/types").NumberReply<number>;
                    value: import("@redis/client/dist/lib/RESP/types").DoubleReply<number>;
                }[];
            }>;
        };
    };
    readonly mRevRangeSelectedLabels: {
        readonly IS_READ_ONLY: true;
        readonly parseCommand: (parser: import("@redis/client").CommandParser, fromTimestamp: import("./helpers").Timestamp, toTimestamp: import("./helpers").Timestamp, selectedLabels: import("@redis/client/dist/lib/commands/generic-transformers").RedisVariadicArgument, filter: import("@redis/client/dist/lib/commands/generic-transformers").RedisVariadicArgument, options?: import("./RANGE").TsRangeOptions | undefined) => void;
        readonly transformReply: {
            readonly 2: (this: void, reply: import("./MRANGE_SELECTED_LABELS").TsMRangeSelectedLabelsRawReply2, _?: any, typeMapping?: import("@redis/client/dist/lib/RESP/types").TypeMapping | undefined) => import("@redis/client/dist/lib/RESP/types").MapReply<import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>, {
                labels: import("@redis/client/dist/lib/RESP/types").MapReply<import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>, import("@redis/client/dist/lib/RESP/types").NullReply | import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>>;
                samples: {
                    timestamp: import("@redis/client/dist/lib/RESP/types").NumberReply<number>;
                    value: number;
                }[];
            }>;
            readonly 3: (this: void, reply: import("./MRANGE_SELECTED_LABELS").TsMRangeSelectedLabelsRawReply3) => import("@redis/client/dist/lib/RESP/types").MapReply<import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>, {
                labels: never;
                samples: {
                    timestamp: import("@redis/client/dist/lib/RESP/types").NumberReply<number>;
                    value: import("@redis/client/dist/lib/RESP/types").DoubleReply<number>;
                }[];
            }>;
        };
    };
    readonly MREVRANGE_WITHLABELS_GROUPBY: {
        readonly IS_READ_ONLY: true;
        readonly parseCommand: (parser: import("@redis/client").CommandParser, fromTimestamp: import("./helpers").Timestamp, toTimestamp: import("./helpers").Timestamp, filter: import("@redis/client/dist/lib/commands/generic-transformers").RedisVariadicArgument, groupBy: import("./MRANGE_GROUPBY").TsMRangeGroupBy, options?: import("./RANGE").TsRangeOptions | undefined) => void;
        readonly transformReply: {
            readonly 2: (this: void, reply: import("./MRANGE_WITHLABELS_GROUPBY").TsMRangeWithLabelsGroupByRawReply2, _?: any, typeMapping?: import("@redis/client/dist/lib/RESP/types").TypeMapping | undefined) => import("@redis/client/dist/lib/RESP/types").MapReply<import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>, {
                labels: import("@redis/client/dist/lib/RESP/types").MapReply<import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>, import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>>;
                sources: string[] | Buffer[];
                samples: {
                    timestamp: import("@redis/client/dist/lib/RESP/types").NumberReply<number>;
                    value: number;
                }[];
            }>;
            readonly 3: (this: void, reply: import("./MRANGE_WITHLABELS_GROUPBY").TsMRangeWithLabelsGroupByRawReply3) => import("@redis/client/dist/lib/RESP/types").MapReply<import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>, {
                labels: import("@redis/client/dist/lib/RESP/types").MapReply<import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>, import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>>;
                sources: import("@redis/client/dist/lib/RESP/types").ArrayReply<import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>>;
                samples: {
                    timestamp: import("@redis/client/dist/lib/RESP/types").NumberReply<number>;
                    value: import("@redis/client/dist/lib/RESP/types").DoubleReply<number>;
                }[];
            }>;
        };
    };
    readonly mRevRangeWithLabelsGroupBy: {
        readonly IS_READ_ONLY: true;
        readonly parseCommand: (parser: import("@redis/client").CommandParser, fromTimestamp: import("./helpers").Timestamp, toTimestamp: import("./helpers").Timestamp, filter: import("@redis/client/dist/lib/commands/generic-transformers").RedisVariadicArgument, groupBy: import("./MRANGE_GROUPBY").TsMRangeGroupBy, options?: import("./RANGE").TsRangeOptions | undefined) => void;
        readonly transformReply: {
            readonly 2: (this: void, reply: import("./MRANGE_WITHLABELS_GROUPBY").TsMRangeWithLabelsGroupByRawReply2, _?: any, typeMapping?: import("@redis/client/dist/lib/RESP/types").TypeMapping | undefined) => import("@redis/client/dist/lib/RESP/types").MapReply<import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>, {
                labels: import("@redis/client/dist/lib/RESP/types").MapReply<import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>, import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>>;
                sources: string[] | Buffer[];
                samples: {
                    timestamp: import("@redis/client/dist/lib/RESP/types").NumberReply<number>;
                    value: number;
                }[];
            }>;
            readonly 3: (this: void, reply: import("./MRANGE_WITHLABELS_GROUPBY").TsMRangeWithLabelsGroupByRawReply3) => import("@redis/client/dist/lib/RESP/types").MapReply<import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>, {
                labels: import("@redis/client/dist/lib/RESP/types").MapReply<import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>, import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>>;
                sources: import("@redis/client/dist/lib/RESP/types").ArrayReply<import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>>;
                samples: {
                    timestamp: import("@redis/client/dist/lib/RESP/types").NumberReply<number>;
                    value: import("@redis/client/dist/lib/RESP/types").DoubleReply<number>;
                }[];
            }>;
        };
    };
    readonly MREVRANGE_WITHLABELS: {
        readonly NOT_KEYED_COMMAND: true;
        readonly IS_READ_ONLY: true;
        readonly parseCommand: (parser: import("@redis/client").CommandParser, fromTimestamp: import("./helpers").Timestamp, toTimestamp: import("./helpers").Timestamp, filter: import("@redis/client/dist/lib/commands/generic-transformers").RedisVariadicArgument, options?: import("./RANGE").TsRangeOptions | undefined) => void;
        readonly transformReply: {
            readonly 2: (this: void, reply: import("./MRANGE_WITHLABELS").TsMRangeWithLabelsRawReply2, _?: any, typeMapping?: import("@redis/client/dist/lib/RESP/types").TypeMapping | undefined) => import("@redis/client/dist/lib/RESP/types").MapReply<import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>, {
                labels: Record<string, import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>>;
                samples: {
                    timestamp: import("@redis/client/dist/lib/RESP/types").NumberReply<number>;
                    value: number;
                }[];
            }>;
            readonly 3: (this: void, reply: import("./MRANGE_WITHLABELS").TsMRangeWithLabelsRawReply3) => import("@redis/client/dist/lib/RESP/types").MapReply<import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>, {
                labels: import("@redis/client/dist/lib/RESP/types").MapReply<import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>, import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>>;
                samples: {
                    timestamp: import("@redis/client/dist/lib/RESP/types").NumberReply<number>;
                    value: import("@redis/client/dist/lib/RESP/types").DoubleReply<number>;
                }[];
            }>;
        };
    };
    readonly mRevRangeWithLabels: {
        readonly NOT_KEYED_COMMAND: true;
        readonly IS_READ_ONLY: true;
        readonly parseCommand: (parser: import("@redis/client").CommandParser, fromTimestamp: import("./helpers").Timestamp, toTimestamp: import("./helpers").Timestamp, filter: import("@redis/client/dist/lib/commands/generic-transformers").RedisVariadicArgument, options?: import("./RANGE").TsRangeOptions | undefined) => void;
        readonly transformReply: {
            readonly 2: (this: void, reply: import("./MRANGE_WITHLABELS").TsMRangeWithLabelsRawReply2, _?: any, typeMapping?: import("@redis/client/dist/lib/RESP/types").TypeMapping | undefined) => import("@redis/client/dist/lib/RESP/types").MapReply<import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>, {
                labels: Record<string, import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>>;
                samples: {
                    timestamp: import("@redis/client/dist/lib/RESP/types").NumberReply<number>;
                    value: number;
                }[];
            }>;
            readonly 3: (this: void, reply: import("./MRANGE_WITHLABELS").TsMRangeWithLabelsRawReply3) => import("@redis/client/dist/lib/RESP/types").MapReply<import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>, {
                labels: import("@redis/client/dist/lib/RESP/types").MapReply<import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>, import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>>;
                samples: {
                    timestamp: import("@redis/client/dist/lib/RESP/types").NumberReply<number>;
                    value: import("@redis/client/dist/lib/RESP/types").DoubleReply<number>;
                }[];
            }>;
        };
    };
    readonly MREVRANGE: {
        readonly NOT_KEYED_COMMAND: true;
        readonly IS_READ_ONLY: true;
        readonly parseCommand: (parser: import("@redis/client").CommandParser, fromTimestamp: import("./helpers").Timestamp, toTimestamp: import("./helpers").Timestamp, filter: import("@redis/client/dist/lib/commands/generic-transformers").RedisVariadicArgument, options?: import("./RANGE").TsRangeOptions | undefined) => void;
        readonly transformReply: {
            readonly 2: (this: void, reply: import("./MRANGE").TsMRangeRawReply2, _?: any, typeMapping?: import("@redis/client/dist/lib/RESP/types").TypeMapping | undefined) => import("@redis/client/dist/lib/RESP/types").MapReply<import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>, {
                timestamp: import("@redis/client/dist/lib/RESP/types").NumberReply<number>;
                value: number;
            }[]>;
            readonly 3: (this: void, reply: import("./MRANGE").TsMRangeRawReply3) => import("@redis/client/dist/lib/RESP/types").MapReply<import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>, {
                timestamp: import("@redis/client/dist/lib/RESP/types").NumberReply<number>;
                value: import("@redis/client/dist/lib/RESP/types").DoubleReply<number>;
            }[]>;
        };
    };
    readonly mRevRange: {
        readonly NOT_KEYED_COMMAND: true;
        readonly IS_READ_ONLY: true;
        readonly parseCommand: (parser: import("@redis/client").CommandParser, fromTimestamp: import("./helpers").Timestamp, toTimestamp: import("./helpers").Timestamp, filter: import("@redis/client/dist/lib/commands/generic-transformers").RedisVariadicArgument, options?: import("./RANGE").TsRangeOptions | undefined) => void;
        readonly transformReply: {
            readonly 2: (this: void, reply: import("./MRANGE").TsMRangeRawReply2, _?: any, typeMapping?: import("@redis/client/dist/lib/RESP/types").TypeMapping | undefined) => import("@redis/client/dist/lib/RESP/types").MapReply<import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>, {
                timestamp: import("@redis/client/dist/lib/RESP/types").NumberReply<number>;
                value: number;
            }[]>;
            readonly 3: (this: void, reply: import("./MRANGE").TsMRangeRawReply3) => import("@redis/client/dist/lib/RESP/types").MapReply<import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>, {
                timestamp: import("@redis/client/dist/lib/RESP/types").NumberReply<number>;
                value: import("@redis/client/dist/lib/RESP/types").DoubleReply<number>;
            }[]>;
        };
    };
    readonly QUERYINDEX: {
        readonly NOT_KEYED_COMMAND: true;
        readonly IS_READ_ONLY: true;
        readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, filter: import("@redis/client/dist/lib/commands/generic-transformers").RedisVariadicArgument) => void;
        readonly transformReply: {
            readonly 2: () => import("@redis/client/dist/lib/RESP/types").ArrayReply<import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>>;
            readonly 3: () => import("@redis/client/dist/lib/RESP/types").SetReply<import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>>;
        };
    };
    readonly queryIndex: {
        readonly NOT_KEYED_COMMAND: true;
        readonly IS_READ_ONLY: true;
        readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, filter: import("@redis/client/dist/lib/commands/generic-transformers").RedisVariadicArgument) => void;
        readonly transformReply: {
            readonly 2: () => import("@redis/client/dist/lib/RESP/types").ArrayReply<import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>>;
            readonly 3: () => import("@redis/client/dist/lib/RESP/types").SetReply<import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>>;
        };
    };
    readonly RANGE: {
        readonly IS_READ_ONLY: true;
        readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, key: import("@redis/client/dist/lib/RESP/types").RedisArgument, fromTimestamp: import("./helpers").Timestamp, toTimestamp: import("./helpers").Timestamp, options?: import("./RANGE").TsRangeOptions | undefined) => void;
        readonly transformReply: {
            readonly 2: (this: void, reply: import("@redis/client/dist/lib/RESP/types").RespType<42, import("@redis/client/dist/lib/RESP/types").RespType<42, [import("@redis/client/dist/lib/RESP/types").NumberReply<number>, import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>], never, [import("@redis/client/dist/lib/RESP/types").NumberReply<number>, import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>]>[], never, import("@redis/client/dist/lib/RESP/types").RespType<42, [import("@redis/client/dist/lib/RESP/types").NumberReply<number>, import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>], never, [import("@redis/client/dist/lib/RESP/types").NumberReply<number>, import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>]>[]>) => {
                timestamp: import("@redis/client/dist/lib/RESP/types").NumberReply<number>;
                value: number;
            }[];
            readonly 3: (this: void, reply: import("./helpers").SamplesRawReply) => {
                timestamp: import("@redis/client/dist/lib/RESP/types").NumberReply<number>;
                value: import("@redis/client/dist/lib/RESP/types").DoubleReply<number>;
            }[];
        };
    };
    readonly range: {
        readonly IS_READ_ONLY: true;
        readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, key: import("@redis/client/dist/lib/RESP/types").RedisArgument, fromTimestamp: import("./helpers").Timestamp, toTimestamp: import("./helpers").Timestamp, options?: import("./RANGE").TsRangeOptions | undefined) => void;
        readonly transformReply: {
            readonly 2: (this: void, reply: import("@redis/client/dist/lib/RESP/types").RespType<42, import("@redis/client/dist/lib/RESP/types").RespType<42, [import("@redis/client/dist/lib/RESP/types").NumberReply<number>, import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>], never, [import("@redis/client/dist/lib/RESP/types").NumberReply<number>, import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>]>[], never, import("@redis/client/dist/lib/RESP/types").RespType<42, [import("@redis/client/dist/lib/RESP/types").NumberReply<number>, import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>], never, [import("@redis/client/dist/lib/RESP/types").NumberReply<number>, import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>]>[]>) => {
                timestamp: import("@redis/client/dist/lib/RESP/types").NumberReply<number>;
                value: number;
            }[];
            readonly 3: (this: void, reply: import("./helpers").SamplesRawReply) => {
                timestamp: import("@redis/client/dist/lib/RESP/types").NumberReply<number>;
                value: import("@redis/client/dist/lib/RESP/types").DoubleReply<number>;
            }[];
        };
    };
    readonly REVRANGE: {
        readonly IS_READ_ONLY: true;
        readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, key: import("@redis/client/dist/lib/RESP/types").RedisArgument, fromTimestamp: import("./helpers").Timestamp, toTimestamp: import("./helpers").Timestamp, options?: import("./RANGE").TsRangeOptions | undefined) => void;
        readonly transformReply: {
            readonly 2: (this: void, reply: import("@redis/client/dist/lib/RESP/types").RespType<42, import("@redis/client/dist/lib/RESP/types").RespType<42, [import("@redis/client/dist/lib/RESP/types").NumberReply<number>, import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>], never, [import("@redis/client/dist/lib/RESP/types").NumberReply<number>, import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>]>[], never, import("@redis/client/dist/lib/RESP/types").RespType<42, [import("@redis/client/dist/lib/RESP/types").NumberReply<number>, import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>], never, [import("@redis/client/dist/lib/RESP/types").NumberReply<number>, import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>]>[]>) => {
                timestamp: import("@redis/client/dist/lib/RESP/types").NumberReply<number>;
                value: number;
            }[];
            readonly 3: (this: void, reply: import("./helpers").SamplesRawReply) => {
                timestamp: import("@redis/client/dist/lib/RESP/types").NumberReply<number>;
                value: import("@redis/client/dist/lib/RESP/types").DoubleReply<number>;
            }[];
        };
    };
    readonly revRange: {
        readonly IS_READ_ONLY: true;
        readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, key: import("@redis/client/dist/lib/RESP/types").RedisArgument, fromTimestamp: import("./helpers").Timestamp, toTimestamp: import("./helpers").Timestamp, options?: import("./RANGE").TsRangeOptions | undefined) => void;
        readonly transformReply: {
            readonly 2: (this: void, reply: import("@redis/client/dist/lib/RESP/types").RespType<42, import("@redis/client/dist/lib/RESP/types").RespType<42, [import("@redis/client/dist/lib/RESP/types").NumberReply<number>, import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>], never, [import("@redis/client/dist/lib/RESP/types").NumberReply<number>, import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>]>[], never, import("@redis/client/dist/lib/RESP/types").RespType<42, [import("@redis/client/dist/lib/RESP/types").NumberReply<number>, import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>], never, [import("@redis/client/dist/lib/RESP/types").NumberReply<number>, import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>]>[]>) => {
                timestamp: import("@redis/client/dist/lib/RESP/types").NumberReply<number>;
                value: number;
            }[];
            readonly 3: (this: void, reply: import("./helpers").SamplesRawReply) => {
                timestamp: import("@redis/client/dist/lib/RESP/types").NumberReply<number>;
                value: import("@redis/client/dist/lib/RESP/types").DoubleReply<number>;
            }[];
        };
    };
};
export default _default;
//# sourceMappingURL=index.d.ts.map