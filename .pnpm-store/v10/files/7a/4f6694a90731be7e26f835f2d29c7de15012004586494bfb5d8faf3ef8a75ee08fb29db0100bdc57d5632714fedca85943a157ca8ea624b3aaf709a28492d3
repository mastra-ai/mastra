declare const _default: {
    readonly ADD: {
        readonly IS_READ_ONLY: false;
        readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, key: import("@redis/client/dist/lib/RESP/types").RedisArgument, items: import("@redis/client/dist/lib/commands/generic-transformers").RedisVariadicArgument) => void;
        readonly transformReply: () => import("@redis/client/dist/lib/RESP/types").ArrayReply<import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>>;
    };
    readonly add: {
        readonly IS_READ_ONLY: false;
        readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, key: import("@redis/client/dist/lib/RESP/types").RedisArgument, items: import("@redis/client/dist/lib/commands/generic-transformers").RedisVariadicArgument) => void;
        readonly transformReply: () => import("@redis/client/dist/lib/RESP/types").ArrayReply<import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>>;
    };
    readonly COUNT: {
        readonly IS_READ_ONLY: true;
        readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, key: import("@redis/client/dist/lib/RESP/types").RedisArgument, items: import("@redis/client/dist/lib/commands/generic-transformers").RedisVariadicArgument) => void;
        readonly transformReply: () => import("@redis/client/dist/lib/RESP/types").ArrayReply<import("@redis/client/dist/lib/RESP/types").NumberReply<number>>;
    };
    readonly count: {
        readonly IS_READ_ONLY: true;
        readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, key: import("@redis/client/dist/lib/RESP/types").RedisArgument, items: import("@redis/client/dist/lib/commands/generic-transformers").RedisVariadicArgument) => void;
        readonly transformReply: () => import("@redis/client/dist/lib/RESP/types").ArrayReply<import("@redis/client/dist/lib/RESP/types").NumberReply<number>>;
    };
    readonly INCRBY: {
        readonly IS_READ_ONLY: false;
        readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, key: import("@redis/client/dist/lib/RESP/types").RedisArgument, items: import("./INCRBY").TopKIncrByItem | import("./INCRBY").TopKIncrByItem[]) => void;
        readonly transformReply: () => import("@redis/client/dist/lib/RESP/types").ArrayReply<import("@redis/client/dist/lib/RESP/types").NullReply | import("@redis/client/dist/lib/RESP/types").SimpleStringReply<string>>;
    };
    readonly incrBy: {
        readonly IS_READ_ONLY: false;
        readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, key: import("@redis/client/dist/lib/RESP/types").RedisArgument, items: import("./INCRBY").TopKIncrByItem | import("./INCRBY").TopKIncrByItem[]) => void;
        readonly transformReply: () => import("@redis/client/dist/lib/RESP/types").ArrayReply<import("@redis/client/dist/lib/RESP/types").NullReply | import("@redis/client/dist/lib/RESP/types").SimpleStringReply<string>>;
    };
    readonly INFO: {
        readonly IS_READ_ONLY: true;
        readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, key: import("@redis/client/dist/lib/RESP/types").RedisArgument) => void;
        readonly transformReply: {
            readonly 2: (reply: [import("@redis/client/dist/lib/RESP/types").SimpleStringReply<"k">, import("@redis/client/dist/lib/RESP/types").NumberReply<number>, import("@redis/client/dist/lib/RESP/types").SimpleStringReply<"width">, import("@redis/client/dist/lib/RESP/types").NumberReply<number>, import("@redis/client/dist/lib/RESP/types").SimpleStringReply<"depth">, import("@redis/client/dist/lib/RESP/types").NumberReply<number>, import("@redis/client/dist/lib/RESP/types").SimpleStringReply<"decay">, import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>], preserve?: any, typeMapping?: import("@redis/client/dist/lib/RESP/types").TypeMapping | undefined) => import("./INFO").TopKInfoReplyMap;
            readonly 3: () => import("./INFO").TopKInfoReplyMap;
        };
    };
    readonly info: {
        readonly IS_READ_ONLY: true;
        readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, key: import("@redis/client/dist/lib/RESP/types").RedisArgument) => void;
        readonly transformReply: {
            readonly 2: (reply: [import("@redis/client/dist/lib/RESP/types").SimpleStringReply<"k">, import("@redis/client/dist/lib/RESP/types").NumberReply<number>, import("@redis/client/dist/lib/RESP/types").SimpleStringReply<"width">, import("@redis/client/dist/lib/RESP/types").NumberReply<number>, import("@redis/client/dist/lib/RESP/types").SimpleStringReply<"depth">, import("@redis/client/dist/lib/RESP/types").NumberReply<number>, import("@redis/client/dist/lib/RESP/types").SimpleStringReply<"decay">, import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>], preserve?: any, typeMapping?: import("@redis/client/dist/lib/RESP/types").TypeMapping | undefined) => import("./INFO").TopKInfoReplyMap;
            readonly 3: () => import("./INFO").TopKInfoReplyMap;
        };
    };
    readonly LIST_WITHCOUNT: {
        readonly IS_READ_ONLY: true;
        readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, key: import("@redis/client/dist/lib/RESP/types").RedisArgument) => void;
        readonly transformReply: (this: void, rawReply: (import("@redis/client/dist/lib/RESP/types").NumberReply<number> | import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>)[]) => {
            item: import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>;
            count: import("@redis/client/dist/lib/RESP/types").NumberReply<number>;
        }[];
    };
    readonly listWithCount: {
        readonly IS_READ_ONLY: true;
        readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, key: import("@redis/client/dist/lib/RESP/types").RedisArgument) => void;
        readonly transformReply: (this: void, rawReply: (import("@redis/client/dist/lib/RESP/types").NumberReply<number> | import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>)[]) => {
            item: import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>;
            count: import("@redis/client/dist/lib/RESP/types").NumberReply<number>;
        }[];
    };
    readonly LIST: {
        readonly IS_READ_ONLY: true;
        readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, key: import("@redis/client/dist/lib/RESP/types").RedisArgument) => void;
        readonly transformReply: () => import("@redis/client/dist/lib/RESP/types").ArrayReply<import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>>;
    };
    readonly list: {
        readonly IS_READ_ONLY: true;
        readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, key: import("@redis/client/dist/lib/RESP/types").RedisArgument) => void;
        readonly transformReply: () => import("@redis/client/dist/lib/RESP/types").ArrayReply<import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>>;
    };
    readonly QUERY: {
        readonly IS_READ_ONLY: false;
        readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, key: import("@redis/client/dist/lib/RESP/types").RedisArgument, items: import("@redis/client/dist/lib/commands/generic-transformers").RedisVariadicArgument) => void;
        readonly transformReply: {
            2: (reply: import("@redis/client/dist/lib/RESP/types").ArrayReply<import("@redis/client/dist/lib/RESP/types").NumberReply<0 | 1>>) => boolean[];
            3: () => import("@redis/client/dist/lib/RESP/types").ArrayReply<import("@redis/client/dist/lib/RESP/types").BooleanReply<boolean>>;
        };
    };
    readonly query: {
        readonly IS_READ_ONLY: false;
        readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, key: import("@redis/client/dist/lib/RESP/types").RedisArgument, items: import("@redis/client/dist/lib/commands/generic-transformers").RedisVariadicArgument) => void;
        readonly transformReply: {
            2: (reply: import("@redis/client/dist/lib/RESP/types").ArrayReply<import("@redis/client/dist/lib/RESP/types").NumberReply<0 | 1>>) => boolean[];
            3: () => import("@redis/client/dist/lib/RESP/types").ArrayReply<import("@redis/client/dist/lib/RESP/types").BooleanReply<boolean>>;
        };
    };
    readonly RESERVE: {
        readonly IS_READ_ONLY: false;
        readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, key: import("@redis/client/dist/lib/RESP/types").RedisArgument, topK: number, options?: import("./RESERVE").TopKReserveOptions | undefined) => void;
        readonly transformReply: () => import("@redis/client/dist/lib/RESP/types").SimpleStringReply<"OK">;
    };
    readonly reserve: {
        readonly IS_READ_ONLY: false;
        readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, key: import("@redis/client/dist/lib/RESP/types").RedisArgument, topK: number, options?: import("./RESERVE").TopKReserveOptions | undefined) => void;
        readonly transformReply: () => import("@redis/client/dist/lib/RESP/types").SimpleStringReply<"OK">;
    };
};
export default _default;
//# sourceMappingURL=index.d.ts.map