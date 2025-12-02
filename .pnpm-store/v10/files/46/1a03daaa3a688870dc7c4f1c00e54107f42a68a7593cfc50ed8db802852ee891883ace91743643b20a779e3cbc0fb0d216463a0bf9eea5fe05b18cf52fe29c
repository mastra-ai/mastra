declare const _default: {
    readonly bf: {
        readonly ADD: {
            readonly IS_READ_ONLY: false;
            readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, key: import("@redis/client").RedisArgument, item: import("@redis/client").RedisArgument) => void;
            readonly transformReply: {
                2: (reply: import("@redis/client/dist/lib/RESP/types").NumberReply<0 | 1>) => boolean;
                3: () => import("@redis/client/dist/lib/RESP/types").BooleanReply<boolean>;
            };
        };
        readonly add: {
            readonly IS_READ_ONLY: false;
            readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, key: import("@redis/client").RedisArgument, item: import("@redis/client").RedisArgument) => void;
            readonly transformReply: {
                2: (reply: import("@redis/client/dist/lib/RESP/types").NumberReply<0 | 1>) => boolean;
                3: () => import("@redis/client/dist/lib/RESP/types").BooleanReply<boolean>;
            };
        };
        readonly CARD: {
            readonly IS_READ_ONLY: true;
            readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, key: import("@redis/client").RedisArgument) => void;
            readonly transformReply: () => import("@redis/client/dist/lib/RESP/types").NumberReply<number>;
        };
        readonly card: {
            readonly IS_READ_ONLY: true;
            readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, key: import("@redis/client").RedisArgument) => void;
            readonly transformReply: () => import("@redis/client/dist/lib/RESP/types").NumberReply<number>;
        };
        readonly EXISTS: {
            readonly IS_READ_ONLY: true;
            readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, key: import("@redis/client").RedisArgument, item: import("@redis/client").RedisArgument) => void;
            readonly transformReply: {
                2: (reply: import("@redis/client/dist/lib/RESP/types").NumberReply<0 | 1>) => boolean;
                3: () => import("@redis/client/dist/lib/RESP/types").BooleanReply<boolean>;
            };
        };
        readonly exists: {
            readonly IS_READ_ONLY: true;
            readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, key: import("@redis/client").RedisArgument, item: import("@redis/client").RedisArgument) => void;
            readonly transformReply: {
                2: (reply: import("@redis/client/dist/lib/RESP/types").NumberReply<0 | 1>) => boolean;
                3: () => import("@redis/client/dist/lib/RESP/types").BooleanReply<boolean>;
            };
        };
        readonly INFO: {
            readonly IS_READ_ONLY: true;
            readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, key: import("@redis/client").RedisArgument) => void;
            readonly transformReply: {
                readonly 2: (this: void, reply: [import("@redis/client/dist/lib/RESP/types").SimpleStringReply<"Capacity">, import("@redis/client/dist/lib/RESP/types").NumberReply<number>, import("@redis/client/dist/lib/RESP/types").SimpleStringReply<"Size">, import("@redis/client/dist/lib/RESP/types").NumberReply<number>, import("@redis/client/dist/lib/RESP/types").SimpleStringReply<"Number of filters">, import("@redis/client/dist/lib/RESP/types").NumberReply<number>, import("@redis/client/dist/lib/RESP/types").SimpleStringReply<"Number of items inserted">, import("@redis/client/dist/lib/RESP/types").NumberReply<number>, import("@redis/client/dist/lib/RESP/types").SimpleStringReply<"Expansion rate">, import("@redis/client/dist/lib/RESP/types").NullReply | import("@redis/client/dist/lib/RESP/types").NumberReply<number>], _: any, typeMapping?: import("@redis/client").TypeMapping | undefined) => import("./bloom/INFO").BfInfoReplyMap;
                readonly 3: () => import("./bloom/INFO").BfInfoReplyMap;
            };
        };
        readonly info: {
            readonly IS_READ_ONLY: true;
            readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, key: import("@redis/client").RedisArgument) => void;
            readonly transformReply: {
                readonly 2: (this: void, reply: [import("@redis/client/dist/lib/RESP/types").SimpleStringReply<"Capacity">, import("@redis/client/dist/lib/RESP/types").NumberReply<number>, import("@redis/client/dist/lib/RESP/types").SimpleStringReply<"Size">, import("@redis/client/dist/lib/RESP/types").NumberReply<number>, import("@redis/client/dist/lib/RESP/types").SimpleStringReply<"Number of filters">, import("@redis/client/dist/lib/RESP/types").NumberReply<number>, import("@redis/client/dist/lib/RESP/types").SimpleStringReply<"Number of items inserted">, import("@redis/client/dist/lib/RESP/types").NumberReply<number>, import("@redis/client/dist/lib/RESP/types").SimpleStringReply<"Expansion rate">, import("@redis/client/dist/lib/RESP/types").NullReply | import("@redis/client/dist/lib/RESP/types").NumberReply<number>], _: any, typeMapping?: import("@redis/client").TypeMapping | undefined) => import("./bloom/INFO").BfInfoReplyMap;
                readonly 3: () => import("./bloom/INFO").BfInfoReplyMap;
            };
        };
        readonly INSERT: {
            readonly IS_READ_ONLY: false;
            readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, key: import("@redis/client").RedisArgument, items: import("@redis/client/dist/lib/commands/generic-transformers").RedisVariadicArgument, options?: import("./bloom/INSERT").BfInsertOptions | undefined) => void;
            readonly transformReply: {
                2: (reply: import("@redis/client/dist/lib/RESP/types").ArrayReply<import("@redis/client/dist/lib/RESP/types").NumberReply<0 | 1>>) => boolean[];
                3: () => import("@redis/client/dist/lib/RESP/types").ArrayReply<import("@redis/client/dist/lib/RESP/types").BooleanReply<boolean>>;
            };
        };
        readonly insert: {
            readonly IS_READ_ONLY: false;
            readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, key: import("@redis/client").RedisArgument, items: import("@redis/client/dist/lib/commands/generic-transformers").RedisVariadicArgument, options?: import("./bloom/INSERT").BfInsertOptions | undefined) => void;
            readonly transformReply: {
                2: (reply: import("@redis/client/dist/lib/RESP/types").ArrayReply<import("@redis/client/dist/lib/RESP/types").NumberReply<0 | 1>>) => boolean[];
                3: () => import("@redis/client/dist/lib/RESP/types").ArrayReply<import("@redis/client/dist/lib/RESP/types").BooleanReply<boolean>>;
            };
        };
        readonly LOADCHUNK: {
            readonly IS_READ_ONLY: false;
            readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, key: import("@redis/client").RedisArgument, iterator: number, chunk: import("@redis/client").RedisArgument) => void;
            readonly transformReply: () => import("@redis/client/dist/lib/RESP/types").SimpleStringReply<"OK">;
        };
        readonly loadChunk: {
            readonly IS_READ_ONLY: false;
            readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, key: import("@redis/client").RedisArgument, iterator: number, chunk: import("@redis/client").RedisArgument) => void;
            readonly transformReply: () => import("@redis/client/dist/lib/RESP/types").SimpleStringReply<"OK">;
        };
        readonly MADD: {
            readonly IS_READ_ONLY: false;
            readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, key: import("@redis/client").RedisArgument, items: import("@redis/client/dist/lib/commands/generic-transformers").RedisVariadicArgument) => void;
            readonly transformReply: {
                2: (reply: import("@redis/client/dist/lib/RESP/types").ArrayReply<import("@redis/client/dist/lib/RESP/types").NumberReply<0 | 1>>) => boolean[];
                3: () => import("@redis/client/dist/lib/RESP/types").ArrayReply<import("@redis/client/dist/lib/RESP/types").BooleanReply<boolean>>;
            };
        };
        readonly mAdd: {
            readonly IS_READ_ONLY: false;
            readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, key: import("@redis/client").RedisArgument, items: import("@redis/client/dist/lib/commands/generic-transformers").RedisVariadicArgument) => void;
            readonly transformReply: {
                2: (reply: import("@redis/client/dist/lib/RESP/types").ArrayReply<import("@redis/client/dist/lib/RESP/types").NumberReply<0 | 1>>) => boolean[];
                3: () => import("@redis/client/dist/lib/RESP/types").ArrayReply<import("@redis/client/dist/lib/RESP/types").BooleanReply<boolean>>;
            };
        };
        readonly MEXISTS: {
            readonly IS_READ_ONLY: true;
            readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, key: import("@redis/client").RedisArgument, items: import("@redis/client/dist/lib/commands/generic-transformers").RedisVariadicArgument) => void;
            readonly transformReply: {
                2: (reply: import("@redis/client/dist/lib/RESP/types").ArrayReply<import("@redis/client/dist/lib/RESP/types").NumberReply<0 | 1>>) => boolean[];
                3: () => import("@redis/client/dist/lib/RESP/types").ArrayReply<import("@redis/client/dist/lib/RESP/types").BooleanReply<boolean>>;
            };
        };
        readonly mExists: {
            readonly IS_READ_ONLY: true;
            readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, key: import("@redis/client").RedisArgument, items: import("@redis/client/dist/lib/commands/generic-transformers").RedisVariadicArgument) => void;
            readonly transformReply: {
                2: (reply: import("@redis/client/dist/lib/RESP/types").ArrayReply<import("@redis/client/dist/lib/RESP/types").NumberReply<0 | 1>>) => boolean[];
                3: () => import("@redis/client/dist/lib/RESP/types").ArrayReply<import("@redis/client/dist/lib/RESP/types").BooleanReply<boolean>>;
            };
        };
        readonly RESERVE: {
            readonly IS_READ_ONLY: true;
            readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, key: import("@redis/client").RedisArgument, errorRate: number, capacity: number, options?: import("./bloom/RESERVE").BfReserveOptions | undefined) => void;
            readonly transformReply: () => import("@redis/client/dist/lib/RESP/types").SimpleStringReply<"OK">;
        };
        readonly reserve: {
            readonly IS_READ_ONLY: true;
            readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, key: import("@redis/client").RedisArgument, errorRate: number, capacity: number, options?: import("./bloom/RESERVE").BfReserveOptions | undefined) => void;
            readonly transformReply: () => import("@redis/client/dist/lib/RESP/types").SimpleStringReply<"OK">;
        };
        readonly SCANDUMP: {
            readonly IS_READ_ONLY: true;
            readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, key: import("@redis/client").RedisArgument, iterator: number) => void;
            readonly transformReply: (this: void, reply: [import("@redis/client/dist/lib/RESP/types").NumberReply<number>, import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>]) => {
                iterator: import("@redis/client/dist/lib/RESP/types").NumberReply<number>;
                chunk: import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>;
            };
        };
        readonly scanDump: {
            readonly IS_READ_ONLY: true;
            readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, key: import("@redis/client").RedisArgument, iterator: number) => void;
            readonly transformReply: (this: void, reply: [import("@redis/client/dist/lib/RESP/types").NumberReply<number>, import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>]) => {
                iterator: import("@redis/client/dist/lib/RESP/types").NumberReply<number>;
                chunk: import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>;
            };
        };
    };
    readonly cms: {
        readonly INCRBY: {
            readonly IS_READ_ONLY: false;
            readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, key: import("@redis/client").RedisArgument, items: import("./count-min-sketch/INCRBY").BfIncrByItem | import("./count-min-sketch/INCRBY").BfIncrByItem[]) => void;
            readonly transformReply: () => import("@redis/client/dist/lib/RESP/types").ArrayReply<import("@redis/client/dist/lib/RESP/types").NumberReply<number>>;
        };
        readonly incrBy: {
            readonly IS_READ_ONLY: false;
            readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, key: import("@redis/client").RedisArgument, items: import("./count-min-sketch/INCRBY").BfIncrByItem | import("./count-min-sketch/INCRBY").BfIncrByItem[]) => void;
            readonly transformReply: () => import("@redis/client/dist/lib/RESP/types").ArrayReply<import("@redis/client/dist/lib/RESP/types").NumberReply<number>>;
        };
        readonly INFO: {
            readonly IS_READ_ONLY: true;
            readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, key: import("@redis/client").RedisArgument) => void;
            readonly transformReply: {
                readonly 2: (this: void, reply: [import("@redis/client/dist/lib/RESP/types").SimpleStringReply<"width">, import("@redis/client/dist/lib/RESP/types").NumberReply<number>, import("@redis/client/dist/lib/RESP/types").SimpleStringReply<"depth">, import("@redis/client/dist/lib/RESP/types").NumberReply<number>, import("@redis/client/dist/lib/RESP/types").SimpleStringReply<"count">, import("@redis/client/dist/lib/RESP/types").NumberReply<number>], _: any, typeMapping?: import("@redis/client").TypeMapping | undefined) => import("./count-min-sketch/INFO").CmsInfoReply;
                readonly 3: () => import("./count-min-sketch/INFO").CmsInfoReply;
            };
        };
        readonly info: {
            readonly IS_READ_ONLY: true;
            readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, key: import("@redis/client").RedisArgument) => void;
            readonly transformReply: {
                readonly 2: (this: void, reply: [import("@redis/client/dist/lib/RESP/types").SimpleStringReply<"width">, import("@redis/client/dist/lib/RESP/types").NumberReply<number>, import("@redis/client/dist/lib/RESP/types").SimpleStringReply<"depth">, import("@redis/client/dist/lib/RESP/types").NumberReply<number>, import("@redis/client/dist/lib/RESP/types").SimpleStringReply<"count">, import("@redis/client/dist/lib/RESP/types").NumberReply<number>], _: any, typeMapping?: import("@redis/client").TypeMapping | undefined) => import("./count-min-sketch/INFO").CmsInfoReply;
                readonly 3: () => import("./count-min-sketch/INFO").CmsInfoReply;
            };
        };
        readonly INITBYDIM: {
            readonly IS_READ_ONLY: false;
            readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, key: import("@redis/client").RedisArgument, width: number, depth: number) => void;
            readonly transformReply: () => import("@redis/client/dist/lib/RESP/types").SimpleStringReply<"OK">;
        };
        readonly initByDim: {
            readonly IS_READ_ONLY: false;
            readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, key: import("@redis/client").RedisArgument, width: number, depth: number) => void;
            readonly transformReply: () => import("@redis/client/dist/lib/RESP/types").SimpleStringReply<"OK">;
        };
        readonly INITBYPROB: {
            readonly IS_READ_ONLY: false;
            readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, key: import("@redis/client").RedisArgument, error: number, probability: number) => void;
            readonly transformReply: () => import("@redis/client/dist/lib/RESP/types").SimpleStringReply<"OK">;
        };
        readonly initByProb: {
            readonly IS_READ_ONLY: false;
            readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, key: import("@redis/client").RedisArgument, error: number, probability: number) => void;
            readonly transformReply: () => import("@redis/client/dist/lib/RESP/types").SimpleStringReply<"OK">;
        };
        readonly MERGE: {
            readonly IS_READ_ONLY: false;
            readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, destination: import("@redis/client").RedisArgument, source: import("./count-min-sketch/MERGE").BfMergeSketches) => void;
            readonly transformReply: () => import("@redis/client/dist/lib/RESP/types").SimpleStringReply<"OK">;
        };
        readonly merge: {
            readonly IS_READ_ONLY: false;
            readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, destination: import("@redis/client").RedisArgument, source: import("./count-min-sketch/MERGE").BfMergeSketches) => void;
            readonly transformReply: () => import("@redis/client/dist/lib/RESP/types").SimpleStringReply<"OK">;
        };
        readonly QUERY: {
            readonly IS_READ_ONLY: true;
            readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, key: import("@redis/client").RedisArgument, items: import("@redis/client/dist/lib/commands/generic-transformers").RedisVariadicArgument) => void;
            readonly transformReply: () => import("@redis/client/dist/lib/RESP/types").ArrayReply<import("@redis/client/dist/lib/RESP/types").NumberReply<number>>;
        };
        readonly query: {
            readonly IS_READ_ONLY: true;
            readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, key: import("@redis/client").RedisArgument, items: import("@redis/client/dist/lib/commands/generic-transformers").RedisVariadicArgument) => void;
            readonly transformReply: () => import("@redis/client/dist/lib/RESP/types").ArrayReply<import("@redis/client/dist/lib/RESP/types").NumberReply<number>>;
        };
    };
    readonly cf: {
        readonly ADD: {
            readonly IS_READ_ONLY: false;
            readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, key: import("@redis/client").RedisArgument, item: import("@redis/client").RedisArgument) => void;
            readonly transformReply: {
                2: (reply: import("@redis/client/dist/lib/RESP/types").NumberReply<0 | 1>) => boolean;
                3: () => import("@redis/client/dist/lib/RESP/types").BooleanReply<boolean>;
            };
        };
        readonly add: {
            readonly IS_READ_ONLY: false;
            readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, key: import("@redis/client").RedisArgument, item: import("@redis/client").RedisArgument) => void;
            readonly transformReply: {
                2: (reply: import("@redis/client/dist/lib/RESP/types").NumberReply<0 | 1>) => boolean;
                3: () => import("@redis/client/dist/lib/RESP/types").BooleanReply<boolean>;
            };
        };
        readonly ADDNX: {
            readonly IS_READ_ONLY: false;
            readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, key: import("@redis/client").RedisArgument, item: import("@redis/client").RedisArgument) => void;
            readonly transformReply: {
                2: (reply: import("@redis/client/dist/lib/RESP/types").NumberReply<0 | 1>) => boolean;
                3: () => import("@redis/client/dist/lib/RESP/types").BooleanReply<boolean>;
            };
        };
        readonly addNX: {
            readonly IS_READ_ONLY: false;
            readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, key: import("@redis/client").RedisArgument, item: import("@redis/client").RedisArgument) => void;
            readonly transformReply: {
                2: (reply: import("@redis/client/dist/lib/RESP/types").NumberReply<0 | 1>) => boolean;
                3: () => import("@redis/client/dist/lib/RESP/types").BooleanReply<boolean>;
            };
        };
        readonly COUNT: {
            readonly IS_READ_ONLY: true;
            readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, key: import("@redis/client").RedisArgument, item: import("@redis/client").RedisArgument) => void;
            readonly transformReply: () => import("@redis/client/dist/lib/RESP/types").NumberReply<number>;
        };
        readonly count: {
            readonly IS_READ_ONLY: true;
            readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, key: import("@redis/client").RedisArgument, item: import("@redis/client").RedisArgument) => void;
            readonly transformReply: () => import("@redis/client/dist/lib/RESP/types").NumberReply<number>;
        };
        readonly DEL: {
            readonly IS_READ_ONLY: false;
            readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, key: import("@redis/client").RedisArgument, item: import("@redis/client").RedisArgument) => void;
            readonly transformReply: {
                2: (reply: import("@redis/client/dist/lib/RESP/types").NumberReply<0 | 1>) => boolean;
                3: () => import("@redis/client/dist/lib/RESP/types").BooleanReply<boolean>;
            };
        };
        readonly del: {
            readonly IS_READ_ONLY: false;
            readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, key: import("@redis/client").RedisArgument, item: import("@redis/client").RedisArgument) => void;
            readonly transformReply: {
                2: (reply: import("@redis/client/dist/lib/RESP/types").NumberReply<0 | 1>) => boolean;
                3: () => import("@redis/client/dist/lib/RESP/types").BooleanReply<boolean>;
            };
        };
        readonly EXISTS: {
            readonly IS_READ_ONLY: false;
            readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, key: import("@redis/client").RedisArgument, item: import("@redis/client").RedisArgument) => void;
            readonly transformReply: {
                2: (reply: import("@redis/client/dist/lib/RESP/types").NumberReply<0 | 1>) => boolean;
                3: () => import("@redis/client/dist/lib/RESP/types").BooleanReply<boolean>;
            };
        };
        readonly exists: {
            readonly IS_READ_ONLY: false;
            readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, key: import("@redis/client").RedisArgument, item: import("@redis/client").RedisArgument) => void;
            readonly transformReply: {
                2: (reply: import("@redis/client/dist/lib/RESP/types").NumberReply<0 | 1>) => boolean;
                3: () => import("@redis/client/dist/lib/RESP/types").BooleanReply<boolean>;
            };
        };
        readonly INFO: {
            readonly IS_READ_ONLY: true;
            readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, key: import("@redis/client").RedisArgument) => void;
            readonly transformReply: {
                readonly 2: (this: void, reply: [import("@redis/client/dist/lib/RESP/types").SimpleStringReply<"Size">, import("@redis/client/dist/lib/RESP/types").NumberReply<number>, import("@redis/client/dist/lib/RESP/types").SimpleStringReply<"Number of buckets">, import("@redis/client/dist/lib/RESP/types").NumberReply<number>, import("@redis/client/dist/lib/RESP/types").SimpleStringReply<"Number of filters">, import("@redis/client/dist/lib/RESP/types").NumberReply<number>, import("@redis/client/dist/lib/RESP/types").SimpleStringReply<"Number of items inserted">, import("@redis/client/dist/lib/RESP/types").NumberReply<number>, import("@redis/client/dist/lib/RESP/types").SimpleStringReply<"Number of items deleted">, import("@redis/client/dist/lib/RESP/types").NumberReply<number>, import("@redis/client/dist/lib/RESP/types").SimpleStringReply<"Bucket size">, import("@redis/client/dist/lib/RESP/types").NumberReply<number>, import("@redis/client/dist/lib/RESP/types").SimpleStringReply<"Expansion rate">, import("@redis/client/dist/lib/RESP/types").NumberReply<number>, import("@redis/client/dist/lib/RESP/types").SimpleStringReply<"Max iterations">, import("@redis/client/dist/lib/RESP/types").NumberReply<number>], _: any, typeMapping?: import("@redis/client").TypeMapping | undefined) => import("./cuckoo/INFO").CfInfoReplyMap;
                readonly 3: () => import("./cuckoo/INFO").CfInfoReplyMap;
            };
        };
        readonly info: {
            readonly IS_READ_ONLY: true;
            readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, key: import("@redis/client").RedisArgument) => void;
            readonly transformReply: {
                readonly 2: (this: void, reply: [import("@redis/client/dist/lib/RESP/types").SimpleStringReply<"Size">, import("@redis/client/dist/lib/RESP/types").NumberReply<number>, import("@redis/client/dist/lib/RESP/types").SimpleStringReply<"Number of buckets">, import("@redis/client/dist/lib/RESP/types").NumberReply<number>, import("@redis/client/dist/lib/RESP/types").SimpleStringReply<"Number of filters">, import("@redis/client/dist/lib/RESP/types").NumberReply<number>, import("@redis/client/dist/lib/RESP/types").SimpleStringReply<"Number of items inserted">, import("@redis/client/dist/lib/RESP/types").NumberReply<number>, import("@redis/client/dist/lib/RESP/types").SimpleStringReply<"Number of items deleted">, import("@redis/client/dist/lib/RESP/types").NumberReply<number>, import("@redis/client/dist/lib/RESP/types").SimpleStringReply<"Bucket size">, import("@redis/client/dist/lib/RESP/types").NumberReply<number>, import("@redis/client/dist/lib/RESP/types").SimpleStringReply<"Expansion rate">, import("@redis/client/dist/lib/RESP/types").NumberReply<number>, import("@redis/client/dist/lib/RESP/types").SimpleStringReply<"Max iterations">, import("@redis/client/dist/lib/RESP/types").NumberReply<number>], _: any, typeMapping?: import("@redis/client").TypeMapping | undefined) => import("./cuckoo/INFO").CfInfoReplyMap;
                readonly 3: () => import("./cuckoo/INFO").CfInfoReplyMap;
            };
        };
        readonly INSERT: {
            readonly IS_READ_ONLY: false;
            readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, key: import("@redis/client").RedisArgument, items: import("@redis/client/dist/lib/commands/generic-transformers").RedisVariadicArgument, options?: import("./cuckoo/INSERT").CfInsertOptions | undefined) => void;
            readonly transformReply: {
                2: (reply: import("@redis/client/dist/lib/RESP/types").ArrayReply<import("@redis/client/dist/lib/RESP/types").NumberReply<0 | 1>>) => boolean[];
                3: () => import("@redis/client/dist/lib/RESP/types").ArrayReply<import("@redis/client/dist/lib/RESP/types").BooleanReply<boolean>>;
            };
        };
        readonly insert: {
            readonly IS_READ_ONLY: false;
            readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, key: import("@redis/client").RedisArgument, items: import("@redis/client/dist/lib/commands/generic-transformers").RedisVariadicArgument, options?: import("./cuckoo/INSERT").CfInsertOptions | undefined) => void;
            readonly transformReply: {
                2: (reply: import("@redis/client/dist/lib/RESP/types").ArrayReply<import("@redis/client/dist/lib/RESP/types").NumberReply<0 | 1>>) => boolean[];
                3: () => import("@redis/client/dist/lib/RESP/types").ArrayReply<import("@redis/client/dist/lib/RESP/types").BooleanReply<boolean>>;
            };
        };
        readonly INSERTNX: {
            readonly IS_READ_ONLY: false;
            readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, key: import("@redis/client").RedisArgument, items: import("@redis/client/dist/lib/commands/generic-transformers").RedisVariadicArgument, options?: import("./cuckoo/INSERT").CfInsertOptions | undefined) => void;
            readonly transformReply: {
                2: (reply: import("@redis/client/dist/lib/RESP/types").ArrayReply<import("@redis/client/dist/lib/RESP/types").NumberReply<0 | 1>>) => boolean[];
                3: () => import("@redis/client/dist/lib/RESP/types").ArrayReply<import("@redis/client/dist/lib/RESP/types").BooleanReply<boolean>>;
            };
        };
        readonly insertNX: {
            readonly IS_READ_ONLY: false;
            readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, key: import("@redis/client").RedisArgument, items: import("@redis/client/dist/lib/commands/generic-transformers").RedisVariadicArgument, options?: import("./cuckoo/INSERT").CfInsertOptions | undefined) => void;
            readonly transformReply: {
                2: (reply: import("@redis/client/dist/lib/RESP/types").ArrayReply<import("@redis/client/dist/lib/RESP/types").NumberReply<0 | 1>>) => boolean[];
                3: () => import("@redis/client/dist/lib/RESP/types").ArrayReply<import("@redis/client/dist/lib/RESP/types").BooleanReply<boolean>>;
            };
        };
        readonly LOADCHUNK: {
            readonly IS_READ_ONLY: false;
            readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, key: import("@redis/client").RedisArgument, iterator: number, chunk: import("@redis/client").RedisArgument) => void;
            readonly transformReply: () => import("@redis/client/dist/lib/RESP/types").SimpleStringReply<"OK">;
        };
        readonly loadChunk: {
            readonly IS_READ_ONLY: false;
            readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, key: import("@redis/client").RedisArgument, iterator: number, chunk: import("@redis/client").RedisArgument) => void;
            readonly transformReply: () => import("@redis/client/dist/lib/RESP/types").SimpleStringReply<"OK">;
        };
        readonly RESERVE: {
            readonly IS_READ_ONLY: false;
            readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, key: import("@redis/client").RedisArgument, capacity: number, options?: import("./cuckoo/RESERVE").CfReserveOptions | undefined) => void;
            readonly transformReply: () => import("@redis/client/dist/lib/RESP/types").SimpleStringReply<"OK">;
        };
        readonly reserve: {
            readonly IS_READ_ONLY: false;
            readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, key: import("@redis/client").RedisArgument, capacity: number, options?: import("./cuckoo/RESERVE").CfReserveOptions | undefined) => void;
            readonly transformReply: () => import("@redis/client/dist/lib/RESP/types").SimpleStringReply<"OK">;
        };
        readonly SCANDUMP: {
            readonly IS_READ_ONLY: true;
            readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, key: import("@redis/client").RedisArgument, iterator: number) => void;
            readonly transformReply: (this: void, reply: [import("@redis/client/dist/lib/RESP/types").NumberReply<number>, import("@redis/client/dist/lib/RESP/types").NullReply | import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>]) => {
                iterator: import("@redis/client/dist/lib/RESP/types").NumberReply<number>;
                chunk: import("@redis/client/dist/lib/RESP/types").NullReply | import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>;
            };
        };
        readonly scanDump: {
            readonly IS_READ_ONLY: true;
            readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, key: import("@redis/client").RedisArgument, iterator: number) => void;
            readonly transformReply: (this: void, reply: [import("@redis/client/dist/lib/RESP/types").NumberReply<number>, import("@redis/client/dist/lib/RESP/types").NullReply | import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>]) => {
                iterator: import("@redis/client/dist/lib/RESP/types").NumberReply<number>;
                chunk: import("@redis/client/dist/lib/RESP/types").NullReply | import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>;
            };
        };
    };
    readonly tDigest: {
        readonly ADD: {
            readonly IS_READ_ONLY: false;
            readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, key: import("@redis/client").RedisArgument, values: number[]) => void;
            readonly transformReply: () => import("@redis/client/dist/lib/RESP/types").SimpleStringReply<"OK">;
        };
        readonly add: {
            readonly IS_READ_ONLY: false;
            readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, key: import("@redis/client").RedisArgument, values: number[]) => void;
            readonly transformReply: () => import("@redis/client/dist/lib/RESP/types").SimpleStringReply<"OK">;
        };
        readonly BYRANK: {
            readonly IS_READ_ONLY: true;
            readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, key: import("@redis/client").RedisArgument, ranks: number[]) => void;
            readonly transformReply: {
                2: (reply: import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>[], preserve?: any, typeMapping?: import("@redis/client").TypeMapping | undefined) => import("@redis/client/dist/lib/RESP/types").DoubleReply<number>[];
                3: () => import("@redis/client/dist/lib/RESP/types").ArrayReply<import("@redis/client/dist/lib/RESP/types").DoubleReply<number>>;
            };
        };
        readonly byRank: {
            readonly IS_READ_ONLY: true;
            readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, key: import("@redis/client").RedisArgument, ranks: number[]) => void;
            readonly transformReply: {
                2: (reply: import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>[], preserve?: any, typeMapping?: import("@redis/client").TypeMapping | undefined) => import("@redis/client/dist/lib/RESP/types").DoubleReply<number>[];
                3: () => import("@redis/client/dist/lib/RESP/types").ArrayReply<import("@redis/client/dist/lib/RESP/types").DoubleReply<number>>;
            };
        };
        readonly BYREVRANK: {
            readonly IS_READ_ONLY: true;
            readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, key: import("@redis/client").RedisArgument, ranks: number[]) => void;
            readonly transformReply: {
                2: (reply: import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>[], preserve?: any, typeMapping?: import("@redis/client").TypeMapping | undefined) => import("@redis/client/dist/lib/RESP/types").DoubleReply<number>[];
                3: () => import("@redis/client/dist/lib/RESP/types").ArrayReply<import("@redis/client/dist/lib/RESP/types").DoubleReply<number>>;
            };
        };
        readonly byRevRank: {
            readonly IS_READ_ONLY: true;
            readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, key: import("@redis/client").RedisArgument, ranks: number[]) => void;
            readonly transformReply: {
                2: (reply: import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>[], preserve?: any, typeMapping?: import("@redis/client").TypeMapping | undefined) => import("@redis/client/dist/lib/RESP/types").DoubleReply<number>[];
                3: () => import("@redis/client/dist/lib/RESP/types").ArrayReply<import("@redis/client/dist/lib/RESP/types").DoubleReply<number>>;
            };
        };
        readonly CDF: {
            readonly IS_READ_ONLY: true;
            readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, key: import("@redis/client").RedisArgument, values: number[]) => void;
            readonly transformReply: {
                2: (reply: import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>[], preserve?: any, typeMapping?: import("@redis/client").TypeMapping | undefined) => import("@redis/client/dist/lib/RESP/types").DoubleReply<number>[];
                3: () => import("@redis/client/dist/lib/RESP/types").ArrayReply<import("@redis/client/dist/lib/RESP/types").DoubleReply<number>>;
            };
        };
        readonly cdf: {
            readonly IS_READ_ONLY: true;
            readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, key: import("@redis/client").RedisArgument, values: number[]) => void;
            readonly transformReply: {
                2: (reply: import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>[], preserve?: any, typeMapping?: import("@redis/client").TypeMapping | undefined) => import("@redis/client/dist/lib/RESP/types").DoubleReply<number>[];
                3: () => import("@redis/client/dist/lib/RESP/types").ArrayReply<import("@redis/client/dist/lib/RESP/types").DoubleReply<number>>;
            };
        };
        readonly CREATE: {
            readonly IS_READ_ONLY: false;
            readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, key: import("@redis/client").RedisArgument, options?: import("./t-digest/CREATE").TDigestCreateOptions | undefined) => void;
            readonly transformReply: () => import("@redis/client/dist/lib/RESP/types").SimpleStringReply<"OK">;
        };
        readonly create: {
            readonly IS_READ_ONLY: false;
            readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, key: import("@redis/client").RedisArgument, options?: import("./t-digest/CREATE").TDigestCreateOptions | undefined) => void;
            readonly transformReply: () => import("@redis/client/dist/lib/RESP/types").SimpleStringReply<"OK">;
        };
        readonly INFO: {
            readonly IS_READ_ONLY: true;
            readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, key: import("@redis/client").RedisArgument) => void;
            readonly transformReply: {
                readonly 2: (this: void, reply: [import("@redis/client/dist/lib/RESP/types").SimpleStringReply<"Compression">, import("@redis/client/dist/lib/RESP/types").NumberReply<number>, import("@redis/client/dist/lib/RESP/types").SimpleStringReply<"Capacity">, import("@redis/client/dist/lib/RESP/types").NumberReply<number>, import("@redis/client/dist/lib/RESP/types").SimpleStringReply<"Merged nodes">, import("@redis/client/dist/lib/RESP/types").NumberReply<number>, import("@redis/client/dist/lib/RESP/types").SimpleStringReply<"Unmerged nodes">, import("@redis/client/dist/lib/RESP/types").NumberReply<number>, import("@redis/client/dist/lib/RESP/types").SimpleStringReply<"Merged weight">, import("@redis/client/dist/lib/RESP/types").NumberReply<number>, import("@redis/client/dist/lib/RESP/types").SimpleStringReply<"Unmerged weight">, import("@redis/client/dist/lib/RESP/types").NumberReply<number>, import("@redis/client/dist/lib/RESP/types").SimpleStringReply<"Observations">, import("@redis/client/dist/lib/RESP/types").NumberReply<number>, import("@redis/client/dist/lib/RESP/types").SimpleStringReply<"Total compressions">, import("@redis/client/dist/lib/RESP/types").NumberReply<number>, import("@redis/client/dist/lib/RESP/types").SimpleStringReply<"Memory usage">, import("@redis/client/dist/lib/RESP/types").NumberReply<number>], _: any, typeMapping?: import("@redis/client").TypeMapping | undefined) => import("./t-digest/INFO").TdInfoReplyMap;
                readonly 3: () => import("./t-digest/INFO").TdInfoReplyMap;
            };
        };
        readonly info: {
            readonly IS_READ_ONLY: true;
            readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, key: import("@redis/client").RedisArgument) => void;
            readonly transformReply: {
                readonly 2: (this: void, reply: [import("@redis/client/dist/lib/RESP/types").SimpleStringReply<"Compression">, import("@redis/client/dist/lib/RESP/types").NumberReply<number>, import("@redis/client/dist/lib/RESP/types").SimpleStringReply<"Capacity">, import("@redis/client/dist/lib/RESP/types").NumberReply<number>, import("@redis/client/dist/lib/RESP/types").SimpleStringReply<"Merged nodes">, import("@redis/client/dist/lib/RESP/types").NumberReply<number>, import("@redis/client/dist/lib/RESP/types").SimpleStringReply<"Unmerged nodes">, import("@redis/client/dist/lib/RESP/types").NumberReply<number>, import("@redis/client/dist/lib/RESP/types").SimpleStringReply<"Merged weight">, import("@redis/client/dist/lib/RESP/types").NumberReply<number>, import("@redis/client/dist/lib/RESP/types").SimpleStringReply<"Unmerged weight">, import("@redis/client/dist/lib/RESP/types").NumberReply<number>, import("@redis/client/dist/lib/RESP/types").SimpleStringReply<"Observations">, import("@redis/client/dist/lib/RESP/types").NumberReply<number>, import("@redis/client/dist/lib/RESP/types").SimpleStringReply<"Total compressions">, import("@redis/client/dist/lib/RESP/types").NumberReply<number>, import("@redis/client/dist/lib/RESP/types").SimpleStringReply<"Memory usage">, import("@redis/client/dist/lib/RESP/types").NumberReply<number>], _: any, typeMapping?: import("@redis/client").TypeMapping | undefined) => import("./t-digest/INFO").TdInfoReplyMap;
                readonly 3: () => import("./t-digest/INFO").TdInfoReplyMap;
            };
        };
        readonly MAX: {
            readonly IS_READ_ONLY: true;
            readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, key: import("@redis/client").RedisArgument) => void;
            readonly transformReply: {
                2: (reply: import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>, preserve?: any, typeMapping?: import("@redis/client").TypeMapping | undefined) => import("@redis/client/dist/lib/RESP/types").DoubleReply<number>;
                3: () => import("@redis/client/dist/lib/RESP/types").DoubleReply<number>;
            };
        };
        readonly max: {
            readonly IS_READ_ONLY: true;
            readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, key: import("@redis/client").RedisArgument) => void;
            readonly transformReply: {
                2: (reply: import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>, preserve?: any, typeMapping?: import("@redis/client").TypeMapping | undefined) => import("@redis/client/dist/lib/RESP/types").DoubleReply<number>;
                3: () => import("@redis/client/dist/lib/RESP/types").DoubleReply<number>;
            };
        };
        readonly MERGE: {
            readonly IS_READ_ONLY: false;
            readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, destination: import("@redis/client").RedisArgument, source: import("@redis/client/dist/lib/commands/generic-transformers").RedisVariadicArgument, options?: import("./t-digest/MERGE").TDigestMergeOptions | undefined) => void;
            readonly transformReply: () => import("@redis/client/dist/lib/RESP/types").SimpleStringReply<"OK">;
        };
        readonly merge: {
            readonly IS_READ_ONLY: false;
            readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, destination: import("@redis/client").RedisArgument, source: import("@redis/client/dist/lib/commands/generic-transformers").RedisVariadicArgument, options?: import("./t-digest/MERGE").TDigestMergeOptions | undefined) => void;
            readonly transformReply: () => import("@redis/client/dist/lib/RESP/types").SimpleStringReply<"OK">;
        };
        readonly MIN: {
            readonly IS_READ_ONLY: true;
            readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, key: import("@redis/client").RedisArgument) => void;
            readonly transformReply: {
                2: (reply: import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>, preserve?: any, typeMapping?: import("@redis/client").TypeMapping | undefined) => import("@redis/client/dist/lib/RESP/types").DoubleReply<number>;
                3: () => import("@redis/client/dist/lib/RESP/types").DoubleReply<number>;
            };
        };
        readonly min: {
            readonly IS_READ_ONLY: true;
            readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, key: import("@redis/client").RedisArgument) => void;
            readonly transformReply: {
                2: (reply: import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>, preserve?: any, typeMapping?: import("@redis/client").TypeMapping | undefined) => import("@redis/client/dist/lib/RESP/types").DoubleReply<number>;
                3: () => import("@redis/client/dist/lib/RESP/types").DoubleReply<number>;
            };
        };
        readonly QUANTILE: {
            readonly IS_READ_ONLY: true;
            readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, key: import("@redis/client").RedisArgument, quantiles: number[]) => void;
            readonly transformReply: {
                2: (reply: import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>[], preserve?: any, typeMapping?: import("@redis/client").TypeMapping | undefined) => import("@redis/client/dist/lib/RESP/types").DoubleReply<number>[];
                3: () => import("@redis/client/dist/lib/RESP/types").ArrayReply<import("@redis/client/dist/lib/RESP/types").DoubleReply<number>>;
            };
        };
        readonly quantile: {
            readonly IS_READ_ONLY: true;
            readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, key: import("@redis/client").RedisArgument, quantiles: number[]) => void;
            readonly transformReply: {
                2: (reply: import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>[], preserve?: any, typeMapping?: import("@redis/client").TypeMapping | undefined) => import("@redis/client/dist/lib/RESP/types").DoubleReply<number>[];
                3: () => import("@redis/client/dist/lib/RESP/types").ArrayReply<import("@redis/client/dist/lib/RESP/types").DoubleReply<number>>;
            };
        };
        readonly RANK: {
            readonly IS_READ_ONLY: true;
            readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, key: import("@redis/client").RedisArgument, values: number[]) => void;
            readonly transformReply: () => import("@redis/client/dist/lib/RESP/types").ArrayReply<import("@redis/client/dist/lib/RESP/types").NumberReply<number>>;
        };
        readonly rank: {
            readonly IS_READ_ONLY: true;
            readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, key: import("@redis/client").RedisArgument, values: number[]) => void;
            readonly transformReply: () => import("@redis/client/dist/lib/RESP/types").ArrayReply<import("@redis/client/dist/lib/RESP/types").NumberReply<number>>;
        };
        readonly RESET: {
            readonly IS_READ_ONLY: false;
            readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, key: import("@redis/client").RedisArgument) => void;
            readonly transformReply: () => import("@redis/client/dist/lib/RESP/types").SimpleStringReply<"OK">;
        };
        readonly reset: {
            readonly IS_READ_ONLY: false;
            readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, key: import("@redis/client").RedisArgument) => void;
            readonly transformReply: () => import("@redis/client/dist/lib/RESP/types").SimpleStringReply<"OK">;
        };
        readonly REVRANK: {
            readonly IS_READ_ONLY: true;
            readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, key: import("@redis/client").RedisArgument, values: number[]) => void;
            readonly transformReply: () => import("@redis/client/dist/lib/RESP/types").ArrayReply<import("@redis/client/dist/lib/RESP/types").NumberReply<number>>;
        };
        readonly revRank: {
            readonly IS_READ_ONLY: true;
            readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, key: import("@redis/client").RedisArgument, values: number[]) => void;
            readonly transformReply: () => import("@redis/client/dist/lib/RESP/types").ArrayReply<import("@redis/client/dist/lib/RESP/types").NumberReply<number>>;
        };
        readonly TRIMMED_MEAN: {
            readonly IS_READ_ONLY: true;
            readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, key: import("@redis/client").RedisArgument, lowCutPercentile: number, highCutPercentile: number) => void;
            readonly transformReply: {
                2: (reply: import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>, preserve?: any, typeMapping?: import("@redis/client").TypeMapping | undefined) => import("@redis/client/dist/lib/RESP/types").DoubleReply<number>;
                3: () => import("@redis/client/dist/lib/RESP/types").DoubleReply<number>;
            };
        };
        readonly trimmedMean: {
            readonly IS_READ_ONLY: true;
            readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, key: import("@redis/client").RedisArgument, lowCutPercentile: number, highCutPercentile: number) => void;
            readonly transformReply: {
                2: (reply: import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>, preserve?: any, typeMapping?: import("@redis/client").TypeMapping | undefined) => import("@redis/client/dist/lib/RESP/types").DoubleReply<number>;
                3: () => import("@redis/client/dist/lib/RESP/types").DoubleReply<number>;
            };
        };
    };
    readonly topK: {
        readonly ADD: {
            readonly IS_READ_ONLY: false;
            readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, key: import("@redis/client").RedisArgument, items: import("@redis/client/dist/lib/commands/generic-transformers").RedisVariadicArgument) => void;
            readonly transformReply: () => import("@redis/client/dist/lib/RESP/types").ArrayReply<import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>>;
        };
        readonly add: {
            readonly IS_READ_ONLY: false;
            readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, key: import("@redis/client").RedisArgument, items: import("@redis/client/dist/lib/commands/generic-transformers").RedisVariadicArgument) => void;
            readonly transformReply: () => import("@redis/client/dist/lib/RESP/types").ArrayReply<import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>>;
        };
        readonly COUNT: {
            readonly IS_READ_ONLY: true;
            readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, key: import("@redis/client").RedisArgument, items: import("@redis/client/dist/lib/commands/generic-transformers").RedisVariadicArgument) => void;
            readonly transformReply: () => import("@redis/client/dist/lib/RESP/types").ArrayReply<import("@redis/client/dist/lib/RESP/types").NumberReply<number>>;
        };
        readonly count: {
            readonly IS_READ_ONLY: true;
            readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, key: import("@redis/client").RedisArgument, items: import("@redis/client/dist/lib/commands/generic-transformers").RedisVariadicArgument) => void;
            readonly transformReply: () => import("@redis/client/dist/lib/RESP/types").ArrayReply<import("@redis/client/dist/lib/RESP/types").NumberReply<number>>;
        };
        readonly INCRBY: {
            readonly IS_READ_ONLY: false;
            readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, key: import("@redis/client").RedisArgument, items: import("./top-k/INCRBY").TopKIncrByItem | import("./top-k/INCRBY").TopKIncrByItem[]) => void;
            readonly transformReply: () => import("@redis/client/dist/lib/RESP/types").ArrayReply<import("@redis/client/dist/lib/RESP/types").NullReply | import("@redis/client/dist/lib/RESP/types").SimpleStringReply<string>>;
        };
        readonly incrBy: {
            readonly IS_READ_ONLY: false;
            readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, key: import("@redis/client").RedisArgument, items: import("./top-k/INCRBY").TopKIncrByItem | import("./top-k/INCRBY").TopKIncrByItem[]) => void;
            readonly transformReply: () => import("@redis/client/dist/lib/RESP/types").ArrayReply<import("@redis/client/dist/lib/RESP/types").NullReply | import("@redis/client/dist/lib/RESP/types").SimpleStringReply<string>>;
        };
        readonly INFO: {
            readonly IS_READ_ONLY: true;
            readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, key: import("@redis/client").RedisArgument) => void;
            readonly transformReply: {
                readonly 2: (reply: [import("@redis/client/dist/lib/RESP/types").SimpleStringReply<"k">, import("@redis/client/dist/lib/RESP/types").NumberReply<number>, import("@redis/client/dist/lib/RESP/types").SimpleStringReply<"width">, import("@redis/client/dist/lib/RESP/types").NumberReply<number>, import("@redis/client/dist/lib/RESP/types").SimpleStringReply<"depth">, import("@redis/client/dist/lib/RESP/types").NumberReply<number>, import("@redis/client/dist/lib/RESP/types").SimpleStringReply<"decay">, import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>], preserve?: any, typeMapping?: import("@redis/client").TypeMapping | undefined) => import("./top-k/INFO").TopKInfoReplyMap;
                readonly 3: () => import("./top-k/INFO").TopKInfoReplyMap;
            };
        };
        readonly info: {
            readonly IS_READ_ONLY: true;
            readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, key: import("@redis/client").RedisArgument) => void;
            readonly transformReply: {
                readonly 2: (reply: [import("@redis/client/dist/lib/RESP/types").SimpleStringReply<"k">, import("@redis/client/dist/lib/RESP/types").NumberReply<number>, import("@redis/client/dist/lib/RESP/types").SimpleStringReply<"width">, import("@redis/client/dist/lib/RESP/types").NumberReply<number>, import("@redis/client/dist/lib/RESP/types").SimpleStringReply<"depth">, import("@redis/client/dist/lib/RESP/types").NumberReply<number>, import("@redis/client/dist/lib/RESP/types").SimpleStringReply<"decay">, import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>], preserve?: any, typeMapping?: import("@redis/client").TypeMapping | undefined) => import("./top-k/INFO").TopKInfoReplyMap;
                readonly 3: () => import("./top-k/INFO").TopKInfoReplyMap;
            };
        };
        readonly LIST_WITHCOUNT: {
            readonly IS_READ_ONLY: true;
            readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, key: import("@redis/client").RedisArgument) => void;
            readonly transformReply: (this: void, rawReply: (import("@redis/client/dist/lib/RESP/types").NumberReply<number> | import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>)[]) => {
                item: import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>;
                count: import("@redis/client/dist/lib/RESP/types").NumberReply<number>;
            }[];
        };
        readonly listWithCount: {
            readonly IS_READ_ONLY: true;
            readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, key: import("@redis/client").RedisArgument) => void;
            readonly transformReply: (this: void, rawReply: (import("@redis/client/dist/lib/RESP/types").NumberReply<number> | import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>)[]) => {
                item: import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>;
                count: import("@redis/client/dist/lib/RESP/types").NumberReply<number>;
            }[];
        };
        readonly LIST: {
            readonly IS_READ_ONLY: true;
            readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, key: import("@redis/client").RedisArgument) => void;
            readonly transformReply: () => import("@redis/client/dist/lib/RESP/types").ArrayReply<import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>>;
        };
        readonly list: {
            readonly IS_READ_ONLY: true;
            readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, key: import("@redis/client").RedisArgument) => void;
            readonly transformReply: () => import("@redis/client/dist/lib/RESP/types").ArrayReply<import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>>;
        };
        readonly QUERY: {
            readonly IS_READ_ONLY: false;
            readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, key: import("@redis/client").RedisArgument, items: import("@redis/client/dist/lib/commands/generic-transformers").RedisVariadicArgument) => void;
            readonly transformReply: {
                2: (reply: import("@redis/client/dist/lib/RESP/types").ArrayReply<import("@redis/client/dist/lib/RESP/types").NumberReply<0 | 1>>) => boolean[];
                3: () => import("@redis/client/dist/lib/RESP/types").ArrayReply<import("@redis/client/dist/lib/RESP/types").BooleanReply<boolean>>;
            };
        };
        readonly query: {
            readonly IS_READ_ONLY: false;
            readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, key: import("@redis/client").RedisArgument, items: import("@redis/client/dist/lib/commands/generic-transformers").RedisVariadicArgument) => void;
            readonly transformReply: {
                2: (reply: import("@redis/client/dist/lib/RESP/types").ArrayReply<import("@redis/client/dist/lib/RESP/types").NumberReply<0 | 1>>) => boolean[];
                3: () => import("@redis/client/dist/lib/RESP/types").ArrayReply<import("@redis/client/dist/lib/RESP/types").BooleanReply<boolean>>;
            };
        };
        readonly RESERVE: {
            readonly IS_READ_ONLY: false;
            readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, key: import("@redis/client").RedisArgument, topK: number, options?: import("./top-k/RESERVE").TopKReserveOptions | undefined) => void;
            readonly transformReply: () => import("@redis/client/dist/lib/RESP/types").SimpleStringReply<"OK">;
        };
        readonly reserve: {
            readonly IS_READ_ONLY: false;
            readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, key: import("@redis/client").RedisArgument, topK: number, options?: import("./top-k/RESERVE").TopKReserveOptions | undefined) => void;
            readonly transformReply: () => import("@redis/client/dist/lib/RESP/types").SimpleStringReply<"OK">;
        };
    };
};
export default _default;
//# sourceMappingURL=index.d.ts.map