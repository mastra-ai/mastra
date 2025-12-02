import { CommandParser } from '../client/parser';
import { UnwrapReply, ArrayReply, BlobStringReply, BooleanReply, CommandArguments, DoubleReply, NullReply, NumberReply, RedisArgument, TuplesReply, MapReply, TypeMapping, Command } from '../RESP/types';
export declare function isNullReply(reply: unknown): reply is NullReply;
export declare function isArrayReply(reply: unknown): reply is ArrayReply<unknown>;
export declare const transformBooleanReply: {
    2: (reply: NumberReply<0 | 1>) => boolean;
    3: () => BooleanReply;
};
export declare const transformBooleanArrayReply: {
    2: (reply: ArrayReply<NumberReply<0 | 1>>) => boolean[];
    3: () => ArrayReply<BooleanReply>;
};
export type BitValue = 0 | 1;
export declare function transformDoubleArgument(num: number): string;
export declare function transformStringDoubleArgument(num: RedisArgument | number): RedisArgument;
export declare const transformDoubleReply: {
    2: (reply: BlobStringReply, preserve?: any, typeMapping?: TypeMapping) => DoubleReply;
    3: () => DoubleReply;
};
export declare function createTransformDoubleReplyResp2Func(preserve?: any, typeMapping?: TypeMapping): (reply: BlobStringReply) => DoubleReply<number>;
export declare const transformDoubleArrayReply: {
    2: (reply: Array<BlobStringReply>, preserve?: any, typeMapping?: TypeMapping) => DoubleReply<number>[];
    3: () => ArrayReply<DoubleReply>;
};
export declare function createTransformNullableDoubleReplyResp2Func(preserve?: any, typeMapping?: TypeMapping): (reply: BlobStringReply | NullReply) => DoubleReply<number> | null;
export declare const transformNullableDoubleReply: {
    2: (reply: BlobStringReply | NullReply, preserve?: any, typeMapping?: TypeMapping) => DoubleReply<number> | null;
    3: () => DoubleReply | NullReply;
};
export interface Stringable {
    toString(): string;
}
export declare function transformTuplesToMap<T>(reply: UnwrapReply<ArrayReply<any>>, func: (elem: any) => T): any;
export declare function createTransformTuplesReplyFunc<T extends Stringable>(preserve?: any, typeMapping?: TypeMapping): (reply: ArrayReply<T>) => MapReply<T, T>;
export declare function transformTuplesReply<T extends Stringable>(reply: ArrayReply<T>, preserve?: any, typeMapping?: TypeMapping): MapReply<T, T>;
export interface SortedSetMember {
    value: RedisArgument;
    score: number;
}
export type SortedSetSide = 'MIN' | 'MAX';
export declare const transformSortedSetReply: {
    2: (reply: ArrayReply<BlobStringReply>, preserve?: any, typeMapping?: TypeMapping) => {
        value: BlobStringReply<string>;
        score: DoubleReply<number>;
    }[];
    3: (reply: ArrayReply<TuplesReply<[BlobStringReply, DoubleReply]>>) => {
        value: BlobStringReply<string>;
        score: DoubleReply<number>;
    }[];
};
export type ListSide = 'LEFT' | 'RIGHT';
export declare function transformEXAT(EXAT: number | Date): string;
export declare function transformPXAT(PXAT: number | Date): string;
export interface EvalOptions {
    keys?: Array<string>;
    arguments?: Array<string>;
}
export declare function evalFirstKeyIndex(options?: EvalOptions): string | undefined;
export declare function pushEvalArguments(args: Array<string>, options?: EvalOptions): Array<string>;
export declare function pushVariadicArguments(args: CommandArguments, value: RedisVariadicArgument): CommandArguments;
export declare function pushVariadicNumberArguments(args: CommandArguments, value: number | Array<number>): CommandArguments;
export type RedisVariadicArgument = RedisArgument | Array<RedisArgument>;
export declare function pushVariadicArgument(args: Array<RedisArgument>, value: RedisVariadicArgument): CommandArguments;
export declare function parseOptionalVariadicArgument(parser: CommandParser, name: RedisArgument, value?: RedisVariadicArgument): void;
export declare enum CommandFlags {
    WRITE = "write",// command may result in modifications
    READONLY = "readonly",// command will never modify keys
    DENYOOM = "denyoom",// reject command if currently out of memory
    ADMIN = "admin",// server admin command
    PUBSUB = "pubsub",// pubsub-related command
    NOSCRIPT = "noscript",// deny this command from scripts
    RANDOM = "random",// command has random results, dangerous for scripts
    SORT_FOR_SCRIPT = "sort_for_script",// if called from script, sort output
    LOADING = "loading",// allow command while database is loading
    STALE = "stale",// allow command while replica has stale data
    SKIP_MONITOR = "skip_monitor",// do not show this command in MONITOR
    ASKING = "asking",// cluster related - accept even if importing
    FAST = "fast",// command operates in constant or log(N) time. Used for latency monitoring.
    MOVABLEKEYS = "movablekeys"
}
export declare enum CommandCategories {
    KEYSPACE = "@keyspace",
    READ = "@read",
    WRITE = "@write",
    SET = "@set",
    SORTEDSET = "@sortedset",
    LIST = "@list",
    HASH = "@hash",
    STRING = "@string",
    BITMAP = "@bitmap",
    HYPERLOGLOG = "@hyperloglog",
    GEO = "@geo",
    STREAM = "@stream",
    PUBSUB = "@pubsub",
    ADMIN = "@admin",
    FAST = "@fast",
    SLOW = "@slow",
    BLOCKING = "@blocking",
    DANGEROUS = "@dangerous",
    CONNECTION = "@connection",
    TRANSACTION = "@transaction",
    SCRIPTING = "@scripting"
}
export type CommandRawReply = [
    name: string,
    arity: number,
    flags: Array<CommandFlags>,
    firstKeyIndex: number,
    lastKeyIndex: number,
    step: number,
    categories: Array<CommandCategories>
];
export type CommandReply = {
    name: string;
    arity: number;
    flags: Set<CommandFlags>;
    firstKeyIndex: number;
    lastKeyIndex: number;
    step: number;
    categories: Set<CommandCategories>;
};
export declare function transformCommandReply(this: void, [name, arity, flags, firstKeyIndex, lastKeyIndex, step, categories]: CommandRawReply): CommandReply;
export declare enum RedisFunctionFlags {
    NO_WRITES = "no-writes",
    ALLOW_OOM = "allow-oom",
    ALLOW_STALE = "allow-stale",
    NO_CLUSTER = "no-cluster"
}
export type FunctionListRawItemReply = [
    'library_name',
    string,
    'engine',
    string,
    'functions',
    Array<[
        'name',
        string,
        'description',
        string | null,
        'flags',
        Array<RedisFunctionFlags>
    ]>
];
export interface FunctionListItemReply {
    libraryName: string;
    engine: string;
    functions: Array<{
        name: string;
        description: string | null;
        flags: Array<RedisFunctionFlags>;
    }>;
}
export declare function transformFunctionListItemReply(reply: FunctionListRawItemReply): FunctionListItemReply;
export interface SlotRange {
    start: number;
    end: number;
}
export declare function parseSlotRangesArguments(parser: CommandParser, ranges: SlotRange | Array<SlotRange>): void;
export type RawRangeReply = [
    start: number,
    end: number
];
export interface RangeReply {
    start: number;
    end: number;
}
export declare function transformRangeReply([start, end]: RawRangeReply): RangeReply;
export type ZKeyAndWeight = {
    key: RedisArgument;
    weight: number;
};
export type ZVariadicKeys<T> = T | [T, ...Array<T>];
export type ZKeys = ZVariadicKeys<RedisArgument> | ZVariadicKeys<ZKeyAndWeight>;
export declare function parseZKeysArguments(parser: CommandParser, keys: ZKeys): void;
export type Tail<T extends unknown[]> = T extends [infer Head, ...infer Tail] ? Tail : never;
/**
 * @deprecated
 */
