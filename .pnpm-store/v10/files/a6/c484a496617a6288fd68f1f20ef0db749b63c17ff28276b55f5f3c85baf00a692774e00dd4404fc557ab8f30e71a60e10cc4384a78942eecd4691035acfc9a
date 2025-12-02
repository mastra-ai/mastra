/// <reference types="node" />
declare const _default: {
    _LIST: {
        readonly NOT_KEYED_COMMAND: true;
        readonly IS_READ_ONLY: true;
        readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser) => void;
        readonly transformReply: {
            readonly 2: () => import("@redis/client/dist/lib/RESP/types").ArrayReply<import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>>;
            readonly 3: () => import("@redis/client/dist/lib/RESP/types").SetReply<import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>>;
        };
    };
    _list: {
        readonly NOT_KEYED_COMMAND: true;
        readonly IS_READ_ONLY: true;
        readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser) => void;
        readonly transformReply: {
            readonly 2: () => import("@redis/client/dist/lib/RESP/types").ArrayReply<import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>>;
            readonly 3: () => import("@redis/client/dist/lib/RESP/types").SetReply<import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>>;
        };
    };
    ALTER: {
        readonly NOT_KEYED_COMMAND: true;
        readonly IS_READ_ONLY: true;
        readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, index: import("@redis/client").RedisArgument, schema: import("./CREATE").RediSearchSchema) => void;
        readonly transformReply: () => import("@redis/client/dist/lib/RESP/types").SimpleStringReply<"OK">;
    };
    alter: {
        readonly NOT_KEYED_COMMAND: true;
        readonly IS_READ_ONLY: true;
        readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, index: import("@redis/client").RedisArgument, schema: import("./CREATE").RediSearchSchema) => void;
        readonly transformReply: () => import("@redis/client/dist/lib/RESP/types").SimpleStringReply<"OK">;
    };
    AGGREGATE_WITHCURSOR: {
        readonly IS_READ_ONLY: false;
        readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, index: import("@redis/client").RedisArgument, query: import("@redis/client").RedisArgument, options?: import("./AGGREGATE_WITHCURSOR").FtAggregateWithCursorOptions | undefined) => void;
        readonly transformReply: {
            readonly 2: (reply: [result: [total: import("@redis/client/dist/lib/RESP/types").UnwrapReply<import("@redis/client/dist/lib/RESP/types").NumberReply<number>>, ...results: import("@redis/client/dist/lib/RESP/types").ArrayReply<import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>>[]], cursor: import("@redis/client/dist/lib/RESP/types").NumberReply<number>]) => import("./AGGREGATE_WITHCURSOR").AggregateWithCursorReply;
            readonly 3: () => import("@redis/client/dist/lib/RESP/types").ReplyUnion;
        };
        readonly unstableResp3: true;
    };
    aggregateWithCursor: {
        readonly IS_READ_ONLY: false;
        readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, index: import("@redis/client").RedisArgument, query: import("@redis/client").RedisArgument, options?: import("./AGGREGATE_WITHCURSOR").FtAggregateWithCursorOptions | undefined) => void;
        readonly transformReply: {
            readonly 2: (reply: [result: [total: import("@redis/client/dist/lib/RESP/types").UnwrapReply<import("@redis/client/dist/lib/RESP/types").NumberReply<number>>, ...results: import("@redis/client/dist/lib/RESP/types").ArrayReply<import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>>[]], cursor: import("@redis/client/dist/lib/RESP/types").NumberReply<number>]) => import("./AGGREGATE_WITHCURSOR").AggregateWithCursorReply;
            readonly 3: () => import("@redis/client/dist/lib/RESP/types").ReplyUnion;
        };
        readonly unstableResp3: true;
    };
    AGGREGATE: {
        readonly NOT_KEYED_COMMAND: true;
        readonly IS_READ_ONLY: false;
        readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, index: import("@redis/client").RedisArgument, query: import("@redis/client").RedisArgument, options?: import("./AGGREGATE").FtAggregateOptions | undefined) => void;
        readonly transformReply: {
            readonly 2: (rawReply: [total: import("@redis/client/dist/lib/RESP/types").UnwrapReply<import("@redis/client/dist/lib/RESP/types").NumberReply<number>>, ...results: import("@redis/client/dist/lib/RESP/types").ArrayReply<import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>>[]], preserve?: any, typeMapping?: import("@redis/client").TypeMapping | undefined) => import("./AGGREGATE").AggregateReply;
            readonly 3: () => import("@redis/client/dist/lib/RESP/types").ReplyUnion;
        };
        readonly unstableResp3: true;
    };
    aggregate: {
        readonly NOT_KEYED_COMMAND: true;
        readonly IS_READ_ONLY: false;
        readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, index: import("@redis/client").RedisArgument, query: import("@redis/client").RedisArgument, options?: import("./AGGREGATE").FtAggregateOptions | undefined) => void;
        readonly transformReply: {
            readonly 2: (rawReply: [total: import("@redis/client/dist/lib/RESP/types").UnwrapReply<import("@redis/client/dist/lib/RESP/types").NumberReply<number>>, ...results: import("@redis/client/dist/lib/RESP/types").ArrayReply<import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>>[]], preserve?: any, typeMapping?: import("@redis/client").TypeMapping | undefined) => import("./AGGREGATE").AggregateReply;
            readonly 3: () => import("@redis/client/dist/lib/RESP/types").ReplyUnion;
        };
        readonly unstableResp3: true;
    };
    ALIASADD: {
        readonly NOT_KEYED_COMMAND: true;
        readonly IS_READ_ONLY: true;
        readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, alias: import("@redis/client").RedisArgument, index: import("@redis/client").RedisArgument) => void;
        readonly transformReply: () => import("@redis/client/dist/lib/RESP/types").SimpleStringReply<"OK">;
    };
    aliasAdd: {
        readonly NOT_KEYED_COMMAND: true;
        readonly IS_READ_ONLY: true;
        readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, alias: import("@redis/client").RedisArgument, index: import("@redis/client").RedisArgument) => void;
        readonly transformReply: () => import("@redis/client/dist/lib/RESP/types").SimpleStringReply<"OK">;
    };
    ALIASDEL: {
        readonly NOT_KEYED_COMMAND: true;
        readonly IS_READ_ONLY: true;
        readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, alias: import("@redis/client").RedisArgument) => void;
        readonly transformReply: () => import("@redis/client/dist/lib/RESP/types").SimpleStringReply<"OK">;
    };
    aliasDel: {
        readonly NOT_KEYED_COMMAND: true;
        readonly IS_READ_ONLY: true;
        readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, alias: import("@redis/client").RedisArgument) => void;
        readonly transformReply: () => import("@redis/client/dist/lib/RESP/types").SimpleStringReply<"OK">;
    };
    ALIASUPDATE: {
        readonly NOT_KEYED_COMMAND: true;
        readonly IS_READ_ONLY: true;
        readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, alias: import("@redis/client").RedisArgument, index: import("@redis/client").RedisArgument) => void;
        readonly transformReply: () => import("@redis/client/dist/lib/RESP/types").SimpleStringReply<"OK">;
    };
    aliasUpdate: {
        readonly NOT_KEYED_COMMAND: true;
        readonly IS_READ_ONLY: true;
        readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, alias: import("@redis/client").RedisArgument, index: import("@redis/client").RedisArgument) => void;
        readonly transformReply: () => import("@redis/client/dist/lib/RESP/types").SimpleStringReply<"OK">;
    };
    /**
     * @deprecated Redis >=8 uses the standard CONFIG command
     */
    CONFIG_GET: {
        readonly NOT_KEYED_COMMAND: true;
        readonly IS_READ_ONLY: true;
        readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, option: string) => void;
        readonly transformReply: (this: void, reply: import("@redis/client/dist/lib/RESP/types").TuplesReply<[import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>, import("@redis/client/dist/lib/RESP/types").BlobStringReply<string> | import("@redis/client/dist/lib/RESP/types").NullReply]>[]) => Record<string, import("@redis/client/dist/lib/RESP/types").BlobStringReply<string> | import("@redis/client/dist/lib/RESP/types").NullReply>;
    };
    /**
     * @deprecated Redis >=8 uses the standard CONFIG command
     */
    configGet: {
        readonly NOT_KEYED_COMMAND: true;
        readonly IS_READ_ONLY: true;
        readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, option: string) => void;
        readonly transformReply: (this: void, reply: import("@redis/client/dist/lib/RESP/types").TuplesReply<[import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>, import("@redis/client/dist/lib/RESP/types").BlobStringReply<string> | import("@redis/client/dist/lib/RESP/types").NullReply]>[]) => Record<string, import("@redis/client/dist/lib/RESP/types").BlobStringReply<string> | import("@redis/client/dist/lib/RESP/types").NullReply>;
    };
    /**
     * @deprecated Redis >=8 uses the standard CONFIG command
     */
    CONFIG_SET: {
        readonly NOT_KEYED_COMMAND: true;
        readonly IS_READ_ONLY: true;
        readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, property: Buffer | (string & {}) | "a" | "b", value: import("@redis/client").RedisArgument) => void;
        readonly transformReply: () => import("@redis/client/dist/lib/RESP/types").SimpleStringReply<"OK">;
    };
    /**
     * @deprecated Redis >=8 uses the standard CONFIG command
     */
    configSet: {
        readonly NOT_KEYED_COMMAND: true;
        readonly IS_READ_ONLY: true;
        readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, property: Buffer | (string & {}) | "a" | "b", value: import("@redis/client").RedisArgument) => void;
        readonly transformReply: () => import("@redis/client/dist/lib/RESP/types").SimpleStringReply<"OK">;
    };
    CREATE: {
        readonly NOT_KEYED_COMMAND: true;
        readonly IS_READ_ONLY: true;
        readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, index: import("@redis/client").RedisArgument, schema: import("./CREATE").RediSearchSchema, options?: import("./CREATE").CreateOptions | undefined) => void;
        readonly transformReply: () => import("@redis/client/dist/lib/RESP/types").SimpleStringReply<"OK">;
    };
    create: {
        readonly NOT_KEYED_COMMAND: true;
        readonly IS_READ_ONLY: true;
        readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, index: import("@redis/client").RedisArgument, schema: import("./CREATE").RediSearchSchema, options?: import("./CREATE").CreateOptions | undefined) => void;
        readonly transformReply: () => import("@redis/client/dist/lib/RESP/types").SimpleStringReply<"OK">;
    };
    CURSOR_DEL: {
        readonly NOT_KEYED_COMMAND: true;
        readonly IS_READ_ONLY: true;
        readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, index: import("@redis/client").RedisArgument, cursorId: import("@redis/client/dist/lib/RESP/types").UnwrapReply<import("@redis/client/dist/lib/RESP/types").NumberReply<number>>) => void;
        readonly transformReply: () => import("@redis/client/dist/lib/RESP/types").SimpleStringReply<"OK">;
    };
    cursorDel: {
        readonly NOT_KEYED_COMMAND: true;
        readonly IS_READ_ONLY: true;
        readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, index: import("@redis/client").RedisArgument, cursorId: import("@redis/client/dist/lib/RESP/types").UnwrapReply<import("@redis/client/dist/lib/RESP/types").NumberReply<number>>) => void;
        readonly transformReply: () => import("@redis/client/dist/lib/RESP/types").SimpleStringReply<"OK">;
    };
    CURSOR_READ: {
        readonly NOT_KEYED_COMMAND: true;
        readonly IS_READ_ONLY: true;
        readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, index: import("@redis/client").RedisArgument, cursor: import("@redis/client/dist/lib/RESP/types").UnwrapReply<import("@redis/client/dist/lib/RESP/types").NumberReply<number>>, options?: import("./CURSOR_READ").FtCursorReadOptions | undefined) => void;
        readonly transformReply: {
            readonly 2: (reply: [result: [total: import("@redis/client/dist/lib/RESP/types").UnwrapReply<import("@redis/client/dist/lib/RESP/types").NumberReply<number>>, ...results: import("@redis/client/dist/lib/RESP/types").ArrayReply<import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>>[]], cursor: import("@redis/client/dist/lib/RESP/types").NumberReply<number>]) => import("./AGGREGATE_WITHCURSOR").AggregateWithCursorReply;
            readonly 3: () => import("@redis/client/dist/lib/RESP/types").ReplyUnion;
        };
        readonly unstableResp3: true;
    };
    cursorRead: {
        readonly NOT_KEYED_COMMAND: true;
        readonly IS_READ_ONLY: true;
        readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, index: import("@redis/client").RedisArgument, cursor: import("@redis/client/dist/lib/RESP/types").UnwrapReply<import("@redis/client/dist/lib/RESP/types").NumberReply<number>>, options?: import("./CURSOR_READ").FtCursorReadOptions | undefined) => void;
        readonly transformReply: {
            readonly 2: (reply: [result: [total: import("@redis/client/dist/lib/RESP/types").UnwrapReply<import("@redis/client/dist/lib/RESP/types").NumberReply<number>>, ...results: import("@redis/client/dist/lib/RESP/types").ArrayReply<import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>>[]], cursor: import("@redis/client/dist/lib/RESP/types").NumberReply<number>]) => import("./AGGREGATE_WITHCURSOR").AggregateWithCursorReply;
            readonly 3: () => import("@redis/client/dist/lib/RESP/types").ReplyUnion;
        };
        readonly unstableResp3: true;
    };
    DICTADD: {
        readonly NOT_KEYED_COMMAND: true;
        readonly IS_READ_ONLY: true;
        readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, dictionary: import("@redis/client").RedisArgument, term: import("@redis/client/dist/lib/commands/generic-transformers").RedisVariadicArgument) => void;
        readonly transformReply: () => import("@redis/client/dist/lib/RESP/types").NumberReply<number>;
    };
    dictAdd: {
        readonly NOT_KEYED_COMMAND: true;
        readonly IS_READ_ONLY: true;
        readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, dictionary: import("@redis/client").RedisArgument, term: import("@redis/client/dist/lib/commands/generic-transformers").RedisVariadicArgument) => void;
        readonly transformReply: () => import("@redis/client/dist/lib/RESP/types").NumberReply<number>;
    };
    DICTDEL: {
        readonly NOT_KEYED_COMMAND: true;
        readonly IS_READ_ONLY: true;
        readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, dictionary: import("@redis/client").RedisArgument, term: import("@redis/client/dist/lib/commands/generic-transformers").RedisVariadicArgument) => void;
        readonly transformReply: () => import("@redis/client/dist/lib/RESP/types").NumberReply<number>;
    };
    dictDel: {
        readonly NOT_KEYED_COMMAND: true;
        readonly IS_READ_ONLY: true;
        readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, dictionary: import("@redis/client").RedisArgument, term: import("@redis/client/dist/lib/commands/generic-transformers").RedisVariadicArgument) => void;
        readonly transformReply: () => import("@redis/client/dist/lib/RESP/types").NumberReply<number>;
    };
    DICTDUMP: {
        readonly NOT_KEYED_COMMAND: true;
        readonly IS_READ_ONLY: true;
        readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, dictionary: import("@redis/client").RedisArgument) => void;
        readonly transformReply: {
            readonly 2: () => import("@redis/client/dist/lib/RESP/types").ArrayReply<import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>>;
            readonly 3: () => import("@redis/client/dist/lib/RESP/types").SetReply<import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>>;
        };
    };
    dictDump: {
        readonly NOT_KEYED_COMMAND: true;
        readonly IS_READ_ONLY: true;
        readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, dictionary: import("@redis/client").RedisArgument) => void;
        readonly transformReply: {
            readonly 2: () => import("@redis/client/dist/lib/RESP/types").ArrayReply<import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>>;
            readonly 3: () => import("@redis/client/dist/lib/RESP/types").SetReply<import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>>;
        };
    };
    DROPINDEX: {
        readonly NOT_KEYED_COMMAND: true;
        readonly IS_READ_ONLY: true;
        readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, index: import("@redis/client").RedisArgument, options?: import("./DROPINDEX").FtDropIndexOptions | undefined) => void;
        readonly transformReply: {
            readonly 2: () => import("@redis/client/dist/lib/RESP/types").SimpleStringReply<"OK">;
            readonly 3: () => import("@redis/client/dist/lib/RESP/types").NumberReply<number>;
        };
    };
    dropIndex: {
        readonly NOT_KEYED_COMMAND: true;
        readonly IS_READ_ONLY: true;
        readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, index: import("@redis/client").RedisArgument, options?: import("./DROPINDEX").FtDropIndexOptions | undefined) => void;
        readonly transformReply: {
            readonly 2: () => import("@redis/client/dist/lib/RESP/types").SimpleStringReply<"OK">;
            readonly 3: () => import("@redis/client/dist/lib/RESP/types").NumberReply<number>;
        };
    };
    EXPLAIN: {
        readonly NOT_KEYED_COMMAND: true;
        readonly IS_READ_ONLY: true;
        readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, index: import("@redis/client").RedisArgument, query: import("@redis/client").RedisArgument, options?: import("./EXPLAIN").FtExplainOptions | undefined) => void;
        readonly transformReply: () => import("@redis/client/dist/lib/RESP/types").SimpleStringReply<string>;
    };
    explain: {
        readonly NOT_KEYED_COMMAND: true;
        readonly IS_READ_ONLY: true;
        readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, index: import("@redis/client").RedisArgument, query: import("@redis/client").RedisArgument, options?: import("./EXPLAIN").FtExplainOptions | undefined) => void;
        readonly transformReply: () => import("@redis/client/dist/lib/RESP/types").SimpleStringReply<string>;
    };
    EXPLAINCLI: {
        readonly NOT_KEYED_COMMAND: true;
        readonly IS_READ_ONLY: true;
        readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, index: import("@redis/client").RedisArgument, query: import("@redis/client").RedisArgument, options?: import("./EXPLAINCLI").FtExplainCLIOptions | undefined) => void;
        readonly transformReply: () => import("@redis/client/dist/lib/RESP/types").ArrayReply<import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>>;
    };
    explainCli: {
        readonly NOT_KEYED_COMMAND: true;
        readonly IS_READ_ONLY: true;
        readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, index: import("@redis/client").RedisArgument, query: import("@redis/client").RedisArgument, options?: import("./EXPLAINCLI").FtExplainCLIOptions | undefined) => void;
        readonly transformReply: () => import("@redis/client/dist/lib/RESP/types").ArrayReply<import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>>;
    };
    INFO: {
        readonly NOT_KEYED_COMMAND: true;
        readonly IS_READ_ONLY: true;
        readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, index: import("@redis/client").RedisArgument) => void;
        readonly transformReply: {
            readonly 2: (reply: any[], preserve?: any, typeMapping?: import("@redis/client").TypeMapping | undefined) => import("./INFO").InfoReply;
            readonly 3: () => import("@redis/client/dist/lib/RESP/types").ReplyUnion;
        };
        readonly unstableResp3: true;
    };
    info: {
        readonly NOT_KEYED_COMMAND: true;
        readonly IS_READ_ONLY: true;
        readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, index: import("@redis/client").RedisArgument) => void;
        readonly transformReply: {
            readonly 2: (reply: any[], preserve?: any, typeMapping?: import("@redis/client").TypeMapping | undefined) => import("./INFO").InfoReply;
            readonly 3: () => import("@redis/client/dist/lib/RESP/types").ReplyUnion;
        };
        readonly unstableResp3: true;
    };
    PROFILESEARCH: {
        readonly NOT_KEYED_COMMAND: true;
        readonly IS_READ_ONLY: true;
        readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, index: import("@redis/client").RedisArgument, query: import("@redis/client").RedisArgument, options?: (import("./PROFILE_SEARCH").ProfileOptions & import("./SEARCH").FtSearchOptions) | undefined) => void;
        readonly transformReply: {
            readonly 2: (reply: [import("./SEARCH").SearchRawReply, import("@redis/client/dist/lib/RESP/types").ArrayReply<import("@redis/client/dist/lib/RESP/types").ReplyUnion>]) => import("./PROFILE_SEARCH").ProfileReplyResp2;
            readonly 3: (reply: import("@redis/client/dist/lib/RESP/types").ReplyUnion) => import("@redis/client/dist/lib/RESP/types").ReplyUnion;
        };
        readonly unstableResp3: true;
    };
    profileSearch: {
        readonly NOT_KEYED_COMMAND: true;
        readonly IS_READ_ONLY: true;
        readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, index: import("@redis/client").RedisArgument, query: import("@redis/client").RedisArgument, options?: (import("./PROFILE_SEARCH").ProfileOptions & import("./SEARCH").FtSearchOptions) | undefined) => void;
        readonly transformReply: {
            readonly 2: (reply: [import("./SEARCH").SearchRawReply, import("@redis/client/dist/lib/RESP/types").ArrayReply<import("@redis/client/dist/lib/RESP/types").ReplyUnion>]) => import("./PROFILE_SEARCH").ProfileReplyResp2;
            readonly 3: (reply: import("@redis/client/dist/lib/RESP/types").ReplyUnion) => import("@redis/client/dist/lib/RESP/types").ReplyUnion;
        };
        readonly unstableResp3: true;
    };
    PROFILEAGGREGATE: {
        readonly NOT_KEYED_COMMAND: true;
        readonly IS_READ_ONLY: true;
        readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, index: string, query: string, options?: (import("./PROFILE_SEARCH").ProfileOptions & import("./AGGREGATE").FtAggregateOptions) | undefined) => void;
        readonly transformReply: {
            readonly 2: (reply: [[total: import("@redis/client/dist/lib/RESP/types").UnwrapReply<import("@redis/client/dist/lib/RESP/types").NumberReply<number>>, ...results: import("@redis/client/dist/lib/RESP/types").ArrayReply<import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>>[]], import("@redis/client/dist/lib/RESP/types").ArrayReply<import("@redis/client/dist/lib/RESP/types").ReplyUnion>]) => import("./PROFILE_SEARCH").ProfileReplyResp2;
            readonly 3: (reply: import("@redis/client/dist/lib/RESP/types").ReplyUnion) => import("@redis/client/dist/lib/RESP/types").ReplyUnion;
        };
        readonly unstableResp3: true;
    };
    profileAggregate: {
        readonly NOT_KEYED_COMMAND: true;
        readonly IS_READ_ONLY: true;
        readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, index: string, query: string, options?: (import("./PROFILE_SEARCH").ProfileOptions & import("./AGGREGATE").FtAggregateOptions) | undefined) => void;
        readonly transformReply: {
            readonly 2: (reply: [[total: import("@redis/client/dist/lib/RESP/types").UnwrapReply<import("@redis/client/dist/lib/RESP/types").NumberReply<number>>, ...results: import("@redis/client/dist/lib/RESP/types").ArrayReply<import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>>[]], import("@redis/client/dist/lib/RESP/types").ArrayReply<import("@redis/client/dist/lib/RESP/types").ReplyUnion>]) => import("./PROFILE_SEARCH").ProfileReplyResp2;
            readonly 3: (reply: import("@redis/client/dist/lib/RESP/types").ReplyUnion) => import("@redis/client/dist/lib/RESP/types").ReplyUnion;
        };
        readonly unstableResp3: true;
    };
    SEARCH_NOCONTENT: {
        readonly NOT_KEYED_COMMAND: true;
        readonly IS_READ_ONLY: true;
        readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, index: import("@redis/client").RedisArgument, query: import("@redis/client").RedisArgument, options?: import("./SEARCH").FtSearchOptions | undefined) => void;
        readonly transformReply: {
            readonly 2: (reply: import("./SEARCH").SearchRawReply) => import("./SEARCH_NOCONTENT").SearchNoContentReply;
            readonly 3: () => import("@redis/client/dist/lib/RESP/types").ReplyUnion;
        };
        readonly unstableResp3: true;
    };
    searchNoContent: {
        readonly NOT_KEYED_COMMAND: true;
        readonly IS_READ_ONLY: true;
        readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, index: import("@redis/client").RedisArgument, query: import("@redis/client").RedisArgument, options?: import("./SEARCH").FtSearchOptions | undefined) => void;
        readonly transformReply: {
            readonly 2: (reply: import("./SEARCH").SearchRawReply) => import("./SEARCH_NOCONTENT").SearchNoContentReply;
            readonly 3: () => import("@redis/client/dist/lib/RESP/types").ReplyUnion;
        };
        readonly unstableResp3: true;
    };
    SEARCH: {
        readonly NOT_KEYED_COMMAND: true;
        readonly IS_READ_ONLY: true;
        readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, index: import("@redis/client").RedisArgument, query: import("@redis/client").RedisArgument, options?: import("./SEARCH").FtSearchOptions | undefined) => void;
        readonly transformReply: {
            readonly 2: (reply: import("./SEARCH").SearchRawReply) => import("./SEARCH").SearchReply;
            readonly 3: () => import("@redis/client/dist/lib/RESP/types").ReplyUnion;
        };
        readonly unstableResp3: true;
    };
    search: {
        readonly NOT_KEYED_COMMAND: true;
        readonly IS_READ_ONLY: true;
        readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, index: import("@redis/client").RedisArgument, query: import("@redis/client").RedisArgument, options?: import("./SEARCH").FtSearchOptions | undefined) => void;
        readonly transformReply: {
            readonly 2: (reply: import("./SEARCH").SearchRawReply) => import("./SEARCH").SearchReply;
            readonly 3: () => import("@redis/client/dist/lib/RESP/types").ReplyUnion;
        };
        readonly unstableResp3: true;
    };
    SPELLCHECK: {
        readonly NOT_KEYED_COMMAND: true;
        readonly IS_READ_ONLY: true;
        readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, index: import("@redis/client").RedisArgument, query: import("@redis/client").RedisArgument, options?: import("./SPELLCHECK").FtSpellCheckOptions | undefined) => void;
        readonly transformReply: {
            readonly 2: (rawReply: [_: string, term: string, suggestions: [score: string, suggestion: string][]][]) => {
                term: string;
                suggestions: {
                    score: number;
                    suggestion: string;
                }[];
            }[];
            readonly 3: () => import("@redis/client/dist/lib/RESP/types").ReplyUnion;
        };
        readonly unstableResp3: true;
    };
    spellCheck: {
        readonly NOT_KEYED_COMMAND: true;
        readonly IS_READ_ONLY: true;
        readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, index: import("@redis/client").RedisArgument, query: import("@redis/client").RedisArgument, options?: import("./SPELLCHECK").FtSpellCheckOptions | undefined) => void;
        readonly transformReply: {
            readonly 2: (rawReply: [_: string, term: string, suggestions: [score: string, suggestion: string][]][]) => {
                term: string;
                suggestions: {
                    score: number;
                    suggestion: string;
                }[];
            }[];
            readonly 3: () => import("@redis/client/dist/lib/RESP/types").ReplyUnion;
        };
        readonly unstableResp3: true;
    };
    SUGADD: {
        readonly IS_READ_ONLY: true;
        readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, key: import("@redis/client").RedisArgument, string: import("@redis/client").RedisArgument, score: number, options?: import("./SUGADD").FtSugAddOptions | undefined) => void;
        readonly transformReply: () => import("@redis/client/dist/lib/RESP/types").NumberReply<number>;
    };
    sugAdd: {
        readonly IS_READ_ONLY: true;
        readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, key: import("@redis/client").RedisArgument, string: import("@redis/client").RedisArgument, score: number, options?: import("./SUGADD").FtSugAddOptions | undefined) => void;
        readonly transformReply: () => import("@redis/client/dist/lib/RESP/types").NumberReply<number>;
    };
    SUGDEL: {
        readonly IS_READ_ONLY: true;
        readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, key: import("@redis/client").RedisArgument, string: import("@redis/client").RedisArgument) => void;
        readonly transformReply: () => import("@redis/client/dist/lib/RESP/types").NumberReply<0 | 1>;
    };
    sugDel: {
        readonly IS_READ_ONLY: true;
        readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, key: import("@redis/client").RedisArgument, string: import("@redis/client").RedisArgument) => void;
        readonly transformReply: () => import("@redis/client/dist/lib/RESP/types").NumberReply<0 | 1>;
    };
    SUGGET_WITHPAYLOADS: {
        readonly IS_READ_ONLY: true;
        readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, key: import("@redis/client").RedisArgument, prefix: import("@redis/client").RedisArgument, options?: import("./SUGGET").FtSugGetOptions | undefined) => void;
        readonly transformReply: (this: void, reply: import("@redis/client/dist/lib/RESP/types").NullReply | import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>[]) => {
            suggestion: import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>;
            payload: import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>;
        }[] | null;
    };
    sugGetWithPayloads: {
        readonly IS_READ_ONLY: true;
        readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, key: import("@redis/client").RedisArgument, prefix: import("@redis/client").RedisArgument, options?: import("./SUGGET").FtSugGetOptions | undefined) => void;
        readonly transformReply: (this: void, reply: import("@redis/client/dist/lib/RESP/types").NullReply | import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>[]) => {
            suggestion: import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>;
            payload: import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>;
        }[] | null;
    };
    SUGGET_WITHSCORES_WITHPAYLOADS: {
        readonly IS_READ_ONLY: true;
        readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, key: import("@redis/client").RedisArgument, prefix: import("@redis/client").RedisArgument, options?: import("./SUGGET").FtSugGetOptions | undefined) => void;
        readonly transformReply: {
            readonly 2: (reply: import("@redis/client/dist/lib/RESP/types").NullReply | import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>[], preserve?: any, typeMapping?: import("@redis/client").TypeMapping | undefined) => {
                suggestion: import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>;
                score: import("@redis/client/dist/lib/RESP/types").DoubleReply<number>;
                payload: import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>;
            }[] | null;
            readonly 3: (reply: import("@redis/client/dist/lib/RESP/types").NullReply | (import("@redis/client/dist/lib/RESP/types").BlobStringReply<string> | import("@redis/client/dist/lib/RESP/types").DoubleReply<number>)[]) => {
                suggestion: import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>;
                score: import("@redis/client/dist/lib/RESP/types").DoubleReply<number>;
                payload: import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>;
            }[] | null;
        };
    };
    sugGetWithScoresWithPayloads: {
        readonly IS_READ_ONLY: true;
        readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, key: import("@redis/client").RedisArgument, prefix: import("@redis/client").RedisArgument, options?: import("./SUGGET").FtSugGetOptions | undefined) => void;
        readonly transformReply: {
            readonly 2: (reply: import("@redis/client/dist/lib/RESP/types").NullReply | import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>[], preserve?: any, typeMapping?: import("@redis/client").TypeMapping | undefined) => {
                suggestion: import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>;
                score: import("@redis/client/dist/lib/RESP/types").DoubleReply<number>;
                payload: import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>;
            }[] | null;
            readonly 3: (reply: import("@redis/client/dist/lib/RESP/types").NullReply | (import("@redis/client/dist/lib/RESP/types").BlobStringReply<string> | import("@redis/client/dist/lib/RESP/types").DoubleReply<number>)[]) => {
                suggestion: import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>;
                score: import("@redis/client/dist/lib/RESP/types").DoubleReply<number>;
                payload: import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>;
            }[] | null;
        };
    };
    SUGGET_WITHSCORES: {
        readonly IS_READ_ONLY: true;
        readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, key: import("@redis/client").RedisArgument, prefix: import("@redis/client").RedisArgument, options?: import("./SUGGET").FtSugGetOptions | undefined) => void;
        readonly transformReply: {
            readonly 2: (reply: import("@redis/client/dist/lib/RESP/types").NullReply | import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>[], preserve?: any, typeMapping?: import("@redis/client").TypeMapping | undefined) => {
                suggestion: import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>;
                score: import("@redis/client/dist/lib/RESP/types").DoubleReply<number>;
            }[] | null;
            readonly 3: (reply: (import("@redis/client/dist/lib/RESP/types").BlobStringReply<string> | import("@redis/client/dist/lib/RESP/types").DoubleReply<number>)[]) => {
                suggestion: import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>;
                score: import("@redis/client/dist/lib/RESP/types").DoubleReply<number>;
            }[] | null;
        };
    };
    sugGetWithScores: {
        readonly IS_READ_ONLY: true;
        readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, key: import("@redis/client").RedisArgument, prefix: import("@redis/client").RedisArgument, options?: import("./SUGGET").FtSugGetOptions | undefined) => void;
        readonly transformReply: {
            readonly 2: (reply: import("@redis/client/dist/lib/RESP/types").NullReply | import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>[], preserve?: any, typeMapping?: import("@redis/client").TypeMapping | undefined) => {
                suggestion: import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>;
                score: import("@redis/client/dist/lib/RESP/types").DoubleReply<number>;
            }[] | null;
            readonly 3: (reply: (import("@redis/client/dist/lib/RESP/types").BlobStringReply<string> | import("@redis/client/dist/lib/RESP/types").DoubleReply<number>)[]) => {
                suggestion: import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>;
                score: import("@redis/client/dist/lib/RESP/types").DoubleReply<number>;
            }[] | null;
        };
    };
    SUGGET: {
        readonly IS_READ_ONLY: true;
        readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, key: import("@redis/client").RedisArgument, prefix: import("@redis/client").RedisArgument, options?: import("./SUGGET").FtSugGetOptions | undefined) => void;
        readonly transformReply: () => import("@redis/client/dist/lib/RESP/types").ArrayReply<import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>> | import("@redis/client/dist/lib/RESP/types").NullReply;
    };
    sugGet: {
        readonly IS_READ_ONLY: true;
        readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, key: import("@redis/client").RedisArgument, prefix: import("@redis/client").RedisArgument, options?: import("./SUGGET").FtSugGetOptions | undefined) => void;
        readonly transformReply: () => import("@redis/client/dist/lib/RESP/types").ArrayReply<import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>> | import("@redis/client/dist/lib/RESP/types").NullReply;
    };
    SUGLEN: {
        readonly IS_READ_ONLY: true;
        readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, key: import("@redis/client").RedisArgument) => void;
        readonly transformReply: () => import("@redis/client/dist/lib/RESP/types").NumberReply<number>;
    };
    sugLen: {
        readonly IS_READ_ONLY: true;
        readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, key: import("@redis/client").RedisArgument) => void;
        readonly transformReply: () => import("@redis/client/dist/lib/RESP/types").NumberReply<number>;
    };
    SYNDUMP: {
        readonly NOT_KEYED_COMMAND: true;
        readonly IS_READ_ONLY: true;
        readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, index: import("@redis/client").RedisArgument) => void;
        readonly transformReply: {
            readonly 2: (reply: (import("@redis/client/dist/lib/RESP/types").BlobStringReply<string> | import("@redis/client/dist/lib/RESP/types").ArrayReply<import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>>)[]) => Record<string, import("@redis/client/dist/lib/RESP/types").ArrayReply<import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>>>;
            readonly 3: () => import("@redis/client/dist/lib/RESP/types").MapReply<import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>, import("@redis/client/dist/lib/RESP/types").ArrayReply<import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>>>;
        };
    };
    synDump: {
        readonly NOT_KEYED_COMMAND: true;
        readonly IS_READ_ONLY: true;
        readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, index: import("@redis/client").RedisArgument) => void;
        readonly transformReply: {
            readonly 2: (reply: (import("@redis/client/dist/lib/RESP/types").BlobStringReply<string> | import("@redis/client/dist/lib/RESP/types").ArrayReply<import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>>)[]) => Record<string, import("@redis/client/dist/lib/RESP/types").ArrayReply<import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>>>;
            readonly 3: () => import("@redis/client/dist/lib/RESP/types").MapReply<import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>, import("@redis/client/dist/lib/RESP/types").ArrayReply<import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>>>;
        };
    };
    SYNUPDATE: {
        readonly NOT_KEYED_COMMAND: true;
        readonly IS_READ_ONLY: true;
        readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, index: import("@redis/client").RedisArgument, groupId: import("@redis/client").RedisArgument, terms: import("@redis/client/dist/lib/commands/generic-transformers").RedisVariadicArgument, options?: import("./SYNUPDATE").FtSynUpdateOptions | undefined) => void;
        readonly transformReply: () => import("@redis/client/dist/lib/RESP/types").SimpleStringReply<"OK">;
    };
    synUpdate: {
        readonly NOT_KEYED_COMMAND: true;
        readonly IS_READ_ONLY: true;
        readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, index: import("@redis/client").RedisArgument, groupId: import("@redis/client").RedisArgument, terms: import("@redis/client/dist/lib/commands/generic-transformers").RedisVariadicArgument, options?: import("./SYNUPDATE").FtSynUpdateOptions | undefined) => void;
        readonly transformReply: () => import("@redis/client/dist/lib/RESP/types").SimpleStringReply<"OK">;
    };
    TAGVALS: {
        readonly NOT_KEYED_COMMAND: true;
        readonly IS_READ_ONLY: true;
        readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, index: import("@redis/client").RedisArgument, fieldName: import("@redis/client").RedisArgument) => void;
        readonly transformReply: {
            readonly 2: () => import("@redis/client/dist/lib/RESP/types").ArrayReply<import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>>;
            readonly 3: () => import("@redis/client/dist/lib/RESP/types").SetReply<import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>>;
        };
    };
    tagVals: {
        readonly NOT_KEYED_COMMAND: true;
        readonly IS_READ_ONLY: true;
        readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, index: import("@redis/client").RedisArgument, fieldName: import("@redis/client").RedisArgument) => void;
        readonly transformReply: {
            readonly 2: () => import("@redis/client/dist/lib/RESP/types").ArrayReply<import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>>;
            readonly 3: () => import("@redis/client/dist/lib/RESP/types").SetReply<import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>>;
        };
    };
};
export default _default;
//# sourceMappingURL=index.d.ts.map