export declare function parseArgs(command: Command, ...args: Array<any>): CommandArguments;
export type StreamMessageRawReply = TuplesReply<[
    id: BlobStringReply,
    message: ArrayReply<BlobStringReply>
]>;
export type StreamMessageReply = {
    id: BlobStringReply;
    message: MapReply<BlobStringReply | string, BlobStringReply>;
};
export declare function transformStreamMessageReply(typeMapping: TypeMapping | undefined, reply: StreamMessageRawReply): StreamMessageReply;
export declare function transformStreamMessageNullReply(typeMapping: TypeMapping | undefined, reply: StreamMessageRawReply | NullReply): NullReply | StreamMessageReply;
export type StreamMessagesReply = Array<StreamMessageReply>;
export type StreamsMessagesReply = Array<{
    name: BlobStringReply | string;
    messages: StreamMessagesReply;
}> | null;
export declare function transformStreamMessagesReply(r: ArrayReply<StreamMessageRawReply>, typeMapping?: TypeMapping): StreamMessagesReply;
type StreamMessagesRawReply = TuplesReply<[name: BlobStringReply, ArrayReply<StreamMessageRawReply>]>;
type StreamsMessagesRawReply2 = ArrayReply<StreamMessagesRawReply>;
export declare function transformStreamsMessagesReplyResp2(reply: UnwrapReply<StreamsMessagesRawReply2 | NullReply>, preserve?: any, typeMapping?: TypeMapping): StreamsMessagesReply | NullReply;
type StreamsMessagesRawReply3 = MapReply<BlobStringReply, ArrayReply<StreamMessageRawReply>>;
export declare function transformStreamsMessagesReplyResp3(reply: UnwrapReply<StreamsMessagesRawReply3 | NullReply>): MapReply<BlobStringReply, StreamMessagesReply> | NullReply;
export type RedisJSON = null | boolean | number | string | Date | Array<RedisJSON> | {
    [key: string]: RedisJSON;
    [key: number]: RedisJSON;
};
export declare function transformRedisJsonArgument(json: RedisJSON): string;
export declare function transformRedisJsonReply(json: BlobStringReply): RedisJSON;
export declare function transformRedisJsonNullReply(json: NullReply | BlobStringReply): NullReply | RedisJSON;
export {};
//# sourceMappingURL=generic-transformers.d.ts.map