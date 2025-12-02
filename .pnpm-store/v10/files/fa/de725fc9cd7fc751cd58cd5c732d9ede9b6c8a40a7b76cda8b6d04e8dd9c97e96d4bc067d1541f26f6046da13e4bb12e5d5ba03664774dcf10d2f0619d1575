type CommandArgs<TCommand extends new (..._args: any) => any> = ConstructorParameters<TCommand>[0];
type Telemetry = {
    /**
     * Upstash-Telemetry-Sdk
     * @example @upstash/redis@v1.1.1
     */
    sdk?: string;
    /**
     * Upstash-Telemetry-Platform
     * @example cloudflare
     */
    platform?: string;
    /**
     * Upstash-Telemetry-Runtime
     * @example node@v18
     */
    runtime?: string;
};
type RedisOptions = {
    /**
     * Automatically try to deserialize the returned data from upstash using `JSON.deserialize`
     *
     * @default true
     */
    automaticDeserialization?: boolean;
    latencyLogging?: boolean;
    enableTelemetry?: boolean;
    enableAutoPipelining?: boolean;
    readYourWrites?: boolean;
};

type CacheSetting = "default" | "force-cache" | "no-cache" | "no-store" | "only-if-cached" | "reload";
type UpstashRequest = {
    path?: string[];
    /**
     * Request body will be serialized to json
     */
    body?: unknown;
    /**
     * Additional headers for the request
     */
    headers?: Record<string, string>;
    upstashSyncToken?: string;
    /**
     * Callback for handling streaming messages
     */
    onMessage?: (data: string) => void;
    /**
     * Whether this request expects a streaming response
     */
    isStreaming?: boolean;
    /**
     * Abort signal for the request
     */
    signal?: AbortSignal;
};
type UpstashResponse<TResult> = {
    result?: TResult;
    error?: string;
};
interface Requester {
    /**
     * When this flag is enabled, any subsequent commands issued by this client are guaranteed to observe the effects of all earlier writes submitted by the same client.
     */
    readYourWrites?: boolean;
    /**
     * This token is used to ensure that the client is in sync with the server. On each request, we send this token in the header, and the server will return a new token.
     */
    upstashSyncToken?: string;
    request: <TResult = unknown>(req: UpstashRequest) => Promise<UpstashResponse<TResult>>;
}
type RetryConfig = false | {
    /**
     * The number of retries to attempt before giving up.
     *
     * @default 5
     */
    retries?: number;
    /**
     * A backoff function receives the current retry count and returns a number in milliseconds to wait before retrying.
     *
     * @default
     * ```ts
     * Math.exp(retryCount) * 50
     * ```
     */
    backoff?: (retryCount: number) => number;
};
type Options$1 = {
    backend?: string;
};
type RequesterConfig = {
    /**
     * Configure the retry behaviour in case of network errors
     */
    retry?: RetryConfig;
    /**
     * Due to the nature of dynamic and custom data, it is possible to write data to redis that is not
     * valid json and will therefore cause errors when deserializing. This used to happen very
     * frequently with non-utf8 data, such as emojis.
     *
     * By default we will therefore encode the data as base64 on the server, before sending it to the
     * client. The client will then decode the base64 data and parse it as utf8.
     *
     * For very large entries, this can add a few milliseconds, so if you are sure that your data is
     * valid utf8, you can disable this behaviour by setting this option to false.
     *
     * Here's what the response body looks like:
     *
     * ```json
     * {
     *  result?: "base64-encoded",
     *  error?: string
     * }
     * ```
     *
     * @default "base64"
     */
    responseEncoding?: false | "base64";
    /**
     * Configure the cache behaviour
     * @default "no-store"
     */
    cache?: CacheSetting;
};
type HttpClientConfig = {
    headers?: Record<string, string>;
    baseUrl: string;
    options?: Options$1;
    retry?: RetryConfig;
    agent?: any;
    signal?: AbortSignal | (() => AbortSignal);
    keepAlive?: boolean;
    /**
     * When this flag is enabled, any subsequent commands issued by this client are guaranteed to observe the effects of all earlier writes submitted by the same client.
     */
    readYourWrites?: boolean;
} & RequesterConfig;

type Serialize = (data: unknown) => string | number | boolean;
type Deserialize<TResult, TData> = (result: TResult) => TData;
type CommandOptions<TResult, TData> = {
    /**
     * Custom deserializer
     */
    deserialize?: (result: TResult) => TData;
    /**
     * Automatically try to deserialize the returned data from upstash using `JSON.deserialize`
     *
     * @default true
     */
    automaticDeserialization?: boolean;
    latencyLogging?: boolean;
    /**
     * Additional headers to be sent with the request
     */
    headers?: Record<string, string>;
    /**
     * Path to append to the URL
     */
    path?: string[];
    /**
     * Options for streaming requests, mainly used for subscribe, monitor commands
     **/
    streamOptions?: {
        /**
         * Callback to be called when a message is received
         */
        onMessage?: (data: string) => void;
        /**
         * Whether the request is streaming
         */
        isStreaming?: boolean;
        /**
         * Signal to abort the request
         */
        signal?: AbortSignal;
    };
};
/**
 * Command offers default (de)serialization and the exec method to all commands.
 *
 * TData represents what the user will enter or receive,
 * TResult is the raw data returned from upstash, which may need to be transformed or parsed.
 */
declare class Command<TResult, TData> {
    readonly command: (string | number | boolean)[];
    readonly serialize: Serialize;
    readonly deserialize: Deserialize<TResult, TData>;
    protected readonly headers?: Record<string, string>;
    protected readonly path?: string[];
    protected readonly onMessage?: (data: string) => void;
    protected readonly isStreaming: boolean;
    protected readonly signal?: AbortSignal;
    /**
     * Create a new command instance.
     *
     * You can define a custom `deserialize` function. By default we try to deserialize as json.
     */
    constructor(command: (string | boolean | number | unknown)[], opts?: CommandOptions<TResult, TData>);
    /**
     * Execute the command using a client.
     */
    exec(client: Requester): Promise<TData>;
}

type ZUnionStoreCommandOptions = {
    aggregate?: "sum" | "min" | "max";
} & ({
    weight: number;
    weights?: never;
} | {
    weight?: never;
    weights: number[];
} | {
    weight?: never;
    weights?: never;
});
/**
 * @see https://redis.io/commands/zunionstore
 */
declare class ZUnionStoreCommand extends Command<number, number> {
    constructor(cmd: [destination: string, numKeys: 1, key: string, opts?: ZUnionStoreCommandOptions], cmdOpts?: CommandOptions<number, number>);
    constructor(cmd: [destination: string, numKeys: number, keys: string[], opts?: ZUnionStoreCommandOptions], cmdOpts?: CommandOptions<number, number>);
}

type ZUnionCommandOptions = {
    withScores?: boolean;
    aggregate?: "sum" | "min" | "max";
} & ({
    weight: number;
    weights?: never;
} | {
    weight?: never;
    weights: number[];
} | {
    weight?: never;
    weights?: never;
});
/**
 * @see https://redis.io/commands/zunion
 */
declare class ZUnionCommand<TData extends unknown[]> extends Command<string[], TData> {
    constructor(cmd: [numKeys: 1, key: string, opts?: ZUnionCommandOptions], cmdOpts?: CommandOptions<string[], TData>);
    constructor(cmd: [numKeys: number, keys: string[], opts?: ZUnionCommandOptions], cmdOpts?: CommandOptions<string[], TData>);
}

type ZInterStoreCommandOptions = {
    aggregate?: "sum" | "min" | "max";
} & ({
    weight: number;
    weights?: never;
} | {
    weight?: never;
    weights: number[];
} | {
    weight?: never;
    weights?: never;
});
/**
 * @see https://redis.io/commands/zInterstore
 */
declare class ZInterStoreCommand extends Command<number, number> {
    constructor(cmd: [destination: string, numKeys: 1, key: string, opts?: ZInterStoreCommandOptions], cmdOpts?: CommandOptions<number, number>);
    constructor(cmd: [destination: string, numKeys: number, keys: string[], opts?: ZInterStoreCommandOptions], cmdOpts?: CommandOptions<number, number>);
}

type Type = "string" | "list" | "set" | "zset" | "hash" | "none";
/**
 * @see https://redis.io/commands/type
 */
declare class TypeCommand extends Command<Type, Type> {
    constructor(cmd: [key: string], opts?: CommandOptions<Type, Type>);
}

type ScriptFlushCommandOptions = {
    sync: true;
    async?: never;
} | {
    sync?: never;
    async: true;
};
/**
 * @see https://redis.io/commands/script-flush
 */
declare class ScriptFlushCommand extends Command<"OK", "OK"> {
    constructor([opts]: [opts?: ScriptFlushCommandOptions], cmdOpts?: CommandOptions<"OK", "OK">);
}

type GeoAddCommandOptions = {
    nx?: boolean;
    xx?: never;
} | ({
    nx?: never;
    xx?: boolean;
} & {
    ch?: boolean;
});
type GeoMember<TMemberType> = {
    latitude: number;
    longitude: number;
    member: TMemberType;
};
/**
 * @see https://redis.io/commands/geoadd
 */
declare class GeoAddCommand<TMemberType = string> extends Command<number | null, number | null> {
    constructor([key, arg1, ...arg2]: [
        string,
        GeoMember<TMemberType> | GeoAddCommandOptions,
        ...GeoMember<TMemberType>[]
    ], opts?: CommandOptions<number | null, number | null>);
}

type ExpireOption = "NX" | "nx" | "XX" | "xx" | "GT" | "gt" | "LT" | "lt";
declare class ExpireCommand extends Command<"0" | "1", 0 | 1> {
    constructor(cmd: [key: string, seconds: number, option?: ExpireOption], opts?: CommandOptions<"0" | "1", 0 | 1>);
}

/**
 * @see https://redis.io/commands/append
 */
declare class AppendCommand extends Command<number, number> {
    constructor(cmd: [key: string, value: string], opts?: CommandOptions<number, number>);
}

/**
 * @see https://redis.io/commands/bitcount
 */
declare class BitCountCommand extends Command<number, number> {
    constructor(cmd: [key: string, start?: never, end?: never], opts?: CommandOptions<number, number>);
    constructor(cmd: [key: string, start: number, end: number], opts?: CommandOptions<number, number>);
}

type SubCommandArgs<TRest extends unknown[] = []> = [
    encoding: string,
    offset: number | string,
    ...rest: TRest
];
/**
 * @see https://redis.io/commands/bitfield
 */
declare class BitFieldCommand<T = Promise<number[]>> {
    private client;
    private opts?;
    private execOperation;
    private command;
    constructor(args: [key: string], client: Requester, opts?: CommandOptions<number[], number[]> | undefined, execOperation?: (command: Command<number[], number[]>) => T);
    private chain;
    get(...args: SubCommandArgs): this;
    set(...args: SubCommandArgs<[value: number]>): this;
    incrby(...args: SubCommandArgs<[increment: number]>): this;
    overflow(overflow: "WRAP" | "SAT" | "FAIL"): this;
    exec(): T;
}

/**
 * @see https://redis.io/commands/bitop
 */
declare class BitOpCommand extends Command<number, number> {
    constructor(cmd: [op: "and" | "or" | "xor", destinationKey: string, ...sourceKeys: string[]], opts?: CommandOptions<number, number>);
    constructor(cmd: [op: "not", destinationKey: string, sourceKey: string], opts?: CommandOptions<number, number>);
}

/**
 * @see https://redis.io/commands/bitpos
 */
declare class BitPosCommand extends Command<number, number> {
    constructor(cmd: [key: string, bit: 0 | 1, start?: number, end?: number], opts?: CommandOptions<number, number>);
}

/**
 * @see https://redis.io/commands/copy
 */
declare class CopyCommand extends Command<number, "COPIED" | "NOT_COPIED"> {
    constructor([key, destinationKey, opts]: [key: string, destinationKey: string, opts?: {
        replace: boolean;
    }], commandOptions?: CommandOptions<number, "COPIED" | "NOT_COPIED">);
}

/**
 * @see https://redis.io/commands/dbsize
 */
declare class DBSizeCommand extends Command<number, number> {
    constructor(opts?: CommandOptions<number, number>);
}

/**
 * @see https://redis.io/commands/decr
 */
declare class DecrCommand extends Command<number, number> {
    constructor(cmd: [key: string], opts?: CommandOptions<number, number>);
}

/**
 * @see https://redis.io/commands/decrby
 */
declare class DecrByCommand extends Command<number, number> {
    constructor(cmd: [key: string, decrement: number], opts?: CommandOptions<number, number>);
}

/**
 * @see https://redis.io/commands/del
 */
declare class DelCommand extends Command<number, number> {
    constructor(cmd: [...keys: string[]], opts?: CommandOptions<number, number>);
}

/**
 * @see https://redis.io/commands/echo
 */
declare class EchoCommand extends Command<string, string> {
    constructor(cmd: [message: string], opts?: CommandOptions<string, string>);
}

/**
 * @see https://redis.io/commands/eval_ro
 */
declare class EvalROCommand<TArgs extends unknown[], TData> extends Command<unknown, TData> {
    constructor([script, keys, args]: [script: string, keys: string[], args: TArgs], opts?: CommandOptions<unknown, TData>);
}

/**
 * @see https://redis.io/commands/eval
 */
declare class EvalCommand<TArgs extends unknown[], TData> extends Command<unknown, TData> {
    constructor([script, keys, args]: [script: string, keys: string[], args: TArgs], opts?: CommandOptions<unknown, TData>);
}

/**
 * @see https://redis.io/commands/evalsha_ro
 */
declare class EvalshaROCommand<TArgs extends unknown[], TData> extends Command<unknown, TData> {
    constructor([sha, keys, args]: [sha: string, keys: string[], args?: TArgs], opts?: CommandOptions<unknown, TData>);
}

/**
 * @see https://redis.io/commands/evalsha
 */
declare class EvalshaCommand<TArgs extends unknown[], TData> extends Command<unknown, TData> {
    constructor([sha, keys, args]: [sha: string, keys: string[], args?: TArgs], opts?: CommandOptions<unknown, TData>);
}

/**
 * @see https://redis.io/commands/exists
 */
declare class ExistsCommand extends Command<number, number> {
    constructor(cmd: [...keys: string[]], opts?: CommandOptions<number, number>);
}

/**
 * @see https://redis.io/commands/expireat
 */
declare class ExpireAtCommand extends Command<"0" | "1", 0 | 1> {
    constructor(cmd: [key: string, unix: number, option?: ExpireOption], opts?: CommandOptions<"0" | "1", 0 | 1>);
}

/**
 * @see https://redis.io/commands/flushall
 */
declare class FlushAllCommand extends Command<"OK", "OK"> {
    constructor(args?: [{
        async?: boolean;
    }], opts?: CommandOptions<"OK", "OK">);
}

/**
 * @see https://redis.io/commands/flushdb
 */
declare class FlushDBCommand extends Command<"OK", "OK"> {
    constructor([opts]: [opts?: {
        async?: boolean;
    }], cmdOpts?: CommandOptions<"OK", "OK">);
}

/**
 * @see https://redis.io/commands/geodist
 */
declare class GeoDistCommand<TMemberType = string> extends Command<number | null, number | null> {
    constructor([key, member1, member2, unit]: [
        key: string,
        member1: TMemberType,
        member2: TMemberType,
        unit?: "M" | "KM" | "FT" | "MI"
    ], opts?: CommandOptions<number | null, number | null>);
}

/**
 * @see https://redis.io/commands/geohash
 */
declare class GeoHashCommand<TMember = string> extends Command<(string | null)[], (string | null)[]> {
    constructor(cmd: [string, ...TMember[]], opts?: CommandOptions<(string | null)[], (string | null)[]>);
}

type Coordinates = {
    lng: number;
    lat: number;
};
/**
 * @see https://redis.io/commands/geopos
 */
declare class GeoPosCommand<TMember = string> extends Command<(string | null)[][], Coordinates[]> {
    constructor(cmd: [string, ...(TMember[] | TMember[])], opts?: CommandOptions<(string | null)[][], Coordinates[]>);
}

type RadiusOptions$1 = "M" | "KM" | "FT" | "MI";
type CenterPoint$1<TMemberType> = {
    type: "FROMMEMBER" | "frommember";
    member: TMemberType;
} | {
    type: "FROMLONLAT" | "fromlonlat";
    coordinate: {
        lon: number;
        lat: number;
    };
};
type Shape$1 = {
    type: "BYRADIUS" | "byradius";
    radius: number;
    radiusType: RadiusOptions$1;
} | {
    type: "BYBOX" | "bybox";
    rect: {
        width: number;
        height: number;
    };
    rectType: RadiusOptions$1;
};
type GeoSearchCommandOptions$1 = {
    count?: {
        limit: number;
        any?: boolean;
    };
    withCoord?: boolean;
    withDist?: boolean;
    withHash?: boolean;
};
type OptionMappings = {
    withHash: "hash";
    withCoord: "coord";
    withDist: "dist";
};
type GeoSearchOptions<TOptions> = {
    [K in keyof TOptions as K extends keyof OptionMappings ? OptionMappings[K] : never]: K extends "withHash" ? string : K extends "withCoord" ? {
        long: number;
        lat: number;
    } : K extends "withDist" ? number : never;
};
type GeoSearchResponse<TOptions, TMemberType> = ({
    member: TMemberType;
} & GeoSearchOptions<TOptions>)[];
/**
 * @see https://redis.io/commands/geosearch
 */
declare class GeoSearchCommand<TMemberType = string, TOptions extends GeoSearchCommandOptions$1 = GeoSearchCommandOptions$1> extends Command<any[] | any[][], GeoSearchResponse<TOptions, TMemberType>> {
    constructor([key, centerPoint, shape, order, opts]: [
        key: string,
        centerPoint: CenterPoint$1<TMemberType>,
        shape: Shape$1,
        order: "ASC" | "DESC" | "asc" | "desc",
        opts?: TOptions
    ], commandOptions?: CommandOptions<any[] | any[][], GeoSearchResponse<TOptions, TMemberType>>);
}

type RadiusOptions = "M" | "KM" | "FT" | "MI";
type CenterPoint<TMemberType> = {
    type: "FROMMEMBER" | "frommember";
    member: TMemberType;
} | {
    type: "FROMLONLAT" | "fromlonlat";
    coordinate: {
        lon: number;
        lat: number;
    };
};
type Shape = {
    type: "BYRADIUS" | "byradius";
    radius: number;
    radiusType: RadiusOptions;
} | {
    type: "BYBOX" | "bybox";
    rect: {
        width: number;
        height: number;
    };
    rectType: RadiusOptions;
};
type GeoSearchCommandOptions = {
    count?: {
        limit: number;
        any?: boolean;
    };
    storeDist?: boolean;
};
/**
 * @see https://redis.io/commands/geosearchstore
 */
declare class GeoSearchStoreCommand<TMemberType = string, TOptions extends GeoSearchCommandOptions = GeoSearchCommandOptions> extends Command<any[] | any[][], number> {
    constructor([destination, key, centerPoint, shape, order, opts]: [
        destination: string,
        key: string,
        centerPoint: CenterPoint<TMemberType>,
        shape: Shape,
        order: "ASC" | "DESC" | "asc" | "desc",
        opts?: TOptions
    ], commandOptions?: CommandOptions<any[] | any[][], number>);
}

/**
 * @see https://redis.io/commands/get
 */
declare class GetCommand<TData = string> extends Command<unknown | null, TData | null> {
    constructor(cmd: [key: string], opts?: CommandOptions<unknown | null, TData | null>);
}

/**
 * @see https://redis.io/commands/getbit
 */
declare class GetBitCommand extends Command<"0" | "1", 0 | 1> {
    constructor(cmd: [key: string, offset: number], opts?: CommandOptions<"0" | "1", 0 | 1>);
}

/**
 * @see https://redis.io/commands/getdel
 */
declare class GetDelCommand<TData = string> extends Command<unknown | null, TData | null> {
    constructor(cmd: [key: string], opts?: CommandOptions<unknown | null, TData | null>);
}

type GetExCommandOptions = {
    ex: number;
    px?: never;
    exat?: never;
    pxat?: never;
    persist?: never;
} | {
    ex?: never;
    px: number;
    exat?: never;
    pxat?: never;
    persist?: never;
} | {
    ex?: never;
    px?: never;
    exat: number;
    pxat?: never;
    persist?: never;
} | {
    ex?: never;
    px?: never;
    exat?: never;
    pxat: number;
    persist?: never;
} | {
    ex?: never;
    px?: never;
    exat?: never;
    pxat?: never;
    persist: true;
} | {
    ex?: never;
    px?: never;
    exat?: never;
    pxat?: never;
    persist?: never;
};
/**
 * @see https://redis.io/commands/getex
 */
declare class GetExCommand<TData = string> extends Command<unknown | null, TData | null> {
    constructor([key, opts]: [key: string, opts?: GetExCommandOptions], cmdOpts?: CommandOptions<unknown | null, TData | null>);
}

/**
 * @see https://redis.io/commands/getrange
 */
declare class GetRangeCommand extends Command<string, string> {
    constructor(cmd: [key: string, start: number, end: number], opts?: CommandOptions<string, string>);
}

/**
 * @see https://redis.io/commands/getset
 */
declare class GetSetCommand<TData = string> extends Command<unknown | null, TData | null> {
    constructor(cmd: [key: string, value: TData], opts?: CommandOptions<unknown | null, TData | null>);
}

/**
 * @see https://redis.io/commands/hdel
 */
declare class HDelCommand extends Command<"0" | "1", 0 | 1> {
    constructor(cmd: [key: string, ...fields: string[]], opts?: CommandOptions<"0" | "1", 0 | 1>);
}

/**
 * @see https://redis.io/commands/hexists
 */
declare class HExistsCommand extends Command<number, number> {
    constructor(cmd: [key: string, field: string], opts?: CommandOptions<number, number>);
}

declare class HExpireCommand extends Command<(-2 | 0 | 1 | 2)[], (-2 | 0 | 1 | 2)[]> {
    constructor(cmd: [
        key: string,
        fields: (string | number) | (string | number)[],
        seconds: number,
        option?: ExpireOption
    ], opts?: CommandOptions<(-2 | 0 | 1 | 2)[], (-2 | 0 | 1 | 2)[]>);
}

declare class HExpireAtCommand extends Command<(-2 | 0 | 1 | 2)[], (-2 | 0 | 1 | 2)[]> {
    constructor(cmd: [
        key: string,
        fields: (string | number) | (string | number)[],
        timestamp: number,
        option?: ExpireOption
    ], opts?: CommandOptions<(-2 | 0 | 1 | 2)[], (-2 | 0 | 1 | 2)[]>);
}

declare class HExpireTimeCommand extends Command<number[], number[]> {
    constructor(cmd: [key: string, fields: (string | number) | (string | number)[]], opts?: CommandOptions<number[], number[]>);
}

declare class HPersistCommand extends Command<(-2 | -1 | 1)[], (-2 | -1 | 1)[]> {
    constructor(cmd: [key: string, fields: (string | number) | (string | number)[]], opts?: CommandOptions<(-2 | -1 | 1)[], (-2 | -1 | 1)[]>);
}

declare class HPExpireCommand extends Command<(-2 | 0 | 1 | 2)[], (-2 | 0 | 1 | 2)[]> {
    constructor(cmd: [
        key: string,
        fields: (string | number) | (string | number)[],
        milliseconds: number,
        option?: ExpireOption
    ], opts?: CommandOptions<(-2 | 0 | 1 | 2)[], (-2 | 0 | 1 | 2)[]>);
}

declare class HPExpireAtCommand extends Command<(-2 | 0 | 1 | 2)[], (-2 | 0 | 1 | 2)[]> {
    constructor(cmd: [
        key: string,
        fields: (string | number) | (string | number)[],
        timestamp: number,
        option?: ExpireOption
    ], opts?: CommandOptions<(-2 | 0 | 1 | 2)[], (-2 | 0 | 1 | 2)[]>);
}

declare class HPExpireTimeCommand extends Command<number[], number[]> {
    constructor(cmd: [key: string, fields: (string | number) | (string | number)[]], opts?: CommandOptions<number[], number[]>);
}

declare class HPTtlCommand extends Command<number[], number[]> {
    constructor(cmd: [key: string, fields: (string | number) | (string | number)[]], opts?: CommandOptions<number[], number[]>);
}

/**
 * @see https://redis.io/commands/hget
 */
declare class HGetCommand<TData> extends Command<unknown | null, TData | null> {
    constructor(cmd: [key: string, field: string], opts?: CommandOptions<unknown | null, TData | null>);
}

/**
 * @see https://redis.io/commands/hgetall
 */
declare class HGetAllCommand<TData extends Record<string, unknown>> extends Command<unknown | null, TData | null> {
    constructor(cmd: [key: string], opts?: CommandOptions<unknown | null, TData | null>);
}

/**
 * @see https://redis.io/commands/hincrby
 */
declare class HIncrByCommand extends Command<number, number> {
    constructor(cmd: [key: string, field: string, increment: number], opts?: CommandOptions<number, number>);
}

/**
 * @see https://redis.io/commands/hincrbyfloat
 */
declare class HIncrByFloatCommand extends Command<number, number> {
    constructor(cmd: [key: string, field: string, increment: number], opts?: CommandOptions<number, number>);
}

/**
 * @see https://redis.io/commands/hkeys
 */
declare class HKeysCommand extends Command<string[], string[]> {
    constructor([key]: [key: string], opts?: CommandOptions<string[], string[]>);
}

/**
 * @see https://redis.io/commands/hlen
 */
declare class HLenCommand extends Command<number, number> {
    constructor(cmd: [key: string], opts?: CommandOptions<number, number>);
}

/**
 * hmget returns an object of all requested fields from a hash
 * The field values are returned as an object like this:
 * ```ts
 * {[fieldName: string]: T | null}
 * ```
 *
 * In case the hash does not exist or all fields are empty `null` is returned
 *
 * @see https://redis.io/commands/hmget
 */
declare class HMGetCommand<TData extends Record<string, unknown>> extends Command<(string | null)[], TData | null> {
    constructor([key, ...fields]: [key: string, ...fields: string[]], opts?: CommandOptions<(string | null)[], TData | null>);
}

/**
 * @see https://redis.io/commands/hmset
 */
declare class HMSetCommand<TData> extends Command<"OK", "OK"> {
    constructor([key, kv]: [key: string, kv: Record<string, TData>], opts?: CommandOptions<"OK", "OK">);
}

/**
 * @see https://redis.io/commands/hrandfield
 */
declare class HRandFieldCommand<TData extends string | string[] | Record<string, unknown>> extends Command<string | string[], TData> {
    constructor(cmd: [key: string], opts?: CommandOptions<string, string>);
    constructor(cmd: [key: string, count: number], opts?: CommandOptions<string[], string[]>);
    constructor(cmd: [key: string, count: number, withValues: boolean], opts?: CommandOptions<string[], Partial<TData>>);
}

type ScanCommandOptionsStandard = {
    match?: string;
    count?: number;
    type?: string;
    withType?: false;
};
type ScanCommandOptionsWithType = {
    match?: string;
    count?: number;
    /**
     * Includes types of each key in the result
     *
     * @example
     * ```typescript
     * await redis.scan("0", { withType: true })
     * // ["0", [{ key: "key1", type: "string" }, { key: "key2", type: "list" }]]
     * ```
     */
    withType: true;
};
type ScanCommandOptions = ScanCommandOptionsStandard | ScanCommandOptionsWithType;
type ScanResultStandard = [string, string[]];
type ScanResultWithType = [string, {
    key: string;
    type: string;
}[]];
/**
 * @see https://redis.io/commands/scan
 */
declare class ScanCommand<TData = ScanResultStandard> extends Command<[string, string[]], TData> {
    constructor([cursor, opts]: [cursor: string | number, opts?: ScanCommandOptions], cmdOpts?: CommandOptions<[string, string[]], TData>);
}

/**
 * @see https://redis.io/commands/hscan
 */
declare class HScanCommand extends Command<[
    string,
    (string | number)[]
], [
    string,
    (string | number)[]
]> {
    constructor([key, cursor, cmdOpts]: [key: string, cursor: string | number, cmdOpts?: ScanCommandOptions], opts?: CommandOptions<[string, (string | number)[]], [string, (string | number)[]]>);
}

/**
 * @see https://redis.io/commands/hset
 */
declare class HSetCommand<TData> extends Command<number, number> {
    constructor([key, kv]: [key: string, kv: Record<string, TData>], opts?: CommandOptions<number, number>);
}

/**
 * @see https://redis.io/commands/hsetnx
 */
declare class HSetNXCommand<TData> extends Command<"0" | "1", 0 | 1> {
    constructor(cmd: [key: string, field: string, value: TData], opts?: CommandOptions<"0" | "1", 0 | 1>);
}

/**
 * @see https://redis.io/commands/hstrlen
 */
declare class HStrLenCommand extends Command<number, number> {
    constructor(cmd: [key: string, field: string], opts?: CommandOptions<number, number>);
}

declare class HTtlCommand extends Command<number[], number[]> {
    constructor(cmd: [key: string, fields: (string | number) | (string | number)[]], opts?: CommandOptions<number[], number[]>);
}

/**
 * @see https://redis.io/commands/hvals
 */
declare class HValsCommand<TData extends unknown[]> extends Command<unknown[], TData> {
    constructor(cmd: [key: string], opts?: CommandOptions<unknown[], TData>);
}

/**
 * @see https://redis.io/commands/incr
 */
declare class IncrCommand extends Command<number, number> {
    constructor(cmd: [key: string], opts?: CommandOptions<number, number>);
}

/**
 * @see https://redis.io/commands/incrby
 */
declare class IncrByCommand extends Command<number, number> {
    constructor(cmd: [key: string, value: number], opts?: CommandOptions<number, number>);
}

/**
 * @see https://redis.io/commands/incrbyfloat
 */
declare class IncrByFloatCommand extends Command<number, number> {
    constructor(cmd: [key: string, value: number], opts?: CommandOptions<number, number>);
}

/**
 * @see https://redis.io/commands/json.arrappend
 */
declare class JsonArrAppendCommand<TData extends unknown[]> extends Command<(null | string)[], (null | number)[]> {
    constructor(cmd: [key: string, path: string, ...values: TData], opts?: CommandOptions<(null | string)[], (null | number)[]>);
}

/**
 * @see https://redis.io/commands/json.arrindex
 */
declare class JsonArrIndexCommand<TValue> extends Command<(null | string)[], (null | number)[]> {
    constructor(cmd: [key: string, path: string, value: TValue, start?: number, stop?: number], opts?: CommandOptions<(null | string)[], (null | number)[]>);
}

/**
 * @see https://redis.io/commands/json.arrinsert
 */
declare class JsonArrInsertCommand<TData extends unknown[]> extends Command<(null | string)[], (null | number)[]> {
    constructor(cmd: [key: string, path: string, index: number, ...values: TData], opts?: CommandOptions<(null | string)[], (null | number)[]>);
}

/**
 * @see https://redis.io/commands/json.arrlen
 */
declare class JsonArrLenCommand extends Command<(null | string)[], (null | number)[]> {
    constructor(cmd: [key: string, path?: string], opts?: CommandOptions<(null | string)[], (null | number)[]>);
}

/**
 * @see https://redis.io/commands/json.arrpop
 */
declare class JsonArrPopCommand<TData> extends Command<(null | string)[], (TData | null)[]> {
    constructor(cmd: [key: string, path?: string, index?: number], opts?: CommandOptions<(null | string)[], (TData | null)[]>);
}

/**
 * @see https://redis.io/commands/json.arrtrim
 */
declare class JsonArrTrimCommand extends Command<(null | string)[], (null | number)[]> {
    constructor(cmd: [key: string, path?: string, start?: number, stop?: number], opts?: CommandOptions<(null | string)[], (null | number)[]>);
}

/**
 * @see https://redis.io/commands/json.clear
 */
declare class JsonClearCommand extends Command<number, number> {
    constructor(cmd: [key: string, path?: string], opts?: CommandOptions<number, number>);
}

/**
 * @see https://redis.io/commands/json.del
 */
declare class JsonDelCommand extends Command<number, number> {
    constructor(cmd: [key: string, path?: string], opts?: CommandOptions<number, number>);
}

/**
 * @see https://redis.io/commands/json.forget
 */
declare class JsonForgetCommand extends Command<number, number> {
    constructor(cmd: [key: string, path?: string], opts?: CommandOptions<number, number>);
}

/**
 * @see https://redis.io/commands/json.get
 */
declare class JsonGetCommand<TData extends (unknown | Record<string, unknown>) | (unknown | Record<string, unknown>)[]> extends Command<TData | null, TData | null> {
    constructor(cmd: [
        key: string,
        opts?: {
            indent?: string;
            newline?: string;
            space?: string;
        },
        ...path: string[]
    ] | [key: string, ...path: string[]], opts?: CommandOptions<TData | null, TData | null>);
}

/**
 * @see https://redis.io/commands/json.merge
 */
declare class JsonMergeCommand<TData extends string | number | Record<string, unknown> | Array<unknown>> extends Command<"OK" | null, "OK" | null> {
    constructor(cmd: [key: string, path: string, value: TData], opts?: CommandOptions<"OK" | null, "OK" | null>);
}

/**
 * @see https://redis.io/commands/json.mget
 */
declare class JsonMGetCommand<TData = unknown[]> extends Command<TData, TData> {
    constructor(cmd: [keys: string[], path: string], opts?: CommandOptions<TData, TData>);
}

/**
 * @see https://redis.io/commands/json.mset
 */
declare class JsonMSetCommand<TData extends number | string | boolean | Record<string, unknown> | (number | string | boolean | Record<string, unknown>)[]> extends Command<"OK" | null, "OK" | null> {
    constructor(cmd: {
        key: string;
        path: string;
        value: TData;
    }[], opts?: CommandOptions<"OK" | null, "OK" | null>);
}

/**
 * @see https://redis.io/commands/json.numincrby
 */
declare class JsonNumIncrByCommand extends Command<(null | string)[], (null | number)[]> {
    constructor(cmd: [key: string, path: string, value: number], opts?: CommandOptions<(null | string)[], (null | number)[]>);
}

/**
 * @see https://redis.io/commands/json.nummultby
 */
declare class JsonNumMultByCommand extends Command<(null | string)[], (null | number)[]> {
    constructor(cmd: [key: string, path: string, value: number], opts?: CommandOptions<(null | string)[], (null | number)[]>);
}

/**
 * @see https://redis.io/commands/json.objkeys
 */
declare class JsonObjKeysCommand extends Command<(string[] | null)[], (string[] | null)[]> {
    constructor(cmd: [key: string, path?: string], opts?: CommandOptions<(string[] | null)[], (string[] | null)[]>);
}

/**
 * @see https://redis.io/commands/json.objlen
 */
declare class JsonObjLenCommand extends Command<(number | null)[], (number | null)[]> {
    constructor(cmd: [key: string, path?: string], opts?: CommandOptions<(number | null)[], (number | null)[]>);
}

/**
 * @see https://redis.io/commands/json.resp
 */
declare class JsonRespCommand<TData extends unknown[]> extends Command<TData, TData> {
    constructor(cmd: [key: string, path?: string], opts?: CommandOptions<TData, TData>);
}

/**
 * @see https://redis.io/commands/json.set
 */
declare class JsonSetCommand<TData extends number | string | boolean | Record<string, unknown> | (number | string | boolean | Record<string, unknown>)[]> extends Command<"OK" | null, "OK" | null> {
    constructor(cmd: [
        key: string,
        path: string,
        value: TData,
        opts?: {
            nx: true;
            xx?: never;
        } | {
            nx?: never;
            xx: true;
        }
    ], opts?: CommandOptions<"OK" | null, "OK" | null>);
}

/**
 * @see https://redis.io/commands/json.strappend
 */
declare class JsonStrAppendCommand extends Command<(null | string)[], (null | number)[]> {
    constructor(cmd: [key: string, path: string, value: string], opts?: CommandOptions<(null | string)[], (null | number)[]>);
}

/**
 * @see https://redis.io/commands/json.strlen
 */
declare class JsonStrLenCommand extends Command<(number | null)[], (number | null)[]> {
    constructor(cmd: [key: string, path?: string], opts?: CommandOptions<(number | null)[], (number | null)[]>);
}

/**
 * @see https://redis.io/commands/json.toggle
 */
declare class JsonToggleCommand extends Command<number[], number[]> {
    constructor(cmd: [key: string, path: string], opts?: CommandOptions<number[], number[]>);
}

/**
 * @see https://redis.io/commands/json.type
 */
declare class JsonTypeCommand extends Command<string[], string[]> {
    constructor(cmd: [key: string, path?: string], opts?: CommandOptions<string[], string[]>);
}

/**
 * @see https://redis.io/commands/keys
 */
declare class KeysCommand extends Command<string[], string[]> {
    constructor(cmd: [pattern: string], opts?: CommandOptions<string[], string[]>);
}

declare class LIndexCommand<TData = string> extends Command<unknown | null, TData | null> {
    constructor(cmd: [key: string, index: number], opts?: CommandOptions<unknown | null, TData | null>);
}

declare class LInsertCommand<TData = string> extends Command<number, number> {
    constructor(cmd: [key: string, direction: "before" | "after", pivot: TData, value: TData], opts?: CommandOptions<number, number>);
}

/**
 * @see https://redis.io/commands/llen
 */
declare class LLenCommand extends Command<number, number> {
    constructor(cmd: [key: string], opts?: CommandOptions<number, number>);
}

/**
 * @see https://redis.io/commands/lmove
 */
declare class LMoveCommand<TData = string> extends Command<TData, TData> {
    constructor(cmd: [
        source: string,
        destination: string,
        whereFrom: "left" | "right",
        whereTo: "left" | "right"
    ], opts?: CommandOptions<TData, TData>);
}

/**
 * @see https://redis.io/commands/lpop
 */
declare class LPopCommand<TData = string> extends Command<unknown | null, TData | null> {
    constructor(cmd: [key: string, count?: number], opts?: CommandOptions<unknown | null, TData | null>);
}

/**
 * @see https://redis.io/commands/lpush
 */
declare class LPushCommand<TData = string> extends Command<number, number> {
    constructor(cmd: [key: string, ...elements: TData[]], opts?: CommandOptions<number, number>);
}

/**
 * @see https://redis.io/commands/lpushx
 */
declare class LPushXCommand<TData> extends Command<number, number> {
    constructor(cmd: [key: string, ...elements: TData[]], opts?: CommandOptions<number, number>);
}

declare class LRangeCommand<TData = string> extends Command<unknown[], TData[]> {
    constructor(cmd: [key: string, start: number, end: number], opts?: CommandOptions<unknown[], TData[]>);
}

declare class LRemCommand<TData> extends Command<number, number> {
    constructor(cmd: [key: string, count: number, value: TData], opts?: CommandOptions<number, number>);
}

declare class LSetCommand<TData = string> extends Command<"OK", "OK"> {
    constructor(cmd: [key: string, index: number, data: TData], opts?: CommandOptions<"OK", "OK">);
}

declare class LTrimCommand extends Command<"OK", "OK"> {
    constructor(cmd: [key: string, start: number, end: number], opts?: CommandOptions<"OK", "OK">);
}

/**
 * @see https://redis.io/commands/mget
 */
declare class MGetCommand<TData extends unknown[]> extends Command<(string | null)[], TData> {
    constructor(cmd: [string[]] | [...string[]], opts?: CommandOptions<(string | null)[], TData>);
}

/**
 * @see https://redis.io/commands/mset
 */
declare class MSetCommand<TData> extends Command<"OK", "OK"> {
    constructor([kv]: [kv: Record<string, TData>], opts?: CommandOptions<"OK", "OK">);
}

/**
 * @see https://redis.io/commands/msetnx
 */
declare class MSetNXCommand<TData = string> extends Command<number, number> {
    constructor([kv]: [kv: Record<string, TData>], opts?: CommandOptions<number, number>);
}

/**
 * @see https://redis.io/commands/persist
 */
declare class PersistCommand extends Command<"0" | "1", 0 | 1> {
    constructor(cmd: [key: string], opts?: CommandOptions<"0" | "1", 0 | 1>);
}

/**
 * @see https://redis.io/commands/pexpire
 */
declare class PExpireCommand extends Command<"0" | "1", 0 | 1> {
    constructor(cmd: [key: string, milliseconds: number, option?: ExpireOption], opts?: CommandOptions<"0" | "1", 0 | 1>);
}

/**
 * @see https://redis.io/commands/pexpireat
 */
declare class PExpireAtCommand extends Command<"0" | "1", 0 | 1> {
    constructor(cmd: [key: string, unix: number, option?: ExpireOption], opts?: CommandOptions<"0" | "1", 0 | 1>);
}

/**
 * @see https://redis.io/commands/ping
 */
declare class PingCommand extends Command<string | "PONG", string | "PONG"> {
    constructor(cmd?: [message?: string], opts?: CommandOptions<string | "PONG", string | "PONG">);
}

/**
 * @see https://redis.io/commands/psetex
 */
declare class PSetEXCommand<TData = string> extends Command<string, string> {
    constructor(cmd: [key: string, ttl: number, value: TData], opts?: CommandOptions<string, string>);
}

/**
 * @see https://redis.io/commands/pttl
 */
declare class PTtlCommand extends Command<number, number> {
    constructor(cmd: [key: string], opts?: CommandOptions<number, number>);
}

/**
 * @see https://redis.io/commands/publish
 */
declare class PublishCommand<TMessage = unknown> extends Command<number, number> {
    constructor(cmd: [channel: string, message: TMessage], opts?: CommandOptions<number, number>);
}

/**
 * @see https://redis.io/commands/randomkey
 */
declare class RandomKeyCommand extends Command<string | null, string | null> {
    constructor(opts?: CommandOptions<string | null, string | null>);
}

/**
 * @see https://redis.io/commands/rename
 */
declare class RenameCommand extends Command<"OK", "OK"> {
    constructor(cmd: [source: string, destination: string], opts?: CommandOptions<"OK", "OK">);
}

/**
 * @see https://redis.io/commands/renamenx
 */
declare class RenameNXCommand extends Command<"0" | "1", 0 | 1> {
    constructor(cmd: [source: string, destination: string], opts?: CommandOptions<"0" | "1", 0 | 1>);
}

/**
 * @see https://redis.io/commands/rpop
 */
declare class RPopCommand<TData extends unknown | unknown[] = string> extends Command<unknown | null, TData | null> {
    constructor(cmd: [key: string, count?: number], opts?: CommandOptions<unknown | null, TData | null>);
}

/**
 * @see https://redis.io/commands/rpush
 */
declare class RPushCommand<TData = string> extends Command<number, number> {
    constructor(cmd: [key: string, ...elements: TData[]], opts?: CommandOptions<number, number>);
}

/**
 * @see https://redis.io/commands/rpushx
 */
declare class RPushXCommand<TData = string> extends Command<number, number> {
    constructor(cmd: [key: string, ...elements: TData[]], opts?: CommandOptions<number, number>);
}

/**
 * @see https://redis.io/commands/sadd
 */
declare class SAddCommand<TData = string> extends Command<number, number> {
    constructor(cmd: [key: string, member: TData, ...members: TData[]], opts?: CommandOptions<number, number>);
}

/**
 * @see https://redis.io/commands/scard
 */
declare class SCardCommand extends Command<number, number> {
    constructor(cmd: [key: string], opts?: CommandOptions<number, number>);
}

/**
 * @see https://redis.io/commands/script-exists
 */
declare class ScriptExistsCommand<T extends string[]> extends Command<string[], number[]> {
    constructor(hashes: T, opts?: CommandOptions<string[], number[]>);
}

/**
 * @see https://redis.io/commands/script-load
 */
declare class ScriptLoadCommand extends Command<string, string> {
    constructor(args: [script: string], opts?: CommandOptions<string, string>);
}

/**
 * @see https://redis.io/commands/sdiff
 */
declare class SDiffCommand<TData> extends Command<unknown[], TData[]> {
    constructor(cmd: [key: string, ...keys: string[]], opts?: CommandOptions<unknown[], TData[]>);
}

/**
 * @see https://redis.io/commands/sdiffstore
 */
declare class SDiffStoreCommand extends Command<number, number> {
    constructor(cmd: [destination: string, ...keys: string[]], opts?: CommandOptions<number, number>);
}

type SetCommandOptions = {
    get?: boolean;
} & ({
    ex: number;
    px?: never;
    exat?: never;
    pxat?: never;
    keepTtl?: never;
} | {
    ex?: never;
    px: number;
    exat?: never;
    pxat?: never;
    keepTtl?: never;
} | {
    ex?: never;
    px?: never;
    exat: number;
    pxat?: never;
    keepTtl?: never;
} | {
    ex?: never;
    px?: never;
    exat?: never;
    pxat: number;
    keepTtl?: never;
} | {
    ex?: never;
    px?: never;
    exat?: never;
    pxat?: never;
    keepTtl: true;
} | {
    ex?: never;
    px?: never;
    exat?: never;
    pxat?: never;
    keepTtl?: never;
}) & ({
    nx: true;
    xx?: never;
} | {
    xx: true;
    nx?: never;
} | {
    xx?: never;
    nx?: never;
});
/**
 * @see https://redis.io/commands/set
 */
declare class SetCommand<TData, TResult = TData | "OK" | null> extends Command<TResult, TData | "OK" | null> {
    constructor([key, value, opts]: [key: string, value: TData, opts?: SetCommandOptions], cmdOpts?: CommandOptions<TResult, TData>);
}

/**
 * @see https://redis.io/commands/setbit
 */
declare class SetBitCommand extends Command<"0" | "1", 0 | 1> {
    constructor(cmd: [key: string, offset: number, value: 0 | 1], opts?: CommandOptions<"0" | "1", 0 | 1>);
}

/**
 * @see https://redis.io/commands/setex
 */
declare class SetExCommand<TData = string> extends Command<"OK", "OK"> {
    constructor(cmd: [key: string, ttl: number, value: TData], opts?: CommandOptions<"OK", "OK">);
}

/**
 * @see https://redis.io/commands/setnx
 */
declare class SetNxCommand<TData = string> extends Command<number, number> {
    constructor(cmd: [key: string, value: TData], opts?: CommandOptions<number, number>);
}

/**
 * @see https://redis.io/commands/setrange
 */
declare class SetRangeCommand extends Command<number, number> {
    constructor(cmd: [key: string, offset: number, value: string], opts?: CommandOptions<number, number>);
}

/**
 * @see https://redis.io/commands/sinter
 */
declare class SInterCommand<TData = string> extends Command<unknown[], TData[]> {
    constructor(cmd: [key: string, ...keys: string[]], opts?: CommandOptions<unknown[], TData[]>);
}

/**
 * @see https://redis.io/commands/sinterstore
 */
declare class SInterStoreCommand extends Command<number, number> {
    constructor(cmd: [destination: string, key: string, ...keys: string[]], opts?: CommandOptions<number, number>);
}

/**
 * @see https://redis.io/commands/sismember
 */
declare class SIsMemberCommand<TData = string> extends Command<"0" | "1", 0 | 1> {
    constructor(cmd: [key: string, member: TData], opts?: CommandOptions<"0" | "1", 0 | 1>);
}

/**
 * @see https://redis.io/commands/smembers
 */
declare class SMembersCommand<TData extends unknown[] = string[]> extends Command<unknown[], TData> {
    constructor(cmd: [key: string], opts?: CommandOptions<unknown[], TData>);
}

/**
 * @see https://redis.io/commands/smismember
 */
declare class SMIsMemberCommand<TMembers extends unknown[]> extends Command<("0" | "1")[], (0 | 1)[]> {
    constructor(cmd: [key: string, members: TMembers], opts?: CommandOptions<("0" | "1")[], (0 | 1)[]>);
}

/**
 * @see https://redis.io/commands/smove
 */
declare class SMoveCommand<TData> extends Command<"0" | "1", 0 | 1> {
    constructor(cmd: [source: string, destination: string, member: TData], opts?: CommandOptions<"0" | "1", 0 | 1>);
}

/**
 * @see https://redis.io/commands/spop
 */
declare class SPopCommand<TData> extends Command<string | string[] | null, TData | null> {
    constructor([key, count]: [key: string, count?: number], opts?: CommandOptions<string | string[] | null, TData | null>);
}

/**
 * @see https://redis.io/commands/srandmember
 */
declare class SRandMemberCommand<TData> extends Command<string | null, TData | null> {
    constructor([key, count]: [key: string, count?: number], opts?: CommandOptions<string | null, TData | null>);
}

/**
 * @see https://redis.io/commands/srem
 */
declare class SRemCommand<TData = string> extends Command<number, number> {
    constructor(cmd: [key: string, ...members: TData[]], opts?: CommandOptions<number, number>);
}

/**
 * @see https://redis.io/commands/sscan
 */
declare class SScanCommand extends Command<[
    string,
    (string | number)[]
], [
    string,
    (string | number)[]
]> {
    constructor([key, cursor, opts]: [key: string, cursor: string | number, opts?: ScanCommandOptions], cmdOpts?: CommandOptions<[string, (string | number)[]], [string, (string | number)[]]>);
}

/**
 * @see https://redis.io/commands/strlen
 */
declare class StrLenCommand extends Command<number, number> {
    constructor(cmd: [key: string], opts?: CommandOptions<number, number>);
}

/**
 * @see https://redis.io/commands/sunion
 */
declare class SUnionCommand<TData> extends Command<string[], TData[]> {
    constructor(cmd: [key: string, ...keys: string[]], opts?: CommandOptions<string[], TData[]>);
}

/**
 * @see https://redis.io/commands/sunionstore
 */
declare class SUnionStoreCommand extends Command<number, number> {
    constructor(cmd: [destination: string, key: string, ...keys: string[]], opts?: CommandOptions<number, number>);
}

/**
 * @see https://redis.io/commands/time
 */
declare class TimeCommand extends Command<[number, number], [number, number]> {
    constructor(opts?: CommandOptions<[number, number], [number, number]>);
}

/**
 * @see https://redis.io/commands/touch
 */
declare class TouchCommand extends Command<number, number> {
    constructor(cmd: [...keys: string[]], opts?: CommandOptions<number, number>);
}

/**
 * @see https://redis.io/commands/ttl
 */
declare class TtlCommand extends Command<number, number> {
    constructor(cmd: [key: string], opts?: CommandOptions<number, number>);
}

/**
 * @see https://redis.io/commands/unlink
 */
declare class UnlinkCommand extends Command<number, number> {
    constructor(cmd: [...keys: string[]], opts?: CommandOptions<number, number>);
}

type XAddCommandOptions = {
    nomkStream?: boolean;
    trim?: ({
        type: "MAXLEN" | "maxlen";
        threshold: number;
    } | {
        type: "MINID" | "minid";
        threshold: string;
    }) & ({
        comparison: "~";
        limit?: number;
    } | {
        comparison: "=";
        limit?: never;
    });
};
/**
 * @see https://redis.io/commands/xadd
 */
declare class XAddCommand extends Command<string, string> {
    constructor([key, id, entries, opts]: [
        key: string,
        id: "*" | string,
        entries: Record<string, unknown>,
        opts?: XAddCommandOptions
    ], commandOptions?: CommandOptions<string, string>);
}

declare class XRangeCommand<TData extends Record<string, Record<string, unknown>>> extends Command<string[][], TData> {
    constructor([key, start, end, count]: [key: string, start: string, end: string, count?: number], opts?: CommandOptions<unknown[], TData[]>);
}

type XReadCommandOptions = [
    key: string | string[],
    id: string | string[],
    options?: {
        count?: number;
        /**
         * @deprecated block is not yet supported in Upstash Redis
         */
        blockMS?: number;
    }
];
type XReadOptions = XReadCommandOptions extends [infer K, infer I, ...any[]] ? K extends string ? I extends string ? [
    key: string,
    id: string,
    options?: {
        count?: number;
        /**
         * @deprecated block is not yet supported in Upstash Redis
         */
        blockMS?: number;
    }
] : never : K extends string[] ? I extends string[] ? [
    key: string[],
    id: string[],
    options?: {
        count?: number;
        /**
         * @deprecated block is not yet supported in Upstash Redis
         */
        blockMS?: number;
    }
] : never : never : never;
/**
 * @see https://redis.io/commands/xread
 */
declare class XReadCommand extends Command<number, unknown[]> {
    constructor([key, id, options]: XReadOptions, opts?: CommandOptions<number, unknown[]>);
}

type Options = {
    count?: number;
    /**
     * @deprecated block is not yet supported in Upstash Redis
     */
    blockMS?: number;
    NOACK?: boolean;
};
type XReadGroupCommandOptions = [
    group: string,
    consumer: string,
    key: string | string[],
    id: string | string[],
    options?: Options
];
type XReadGroupOptions = XReadGroupCommandOptions extends [
    string,
    string,
    infer TKey,
    infer TId,
    ...any[]
] ? TKey extends string ? TId extends string ? [group: string, consumer: string, key: string, id: string, options?: Options] : never : TKey extends string[] ? TId extends string[] ? [group: string, consumer: string, key: string[], id: string[], options?: Options] : never : never : never;
/**
 * @see https://redis.io/commands/xreadgroup
 */
declare class XReadGroupCommand extends Command<number, unknown[]> {
    constructor([group, consumer, key, id, options]: XReadGroupOptions, opts?: CommandOptions<number, unknown[]>);
}

type NXAndXXOptions = {
    nx: true;
    xx?: never;
} | {
    nx?: never;
    xx: true;
} | {
    nx?: never;
    xx?: never;
};
type LTAndGTOptions = {
    lt: true;
    gt?: never;
} | {
    lt?: never;
    gt: true;
} | {
    lt?: never;
    gt?: never;
};
type ZAddCommandOptions = NXAndXXOptions & LTAndGTOptions & {
    ch?: true;
} & {
    incr?: true;
};
type Arg2<TData> = ScoreMember<TData> | ZAddCommandOptions;
type ScoreMember<TData> = {
    score: number;
    member: TData;
};
/**
 * @see https://redis.io/commands/zadd
 */
declare class ZAddCommand<TData = string> extends Command<number | null, number | null> {
    constructor([key, arg1, ...arg2]: [string, Arg2<TData>, ...ScoreMember<TData>[]], opts?: CommandOptions<number | null, number | null>);
}

/**
 * @see https://redis.io/commands/zcard
 */
declare class ZCardCommand extends Command<number, number> {
    constructor(cmd: [key: string], opts?: CommandOptions<number, number>);
}

/**
 * @see https://redis.io/commands/zcount
 */
declare class ZCountCommand extends Command<number, number> {
    constructor(cmd: [key: string, min: number | string, max: number | string], opts?: CommandOptions<number, number>);
}

/**
 * @see https://redis.io/commands/zincrby
 */
declare class ZIncrByCommand<TData> extends Command<number, number> {
    constructor(cmd: [key: string, increment: number, member: TData], opts?: CommandOptions<number, number>);
}

/**
 * @see https://redis.io/commands/zlexcount
 */
declare class ZLexCountCommand extends Command<number, number> {
    constructor(cmd: [key: string, min: string, max: string], opts?: CommandOptions<number, number>);
}

/**
 * @see https://redis.io/commands/zpopmax
 */
declare class ZPopMaxCommand<TData> extends Command<string[], TData[]> {
    constructor([key, count]: [key: string, count?: number], opts?: CommandOptions<string[], TData[]>);
}

/**
 * @see https://redis.io/commands/zpopmin
 */
declare class ZPopMinCommand<TData> extends Command<string[], TData[]> {
    constructor([key, count]: [key: string, count?: number], opts?: CommandOptions<string[], TData[]>);
}

type ZRangeCommandOptions = {
    withScores?: boolean;
    rev?: boolean;
} & ({
    byScore: true;
    byLex?: never;
} | {
    byScore?: never;
    byLex: true;
} | {
    byScore?: never;
    byLex?: never;
}) & ({
    offset: number;
    count: number;
} | {
    offset?: never;
    count?: never;
});
/**
 * @see https://redis.io/commands/zrange
 */
declare class ZRangeCommand<TData extends unknown[]> extends Command<string[], TData> {
    constructor(cmd: [key: string, min: number, max: number, opts?: ZRangeCommandOptions], cmdOpts?: CommandOptions<string[], TData>);
    constructor(cmd: [
        key: string,
        min: `(${string}` | `[${string}` | "-" | "+",
        max: `(${string}` | `[${string}` | "-" | "+",
        opts: {
            byLex: true;
        } & ZRangeCommandOptions
    ], cmdOpts?: CommandOptions<string[], TData>);
    constructor(cmd: [
        key: string,
        min: number | `(${number}` | "-inf" | "+inf",
        max: number | `(${number}` | "-inf" | "+inf",
        opts: {
            byScore: true;
        } & ZRangeCommandOptions
    ], cmdOpts?: CommandOptions<string[], TData>);
}

/**
 *  @see https://redis.io/commands/zrank
 */
declare class ZRankCommand<TData> extends Command<number | null, number | null> {
    constructor(cmd: [key: string, member: TData], opts?: CommandOptions<number | null, number | null>);
}

/**
 * @see https://redis.io/commands/zrem
 */
declare class ZRemCommand<TData = string> extends Command<number, number> {
    constructor(cmd: [key: string, ...members: TData[]], opts?: CommandOptions<number, number>);
}

/**
 * @see https://redis.io/commands/zremrangebylex
 */
declare class ZRemRangeByLexCommand extends Command<number, number> {
    constructor(cmd: [key: string, min: string, max: string], opts?: CommandOptions<number, number>);
}

/**
 * @see https://redis.io/commands/zremrangebyrank
 */
declare class ZRemRangeByRankCommand extends Command<number, number> {
    constructor(cmd: [key: string, start: number, stop: number], opts?: CommandOptions<number, number>);
}

/**
 * @see https://redis.io/commands/zremrangebyscore
 */
declare class ZRemRangeByScoreCommand extends Command<number, number> {
    constructor(cmd: [key: string, min: number, max: number], opts?: CommandOptions<number, number>);
}

/**
 *  @see https://redis.io/commands/zrevrank
 */
declare class ZRevRankCommand<TData> extends Command<number | null, number | null> {
    constructor(cmd: [key: string, member: TData], opts?: CommandOptions<number | null, number | null>);
}

/**
 * @see https://redis.io/commands/zscan
 */
declare class ZScanCommand extends Command<[
    string,
    (string | number)[]
], [
    string,
    (string | number)[]
]> {
    constructor([key, cursor, opts]: [key: string, cursor: string | number, opts?: ScanCommandOptions], cmdOpts?: CommandOptions<[string, (string | number)[]], [string, (string | number)[]]>);
}

/**
 * @see https://redis.io/commands/zscore
 */
declare class ZScoreCommand<TData> extends Command<string | null, number | null> {
    constructor(cmd: [key: string, member: TData], opts?: CommandOptions<string | null, number | null>);
}

type BaseMessageData<TMessage> = {
    channel: string;
    message: TMessage;
};
type PatternMessageData<TMessage> = BaseMessageData<TMessage> & {
    pattern: string;
};
type SubscriptionCountEvent = number;
type MessageEventMap<TMessage> = {
    message: BaseMessageData<TMessage>;
    subscribe: SubscriptionCountEvent;
    unsubscribe: SubscriptionCountEvent;
    pmessage: PatternMessageData<TMessage>;
    psubscribe: SubscriptionCountEvent;
    punsubscribe: SubscriptionCountEvent;
    error: Error;
    [key: `message:${string}`]: BaseMessageData<TMessage>;
    [key: `pmessage:${string}`]: PatternMessageData<TMessage>;
};
type EventType = keyof MessageEventMap<any>;
type Listener<TMessage, T extends EventType> = (event: MessageEventMap<TMessage>[T]) => void;
declare class Subscriber<TMessage = any> extends EventTarget {
    private subscriptions;
    private client;
    private listeners;
    private opts?;
    constructor(client: Requester, channels: string[], isPattern?: boolean, opts?: Pick<RedisOptions, "automaticDeserialization">);
    private subscribeToChannel;
    private subscribeToPattern;
    private handleMessage;
    private dispatchToListeners;
    on<T extends keyof MessageEventMap<TMessage>>(type: T, listener: Listener<TMessage, T>): void;
    removeAllListeners(): void;
    unsubscribe(channels?: string[]): Promise<void>;
    getSubscribedChannels(): string[];
}

type InferResponseData<T extends unknown[]> = {
    [K in keyof T]: T[K] extends Command<any, infer TData> ? TData : unknown;
};
interface ExecMethod<TCommands extends Command<any, any>[]> {
    /**
     * Send the pipeline request to upstash.
     *
     * Returns an array with the results of all pipelined commands.
     *
     * If all commands are statically chained from start to finish, types are inferred. You can still define a return type manually if necessary though:
     * ```ts
     * const p = redis.pipeline()
     * p.get("key")
     * const result = p.exec<[{ greeting: string }]>()
     * ```
     *
     * If one of the commands get an error, the whole pipeline fails. Alternatively, you can set the keepErrors option to true in order to get the errors individually.
     *
     * If keepErrors is set to true, a list of objects is returned where each object corresponds to a command and is of type: `{ result: unknown, error?: string }`.
     *
     * ```ts
     * const p = redis.pipeline()
     * p.get("key")
     *
     * const result = await p.exec({ keepErrors: true });
     * const getResult = result[0].result
     * const getError = result[0].error
     * ```
     */
    <TCommandResults extends unknown[] = [] extends TCommands ? unknown[] : InferResponseData<TCommands>>(): Promise<TCommandResults>;
    <TCommandResults extends unknown[] = [] extends TCommands ? unknown[] : InferResponseData<TCommands>>(options: {
        keepErrors: true;
    }): Promise<{
        [K in keyof TCommandResults]: UpstashResponse<TCommandResults[K]>;
    }>;
}
/**
 * Upstash REST API supports command pipelining to send multiple commands in
 * batch, instead of sending each command one by one and waiting for a response.
 * When using pipelines, several commands are sent using a single HTTP request,
 * and a single JSON array response is returned. Each item in the response array
 * corresponds to the command in the same order within the pipeline.
 *
 * **NOTE:**
 *
 * Execution of the pipeline is not atomic. Even though each command in
 * the pipeline will be executed in order, commands sent by other clients can
 * interleave with the pipeline.
 *
 * **Examples:**
 *
 * ```ts
 *  const p = redis.pipeline() // or redis.multi()
 * p.set("key","value")
 * p.get("key")
 * const res = await p.exec()
 * ```
 *
 * You can also chain commands together
 * ```ts
 * const p = redis.pipeline()
 * const res = await p.set("key","value").get("key").exec()
 * ```
 *
 * Return types are inferred if all commands are chained, but you can still
 * override the response type manually:
 * ```ts
 *  redis.pipeline()
 *   .set("key", { greeting: "hello"})
 *   .get("key")
 *   .exec<["OK", { greeting: string } ]>()
 *
 * ```
 */
declare class Pipeline<TCommands extends Command<any, any>[] = []> {
    private client;
    private commands;
    private commandOptions?;
    private multiExec;
    constructor(opts: {
        client: Requester;
        commandOptions?: CommandOptions<any, any>;
        multiExec?: boolean;
    });
    exec: ExecMethod<TCommands>;
    /**
     * Returns the length of pipeline before the execution
     */
    length(): number;
    /**
     * Pushes a command into the pipeline and returns a chainable instance of the
     * pipeline
     */
    private chain;
    /**
     * @see https://redis.io/commands/append
     */
    append: (key: string, value: string) => Pipeline<[...TCommands, Command<any, number>]>;
    /**
     * @see https://redis.io/commands/bitcount
     */
    bitcount: (key: string, start: number, end: number) => Pipeline<[...TCommands, Command<any, number>]>;
    /**
     * Returns an instance that can be used to execute `BITFIELD` commands on one key.
     *
     * @example
     * ```typescript
     * redis.set("mykey", 0);
     * const result = await redis.pipeline()
     *   .bitfield("mykey")
     *   .set("u4", 0, 16)
     *   .incr("u4", "#1", 1)
     *   .exec();
     * console.log(result); // [[0, 1]]
     * ```
     *
     * @see https://redis.io/commands/bitfield
     */
    bitfield: (key: string) => BitFieldCommand<Pipeline<[...TCommands, Command<any, number[]>]>>;
    /**
     * @see https://redis.io/commands/bitop
     */
    bitop: {
        (op: "and" | "or" | "xor", destinationKey: string, sourceKey: string, ...sourceKeys: string[]): Pipeline<[...TCommands, BitOpCommand]>;
        (op: "not", destinationKey: string, sourceKey: string): Pipeline<[...TCommands, BitOpCommand]>;
    };
    /**
     * @see https://redis.io/commands/bitpos
     */
    bitpos: (key: string, bit: 0 | 1, start?: number | undefined, end?: number | undefined) => Pipeline<[...TCommands, Command<any, number>]>;
    /**
     * @see https://redis.io/commands/copy
     */
    copy: (key: string, destinationKey: string, opts?: {
        replace: boolean;
    } | undefined) => Pipeline<[...TCommands, Command<any, "COPIED" | "NOT_COPIED">]>;
    /**
     * @see https://redis.io/commands/zdiffstore
     */
    zdiffstore: (destination: string, numkeys: number, ...keys: string[]) => Pipeline<[...TCommands, Command<any, number>]>;
    /**
     * @see https://redis.io/commands/dbsize
     */
    dbsize: () => Pipeline<[...TCommands, Command<any, number>]>;
    /**
     * @see https://redis.io/commands/decr
     */
    decr: (key: string) => Pipeline<[...TCommands, Command<any, number>]>;
    /**
     * @see https://redis.io/commands/decrby
     */
    decrby: (key: string, decrement: number) => Pipeline<[...TCommands, Command<any, number>]>;
    /**
     * @see https://redis.io/commands/del
     */
    del: (...args: CommandArgs<typeof DelCommand>) => Pipeline<[...TCommands, Command<any, number>]>;
    /**
     * @see https://redis.io/commands/echo
     */
    echo: (message: string) => Pipeline<[...TCommands, Command<any, string>]>;
    /**
     * @see https://redis.io/commands/eval_ro
     */
    evalRo: <TArgs extends unknown[], TData = unknown>(script: string, keys: string[], args: TArgs) => Pipeline<[...TCommands, Command<any, TData>]>;
    /**
     * @see https://redis.io/commands/eval
     */
    eval: <TArgs extends unknown[], TData = unknown>(script: string, keys: string[], args: TArgs) => Pipeline<[...TCommands, Command<any, TData>]>;
    /**
     * @see https://redis.io/commands/evalsha_ro
     */
    evalshaRo: <TArgs extends unknown[], TData = unknown>(sha1: string, keys: string[], args: TArgs) => Pipeline<[...TCommands, Command<any, TData>]>;
    /**
     * @see https://redis.io/commands/evalsha
     */
    evalsha: <TArgs extends unknown[], TData = unknown>(sha1: string, keys: string[], args: TArgs) => Pipeline<[...TCommands, Command<any, TData>]>;
    /**
     * @see https://redis.io/commands/exists
     */
    exists: (...args: CommandArgs<typeof ExistsCommand>) => Pipeline<[...TCommands, Command<any, number>]>;
    /**
     * @see https://redis.io/commands/expire
     */
    expire: (key: string, seconds: number, option?: ExpireOption | undefined) => Pipeline<[...TCommands, Command<any, 0 | 1>]>;
    /**
     * @see https://redis.io/commands/expireat
     */
    expireat: (key: string, unix: number, option?: ExpireOption | undefined) => Pipeline<[...TCommands, Command<any, 0 | 1>]>;
    /**
     * @see https://redis.io/commands/flushall
     */
    flushall: (args?: CommandArgs<typeof FlushAllCommand>) => Pipeline<[...TCommands, Command<any, "OK">]>;
    /**
     * @see https://redis.io/commands/flushdb
     */
    flushdb: (opts?: {
        async?: boolean;
    } | undefined) => Pipeline<[...TCommands, Command<any, "OK">]>;
    /**
     * @see https://redis.io/commands/geoadd
     */
    geoadd: <TData>(args_0: string, args_1: GeoAddCommandOptions | GeoMember<TData>, ...args_2: GeoMember<TData>[]) => Pipeline<[...TCommands, Command<any, number | null>]>;
    /**
     * @see https://redis.io/commands/geodist
     */
    geodist: <TData>(key: string, member1: TData, member2: TData, unit?: "M" | "KM" | "FT" | "MI" | undefined) => Pipeline<[...TCommands, Command<any, number | null>]>;
    /**
     * @see https://redis.io/commands/geopos
     */
    geopos: <TData>(args_0: string, ...args_1: TData[]) => Pipeline<[...TCommands, Command<any, {
        lng: number;
        lat: number;
    }[]>]>;
    /**
     * @see https://redis.io/commands/geohash
     */
    geohash: <TData>(args_0: string, ...args_1: TData[]) => Pipeline<[...TCommands, Command<any, (string | null)[]>]>;
    /**
     * @see https://redis.io/commands/geosearch
     */
    geosearch: <TData>(key: string, centerPoint: {
        type: "FROMLONLAT" | "fromlonlat";
        coordinate: {
            lon: number;
            lat: number;
        };
    } | {
        type: "FROMMEMBER" | "frommember";
        member: TData;
    }, shape: {
        type: "BYRADIUS" | "byradius";
        radius: number;
        radiusType: "M" | "KM" | "FT" | "MI";
    } | {
        type: "BYBOX" | "bybox";
        rect: {
            width: number;
            height: number;
        };
        rectType: "M" | "KM" | "FT" | "MI";
    }, order: "ASC" | "DESC" | "asc" | "desc", opts?: {
        count?: {
            limit: number;
            any?: boolean;
        };
        withCoord?: boolean;
        withDist?: boolean;
        withHash?: boolean;
    } | undefined) => Pipeline<[...TCommands, Command<any, ({
        member: TData;
    } & {
        coord?: {
            long: number;
            lat: number;
        } | undefined;
        dist?: number | undefined;
        hash?: string | undefined;
    })[]>]>;
    /**
     * @see https://redis.io/commands/geosearchstore
     */
    geosearchstore: <TData>(destination: string, key: string, centerPoint: {
        type: "FROMLONLAT" | "fromlonlat";
        coordinate: {
            lon: number;
            lat: number;
        };
    } | {
        type: "FROMMEMBER" | "frommember";
        member: TData;
    }, shape: {
        type: "BYRADIUS" | "byradius";
        radius: number;
        radiusType: "M" | "KM" | "FT" | "MI";
    } | {
        type: "BYBOX" | "bybox";
        rect: {
            width: number;
            height: number;
        };
        rectType: "M" | "KM" | "FT" | "MI";
    }, order: "ASC" | "DESC" | "asc" | "desc", opts?: {
        count?: {
            limit: number;
            any?: boolean;
        };
        storeDist?: boolean;
    } | undefined) => Pipeline<[...TCommands, Command<any, number>]>;
    /**
     * @see https://redis.io/commands/get
     */
    get: <TData>(key: string) => Pipeline<[...TCommands, Command<any, TData | null>]>;
    /**
     * @see https://redis.io/commands/getbit
     */
    getbit: (key: string, offset: number) => Pipeline<[...TCommands, Command<any, 0 | 1>]>;
    /**
     * @see https://redis.io/commands/getdel
     */
    getdel: <TData>(key: string) => Pipeline<[...TCommands, Command<any, TData | null>]>;
    /**
     * @see https://redis.io/commands/getex
     */
    getex: <TData>(key: string, opts?: ({
        ex: number;
        px?: never;
        exat?: never;
        pxat?: never;
        persist?: never;
    } | {
        ex?: never;
        px: number;
        exat?: never;
        pxat?: never;
        persist?: never;
    } | {
        ex?: never;
        px?: never;
        exat: number;
        pxat?: never;
        persist?: never;
    } | {
        ex?: never;
        px?: never;
        exat?: never;
        pxat: number;
        persist?: never;
    } | {
        ex?: never;
        px?: never;
        exat?: never;
        pxat?: never;
        persist: true;
    } | {
        ex?: never;
        px?: never;
        exat?: never;
        pxat?: never;
        persist?: never;
    }) | undefined) => Pipeline<[...TCommands, Command<any, TData | null>]>;
    /**
     * @see https://redis.io/commands/getrange
     */
    getrange: (key: string, start: number, end: number) => Pipeline<[...TCommands, Command<any, string>]>;
    /**
     * @see https://redis.io/commands/getset
     */
    getset: <TData>(key: string, value: TData) => Pipeline<[...TCommands, Command<any, TData | null>]>;
    /**
     * @see https://redis.io/commands/hdel
     */
    hdel: (key: string, ...fields: string[]) => Pipeline<[...TCommands, Command<any, 0 | 1>]>;
    /**
     * @see https://redis.io/commands/hexists
     */
    hexists: (key: string, field: string) => Pipeline<[...TCommands, Command<any, number>]>;
    /**
     * @see https://redis.io/commands/hexpire
     */
    hexpire: (key: string, fields: string | number | (string | number)[], seconds: number, option?: ExpireOption | undefined) => Pipeline<[...TCommands, Command<any, (0 | 1 | 2 | -2)[]>]>;
    /**
     * @see https://redis.io/commands/hexpireat
     */
    hexpireat: (key: string, fields: string | number | (string | number)[], timestamp: number, option?: ExpireOption | undefined) => Pipeline<[...TCommands, Command<any, (0 | 1 | 2 | -2)[]>]>;
    /**
     * @see https://redis.io/commands/hexpiretime
     */
    hexpiretime: (key: string, fields: string | number | (string | number)[]) => Pipeline<[...TCommands, Command<any, number[]>]>;
    /**
     * @see https://redis.io/commands/httl
     */
    httl: (key: string, fields: string | number | (string | number)[]) => Pipeline<[...TCommands, Command<any, number[]>]>;
    /**
     * @see https://redis.io/commands/hpexpire
     */
    hpexpire: (key: string, fields: string | number | (string | number)[], milliseconds: number, option?: ExpireOption | undefined) => Pipeline<[...TCommands, Command<any, (0 | 1 | 2 | -2)[]>]>;
    /**
     * @see https://redis.io/commands/hpexpireat
     */
    hpexpireat: (key: string, fields: string | number | (string | number)[], timestamp: number, option?: ExpireOption | undefined) => Pipeline<[...TCommands, Command<any, (0 | 1 | 2 | -2)[]>]>;
    /**
     * @see https://redis.io/commands/hpexpiretime
     */
    hpexpiretime: (key: string, fields: string | number | (string | number)[]) => Pipeline<[...TCommands, Command<any, number[]>]>;
    /**
     * @see https://redis.io/commands/hpttl
     */
    hpttl: (key: string, fields: string | number | (string | number)[]) => Pipeline<[...TCommands, Command<any, number[]>]>;
    /**
     * @see https://redis.io/commands/hpersist
     */
    hpersist: (key: string, fields: string | number | (string | number)[]) => Pipeline<[...TCommands, Command<any, (1 | -2 | -1)[]>]>;
    /**
     * @see https://redis.io/commands/hget
     */
    hget: <TData>(key: string, field: string) => Pipeline<[...TCommands, Command<any, TData | null>]>;
    /**
     * @see https://redis.io/commands/hgetall
     */
    hgetall: <TData extends Record<string, unknown>>(key: string) => Pipeline<[...TCommands, Command<any, TData | null>]>;
    /**
     * @see https://redis.io/commands/hincrby
     */
    hincrby: (key: string, field: string, increment: number) => Pipeline<[...TCommands, Command<any, number>]>;
    /**
     * @see https://redis.io/commands/hincrbyfloat
     */
    hincrbyfloat: (key: string, field: string, increment: number) => Pipeline<[...TCommands, Command<any, number>]>;
    /**
     * @see https://redis.io/commands/hkeys
     */
    hkeys: (key: string) => Pipeline<[...TCommands, Command<any, string[]>]>;
    /**
     * @see https://redis.io/commands/hlen
     */
    hlen: (key: string) => Pipeline<[...TCommands, Command<any, number>]>;
    /**
     * @see https://redis.io/commands/hmget
     */
    hmget: <TData extends Record<string, unknown>>(key: string, ...fields: string[]) => Pipeline<[...TCommands, Command<any, TData | null>]>;
    /**
     * @see https://redis.io/commands/hmset
     */
    hmset: <TData>(key: string, kv: Record<string, TData>) => Pipeline<[...TCommands, Command<any, "OK">]>;
    /**
     * @see https://redis.io/commands/hrandfield
     */
    hrandfield: <TData extends string | string[] | Record<string, unknown>>(key: string, count?: number, withValues?: boolean) => Pipeline<[...TCommands, Command<any, TData>]>;
    /**
     * @see https://redis.io/commands/hscan
     */
    hscan: (key: string, cursor: string | number, cmdOpts?: ScanCommandOptions | undefined) => Pipeline<[...TCommands, Command<any, [string, (string | number)[]]>]>;
    /**
     * @see https://redis.io/commands/hset
     */
    hset: <TData>(key: string, kv: Record<string, TData>) => Pipeline<[...TCommands, Command<any, number>]>;
    /**
     * @see https://redis.io/commands/hsetnx
     */
    hsetnx: <TData>(key: string, field: string, value: TData) => Pipeline<[...TCommands, Command<any, 0 | 1>]>;
    /**
     * @see https://redis.io/commands/hstrlen
     */
    hstrlen: (key: string, field: string) => Pipeline<[...TCommands, Command<any, number>]>;
    /**
     * @see https://redis.io/commands/hvals
     */
    hvals: (key: string) => Pipeline<[...TCommands, Command<any, any>]>;
    /**
     * @see https://redis.io/commands/incr
     */
    incr: (key: string) => Pipeline<[...TCommands, Command<any, number>]>;
    /**
     * @see https://redis.io/commands/incrby
     */
    incrby: (key: string, value: number) => Pipeline<[...TCommands, Command<any, number>]>;
    /**
     * @see https://redis.io/commands/incrbyfloat
     */
    incrbyfloat: (key: string, value: number) => Pipeline<[...TCommands, Command<any, number>]>;
    /**
     * @see https://redis.io/commands/keys
     */
    keys: (pattern: string) => Pipeline<[...TCommands, Command<any, string[]>]>;
    /**
     * @see https://redis.io/commands/lindex
     */
    lindex: (key: string, index: number) => Pipeline<[...TCommands, Command<any, any>]>;
    /**
     * @see https://redis.io/commands/linsert
     */
    linsert: <TData>(key: string, direction: "before" | "after", pivot: TData, value: TData) => Pipeline<[...TCommands, Command<any, number>]>;
    /**
     * @see https://redis.io/commands/llen
     */
    llen: (key: string) => Pipeline<[...TCommands, Command<any, number>]>;
    /**
     * @see https://redis.io/commands/lmove
     */
    lmove: <TData = string>(source: string, destination: string, whereFrom: "left" | "right", whereTo: "left" | "right") => Pipeline<[...TCommands, Command<any, TData>]>;
    /**
     * @see https://redis.io/commands/lpop
     */
    lpop: <TData>(key: string, count?: number | undefined) => Pipeline<[...TCommands, Command<any, TData | null>]>;
    /**
     * @see https://redis.io/commands/lmpop
     */
    lmpop: <TData>(numkeys: number, keys: string[], args_2: "LEFT" | "RIGHT", count?: number | undefined) => Pipeline<[...TCommands, Command<any, [string, TData[]] | null>]>;
    /**
     * @see https://redis.io/commands/lpos
     */
    lpos: <TData>(key: string, element: unknown, opts?: {
        rank?: number;
        count?: number;
        maxLen?: number;
    } | undefined) => Pipeline<[...TCommands, Command<any, TData>]>;
    /**
     * @see https://redis.io/commands/lpush
     */
    lpush: <TData>(key: string, ...elements: TData[]) => Pipeline<[...TCommands, Command<any, number>]>;
    /**
     * @see https://redis.io/commands/lpushx
     */
    lpushx: <TData>(key: string, ...elements: TData[]) => Pipeline<[...TCommands, Command<any, number>]>;
    /**
     * @see https://redis.io/commands/lrange
     */
    lrange: <TResult = string>(key: string, start: number, end: number) => Pipeline<[...TCommands, Command<any, TResult[]>]>;
    /**
     * @see https://redis.io/commands/lrem
     */
    lrem: <TData>(key: string, count: number, value: TData) => Pipeline<[...TCommands, Command<any, number>]>;
    /**
     * @see https://redis.io/commands/lset
     */
    lset: <TData>(key: string, index: number, value: TData) => Pipeline<[...TCommands, Command<any, "OK">]>;
    /**
     * @see https://redis.io/commands/ltrim
     */
    ltrim: (key: string, start: number, end: number) => Pipeline<[...TCommands, Command<any, "OK">]>;
    /**
     * @see https://redis.io/commands/mget
     */
    mget: <TData extends unknown[]>(...args: CommandArgs<typeof MGetCommand>) => Pipeline<[...TCommands, Command<any, TData>]>;
    /**
     * @see https://redis.io/commands/mset
     */
    mset: <TData>(kv: Record<string, TData>) => Pipeline<[...TCommands, Command<any, "OK">]>;
    /**
     * @see https://redis.io/commands/msetnx
     */
    msetnx: <TData>(kv: Record<string, TData>) => Pipeline<[...TCommands, Command<any, number>]>;
    /**
     * @see https://redis.io/commands/persist
     */
    persist: (key: string) => Pipeline<[...TCommands, Command<any, 0 | 1>]>;
    /**
     * @see https://redis.io/commands/pexpire
     */
    pexpire: (key: string, milliseconds: number, option?: ExpireOption | undefined) => Pipeline<[...TCommands, Command<any, 0 | 1>]>;
    /**
     * @see https://redis.io/commands/pexpireat
     */
    pexpireat: (key: string, unix: number, option?: ExpireOption | undefined) => Pipeline<[...TCommands, Command<any, 0 | 1>]>;
    /**
     * @see https://redis.io/commands/pfadd
     */
    pfadd: (args_0: string, ...args_1: unknown[]) => Pipeline<[...TCommands, Command<any, number>]>;
    /**
     * @see https://redis.io/commands/pfcount
     */
    pfcount: (args_0: string, ...args_1: string[]) => Pipeline<[...TCommands, Command<any, number>]>;
    /**
     * @see https://redis.io/commands/pfmerge
     */
    pfmerge: (destination_key: string, ...args_1: string[]) => Pipeline<[...TCommands, Command<any, "OK">]>;
    /**
     * @see https://redis.io/commands/ping
     */
    ping: (args?: CommandArgs<typeof PingCommand>) => Pipeline<[...TCommands, Command<any, string>]>;
    /**
     * @see https://redis.io/commands/psetex
     */
    psetex: <TData>(key: string, ttl: number, value: TData) => Pipeline<[...TCommands, Command<any, string>]>;
    /**
     * @see https://redis.io/commands/pttl
     */
    pttl: (key: string) => Pipeline<[...TCommands, Command<any, number>]>;
    /**
     * @see https://redis.io/commands/publish
     */
    publish: (channel: string, message: unknown) => Pipeline<[...TCommands, Command<any, number>]>;
    /**
     * @see https://redis.io/commands/randomkey
     */
    randomkey: () => Pipeline<[...TCommands, Command<any, string | null>]>;
    /**
     * @see https://redis.io/commands/rename
     */
    rename: (source: string, destination: string) => Pipeline<[...TCommands, Command<any, "OK">]>;
    /**
     * @see https://redis.io/commands/renamenx
     */
    renamenx: (source: string, destination: string) => Pipeline<[...TCommands, Command<any, 0 | 1>]>;
    /**
     * @see https://redis.io/commands/rpop
     */
    rpop: <TData = string>(key: string, count?: number | undefined) => Pipeline<[...TCommands, Command<any, TData | null>]>;
    /**
     * @see https://redis.io/commands/rpush
     */
    rpush: <TData>(key: string, ...elements: TData[]) => Pipeline<[...TCommands, Command<any, number>]>;
    /**
     * @see https://redis.io/commands/rpushx
     */
    rpushx: <TData>(key: string, ...elements: TData[]) => Pipeline<[...TCommands, Command<any, number>]>;
    /**
     * @see https://redis.io/commands/sadd
     */
    sadd: <TData>(key: string, member: TData, ...members: TData[]) => Pipeline<[...TCommands, Command<any, number>]>;
    /**
     * @see https://redis.io/commands/scan
     */
    scan: (cursor: string | number, opts?: ScanCommandOptions | undefined) => Pipeline<[...TCommands, Command<any, any>]>;
    /**
     * @see https://redis.io/commands/scard
     */
    scard: (key: string) => Pipeline<[...TCommands, Command<any, number>]>;
    /**
     * @see https://redis.io/commands/script-exists
     */
    scriptExists: (...args: CommandArgs<typeof ScriptExistsCommand>) => Pipeline<[...TCommands, Command<any, number[]>]>;
    /**
     * @see https://redis.io/commands/script-flush
     */
    scriptFlush: (opts?: ScriptFlushCommandOptions | undefined) => Pipeline<[...TCommands, Command<any, "OK">]>;
    /**
     * @see https://redis.io/commands/script-load
     */
    scriptLoad: (script: string) => Pipeline<[...TCommands, Command<any, string>]>;
    sdiff: (key: string, ...keys: string[]) => Pipeline<[...TCommands, Command<any, unknown[]>]>;
    /**
     * @see https://redis.io/commands/sdiffstore
     */
    sdiffstore: (destination: string, ...keys: string[]) => Pipeline<[...TCommands, Command<any, number>]>;
    /**
     * @see https://redis.io/commands/set
     */
    set: <TData>(key: string, value: TData, opts?: SetCommandOptions) => Pipeline<[...TCommands, Command<any, "OK" | TData | null>]>;
    /**
     * @see https://redis.io/commands/setbit
     */
    setbit: (key: string, offset: number, value: 0 | 1) => Pipeline<[...TCommands, Command<any, 0 | 1>]>;
    /**
     * @see https://redis.io/commands/setex
     */
    setex: <TData>(key: string, ttl: number, value: TData) => Pipeline<[...TCommands, Command<any, "OK">]>;
    /**
     * @see https://redis.io/commands/setnx
     */
    setnx: <TData>(key: string, value: TData) => Pipeline<[...TCommands, Command<any, number>]>;
    /**
     * @see https://redis.io/commands/setrange
     */
    setrange: (key: string, offset: number, value: string) => Pipeline<[...TCommands, Command<any, number>]>;
    /**
     * @see https://redis.io/commands/sinter
     */
    sinter: (key: string, ...keys: string[]) => Pipeline<[...TCommands, Command<any, string[]>]>;
    /**
     * @see https://redis.io/commands/sinterstore
     */
    sinterstore: (destination: string, key: string, ...keys: string[]) => Pipeline<[...TCommands, Command<any, number>]>;
    /**
     * @see https://redis.io/commands/sismember
     */
    sismember: <TData>(key: string, member: TData) => Pipeline<[...TCommands, Command<any, 0 | 1>]>;
    /**
     * @see https://redis.io/commands/smembers
     */
    smembers: <TData extends unknown[] = string[]>(key: string) => Pipeline<[...TCommands, Command<any, TData>]>;
    /**
     * @see https://redis.io/commands/smismember
     */
    smismember: <TMembers extends unknown[]>(key: string, members: TMembers) => Pipeline<[...TCommands, Command<any, (0 | 1)[]>]>;
    /**
     * @see https://redis.io/commands/smove
     */
    smove: <TData>(source: string, destination: string, member: TData) => Pipeline<[...TCommands, Command<any, 0 | 1>]>;
    /**
     * @see https://redis.io/commands/spop
     */
    spop: <TData>(key: string, count?: number | undefined) => Pipeline<[...TCommands, Command<any, TData | null>]>;
    /**
     * @see https://redis.io/commands/srandmember
     */
    srandmember: <TData>(key: string, count?: number | undefined) => Pipeline<[...TCommands, Command<any, TData | null>]>;
    /**
     * @see https://redis.io/commands/srem
     */
    srem: <TData>(key: string, ...members: TData[]) => Pipeline<[...TCommands, Command<any, number>]>;
    /**
     * @see https://redis.io/commands/sscan
     */
    sscan: (key: string, cursor: string | number, opts?: ScanCommandOptions | undefined) => Pipeline<[...TCommands, Command<any, [string, (string | number)[]]>]>;
    /**
     * @see https://redis.io/commands/strlen
     */
    strlen: (key: string) => Pipeline<[...TCommands, Command<any, number>]>;
    /**
     * @see https://redis.io/commands/sunion
     */
    sunion: (key: string, ...keys: string[]) => Pipeline<[...TCommands, Command<any, unknown[]>]>;
    /**
     * @see https://redis.io/commands/sunionstore
     */
    sunionstore: (destination: string, key: string, ...keys: string[]) => Pipeline<[...TCommands, Command<any, number>]>;
    /**
     * @see https://redis.io/commands/time
     */
    time: () => Pipeline<[...TCommands, Command<any, [number, number]>]>;
    /**
     * @see https://redis.io/commands/touch
     */
    touch: (...args: CommandArgs<typeof TouchCommand>) => Pipeline<[...TCommands, Command<any, number>]>;
    /**
     * @see https://redis.io/commands/ttl
     */
    ttl: (key: string) => Pipeline<[...TCommands, Command<any, number>]>;
    /**
     * @see https://redis.io/commands/type
     */
    type: (key: string) => Pipeline<[...TCommands, Command<any, Type>]>;
    /**
     * @see https://redis.io/commands/unlink
     */
    unlink: (...args: CommandArgs<typeof UnlinkCommand>) => Pipeline<[...TCommands, Command<any, number>]>;
    /**
     * @see https://redis.io/commands/zadd
     */
    zadd: <TData>(...args: [key: string, scoreMember: ScoreMember<TData>, ...scoreMemberPairs: ScoreMember<TData>[]] | [key: string, opts: ZAddCommandOptions, ...scoreMemberPairs: [ScoreMember<TData>, ...ScoreMember<TData>[]]]) => Pipeline<[...TCommands, Command<any, number | null>]>;
    /**
     * @see https://redis.io/commands/xadd
     */
    xadd: (key: string, id: string, entries: Record<string, unknown>, opts?: {
        nomkStream?: boolean;
        trim?: ({
            type: "MAXLEN" | "maxlen";
            threshold: number;
        } | {
            type: "MINID" | "minid";
            threshold: string;
        }) & ({
            comparison: "~";
            limit?: number;
        } | {
            comparison: "=";
            limit?: never;
        });
    } | undefined) => Pipeline<[...TCommands, Command<any, string>]>;
    /**
     * @see https://redis.io/commands/xack
     */
    xack: (key: string, group: string, id: string | string[]) => Pipeline<[...TCommands, Command<any, number>]>;
    /**
     * @see https://redis.io/commands/xdel
     */
    xdel: (key: string, ids: string | string[]) => Pipeline<[...TCommands, Command<any, number>]>;
    /**
     * @see https://redis.io/commands/xgroup
     */
    xgroup: (key: string, opts: {
        type: "CREATE";
        group: string;
        id: `$` | string;
        options?: {
            MKSTREAM?: boolean;
            ENTRIESREAD?: number;
        };
    } | {
        type: "CREATECONSUMER";
        group: string;
        consumer: string;
    } | {
        type: "DELCONSUMER";
        group: string;
        consumer: string;
    } | {
        type: "DESTROY";
        group: string;
    } | {
        type: "SETID";
        group: string;
        id: `$` | string;
        options?: {
            ENTRIESREAD?: number;
        };
    }) => Pipeline<[...TCommands, Command<any, never>]>;
    /**
     * @see https://redis.io/commands/xread
     */
    xread: (...args: CommandArgs<typeof XReadCommand>) => Pipeline<[...TCommands, Command<any, unknown[]>]>;
    /**
     * @see https://redis.io/commands/xreadgroup
     */
    xreadgroup: (...args: CommandArgs<typeof XReadGroupCommand>) => Pipeline<[...TCommands, Command<any, unknown[]>]>;
    /**
     * @see https://redis.io/commands/xinfo
     */
    xinfo: (key: string, options: {
        type: "CONSUMERS";
        group: string;
    } | {
        type: "GROUPS";
    }) => Pipeline<[...TCommands, Command<any, unknown[]>]>;
    /**
     * @see https://redis.io/commands/xlen
     */
    xlen: (key: string) => Pipeline<[...TCommands, Command<any, number>]>;
    /**
     * @see https://redis.io/commands/xpending
     */
    xpending: (key: string, group: string, start: string, end: string, count: number, options?: {
        idleTime?: number;
        consumer?: string | string[];
    } | undefined) => Pipeline<[...TCommands, Command<any, unknown[]>]>;
    /**
     * @see https://redis.io/commands/xclaim
     */
    xclaim: (key: string, group: string, consumer: string, minIdleTime: number, id: string | string[], options?: {
        idleMS?: number;
        timeMS?: number;
        retryCount?: number;
        force?: boolean;
        justId?: boolean;
        lastId?: number;
    } | undefined) => Pipeline<[...TCommands, Command<any, unknown[]>]>;
    /**
     * @see https://redis.io/commands/xautoclaim
     */
    xautoclaim: (key: string, group: string, consumer: string, minIdleTime: number, start: string, options?: {
        count?: number;
        justId?: boolean;
    } | undefined) => Pipeline<[...TCommands, Command<any, unknown[]>]>;
    /**
     * @see https://redis.io/commands/xtrim
     */
    xtrim: (key: string, options: {
        strategy: "MAXLEN" | "MINID";
        exactness?: "~" | "=";
        threshold: number | string;
        limit?: number;
    }) => Pipeline<[...TCommands, Command<any, number>]>;
    /**
     * @see https://redis.io/commands/xrange
     */
    xrange: (key: string, start: string, end: string, count?: number | undefined) => Pipeline<[...TCommands, Command<any, Record<string, Record<string, unknown>>>]>;
    /**
     * @see https://redis.io/commands/xrevrange
     */
    xrevrange: (key: string, end: string, start: string, count?: number | undefined) => Pipeline<[...TCommands, Command<any, Record<string, Record<string, unknown>>>]>;
    /**
     * @see https://redis.io/commands/zcard
     */
    zcard: (key: string) => Pipeline<[...TCommands, Command<any, number>]>;
    /**
     * @see https://redis.io/commands/zcount
     */
    zcount: (key: string, min: string | number, max: string | number) => Pipeline<[...TCommands, Command<any, number>]>;
    /**
     * @see https://redis.io/commands/zincrby
     */
    zincrby: <TData>(key: string, increment: number, member: TData) => Pipeline<[...TCommands, Command<any, number>]>;
    /**
     * @see https://redis.io/commands/zinterstore
     */
    zinterstore: (destination: string, numKeys: number, keys: string[], opts?: ZInterStoreCommandOptions | undefined) => Pipeline<[...TCommands, Command<any, number>]>;
    /**
     * @see https://redis.io/commands/zlexcount
     */
    zlexcount: (key: string, min: string, max: string) => Pipeline<[...TCommands, Command<any, number>]>;
    /**
     * @see https://redis.io/commands/zmscore
     */
    zmscore: (key: string, members: unknown[]) => Pipeline<[...TCommands, Command<any, number[] | null>]>;
    /**
     * @see https://redis.io/commands/zpopmax
     */
    zpopmax: <TData>(key: string, count?: number | undefined) => Pipeline<[...TCommands, Command<any, TData[]>]>;
    /**
     * @see https://redis.io/commands/zpopmin
     */
    zpopmin: <TData>(key: string, count?: number | undefined) => Pipeline<[...TCommands, Command<any, TData[]>]>;
    /**
     * @see https://redis.io/commands/zrange
     */
    zrange: <TData extends unknown[]>(...args: [key: string, min: number, max: number, opts?: ZRangeCommandOptions] | [key: string, min: `(${string}` | `[${string}` | "-" | "+", max: `(${string}` | `[${string}` | "-" | "+", opts: {
        byLex: true;
    } & ZRangeCommandOptions] | [key: string, min: number | `(${number}` | "-inf" | "+inf", max: number | `(${number}` | "-inf" | "+inf", opts: {
        byScore: true;
    } & ZRangeCommandOptions]) => Pipeline<[...TCommands, Command<any, TData>]>;
    /**
     * @see https://redis.io/commands/zrank
     */
    zrank: <TData>(key: string, member: TData) => Pipeline<[...TCommands, Command<any, number | null>]>;
    /**
     * @see https://redis.io/commands/zrem
     */
    zrem: <TData>(key: string, ...members: TData[]) => Pipeline<[...TCommands, Command<any, number>]>;
    /**
     * @see https://redis.io/commands/zremrangebylex
     */
    zremrangebylex: (key: string, min: string, max: string) => Pipeline<[...TCommands, Command<any, number>]>;
    /**
     * @see https://redis.io/commands/zremrangebyrank
     */
    zremrangebyrank: (key: string, start: number, stop: number) => Pipeline<[...TCommands, Command<any, number>]>;
    /**
     * @see https://redis.io/commands/zremrangebyscore
     */
    zremrangebyscore: (key: string, min: number, max: number) => Pipeline<[...TCommands, Command<any, number>]>;
    /**
     * @see https://redis.io/commands/zrevrank
     */
    zrevrank: <TData>(key: string, member: TData) => Pipeline<[...TCommands, Command<any, number | null>]>;
    /**
     * @see https://redis.io/commands/zscan
     */
    zscan: (key: string, cursor: string | number, opts?: ScanCommandOptions | undefined) => Pipeline<[...TCommands, Command<any, [string, (string | number)[]]>]>;
    /**
     * @see https://redis.io/commands/zscore
     */
    zscore: <TData>(key: string, member: TData) => Pipeline<[...TCommands, Command<any, number | null>]>;
    /**
     * @see https://redis.io/commands/zunionstore
     */
    zunionstore: (destination: string, numKeys: number, keys: string[], opts?: ZUnionStoreCommandOptions | undefined) => Pipeline<[...TCommands, Command<any, number>]>;
    /**
     * @see https://redis.io/commands/zunion
     */
    zunion: (numKeys: number, keys: string[], opts?: ZUnionCommandOptions | undefined) => Pipeline<[...TCommands, Command<any, any>]>;
    /**
     * @see https://redis.io/commands/?group=json
     */
    get json(): {
        /**
         * @see https://redis.io/commands/json.arrappend
         */
        arrappend: (key: string, path: string, ...values: unknown[]) => Pipeline<[...TCommands, Command<any, (number | null)[]>]>;
        /**
         * @see https://redis.io/commands/json.arrindex
         */
        arrindex: (key: string, path: string, value: unknown, start?: number | undefined, stop?: number | undefined) => Pipeline<[...TCommands, Command<any, (number | null)[]>]>;
        /**
         * @see https://redis.io/commands/json.arrinsert
         */
        arrinsert: (key: string, path: string, index: number, ...values: unknown[]) => Pipeline<[...TCommands, Command<any, (number | null)[]>]>;
        /**
         * @see https://redis.io/commands/json.arrlen
         */
        arrlen: (key: string, path?: string | undefined) => Pipeline<[...TCommands, Command<any, (number | null)[]>]>;
        /**
         * @see https://redis.io/commands/json.arrpop
         */
        arrpop: (key: string, path?: string | undefined, index?: number | undefined) => Pipeline<[...TCommands, Command<any, unknown[]>]>;
        /**
         * @see https://redis.io/commands/json.arrtrim
         */
        arrtrim: (key: string, path?: string | undefined, start?: number | undefined, stop?: number | undefined) => Pipeline<[...TCommands, Command<any, (number | null)[]>]>;
        /**
         * @see https://redis.io/commands/json.clear
         */
        clear: (key: string, path?: string | undefined) => Pipeline<[...TCommands, Command<any, number>]>;
        /**
         * @see https://redis.io/commands/json.del
         */
        del: (key: string, path?: string | undefined) => Pipeline<[...TCommands, Command<any, number>]>;
        /**
         * @see https://redis.io/commands/json.forget
         */
        forget: (key: string, path?: string | undefined) => Pipeline<[...TCommands, Command<any, number>]>;
        /**
         * @see https://redis.io/commands/json.get
         */
        get: (...args: CommandArgs<typeof JsonGetCommand>) => Pipeline<[...TCommands, Command<any, any>]>;
        /**
         * @see https://redis.io/commands/json.merge
         */
        merge: (key: string, path: string, value: string | number | unknown[] | Record<string, unknown>) => Pipeline<[...TCommands, Command<any, "OK" | null>]>;
        /**
         * @see https://redis.io/commands/json.mget
         */
        mget: (keys: string[], path: string) => Pipeline<[...TCommands, Command<any, any>]>;
        /**
         * @see https://redis.io/commands/json.mset
         */
        mset: (...args: CommandArgs<typeof JsonMSetCommand>) => Pipeline<[...TCommands, Command<any, "OK" | null>]>;
        /**
         * @see https://redis.io/commands/json.numincrby
         */
        numincrby: (key: string, path: string, value: number) => Pipeline<[...TCommands, Command<any, (number | null)[]>]>;
        /**
         * @see https://redis.io/commands/json.nummultby
         */
        nummultby: (key: string, path: string, value: number) => Pipeline<[...TCommands, Command<any, (number | null)[]>]>;
        /**
         * @see https://redis.io/commands/json.objkeys
         */
        objkeys: (key: string, path?: string | undefined) => Pipeline<[...TCommands, Command<any, (string[] | null)[]>]>;
        /**
         * @see https://redis.io/commands/json.objlen
         */
        objlen: (key: string, path?: string | undefined) => Pipeline<[...TCommands, Command<any, (number | null)[]>]>;
        /**
         * @see https://redis.io/commands/json.resp
         */
        resp: (key: string, path?: string | undefined) => Pipeline<[...TCommands, Command<any, any>]>;
        /**
         * @see https://redis.io/commands/json.set
         */
        set: (key: string, path: string, value: string | number | boolean | Record<string, unknown> | (string | number | boolean | Record<string, unknown>)[], opts?: {
            nx: true;
            xx?: never;
        } | {
            nx?: never;
            xx: true;
        } | undefined) => Pipeline<[...TCommands, Command<any, "OK" | null>]>;
        /**
         * @see https://redis.io/commands/json.strappend
         */
        strappend: (key: string, path: string, value: string) => Pipeline<[...TCommands, Command<any, (number | null)[]>]>;
        /**
         * @see https://redis.io/commands/json.strlen
         */
        strlen: (key: string, path?: string | undefined) => Pipeline<[...TCommands, Command<any, (number | null)[]>]>;
        /**
         * @see https://redis.io/commands/json.toggle
         */
        toggle: (key: string, path: string) => Pipeline<[...TCommands, Command<any, number[]>]>;
        /**
         * @see https://redis.io/commands/json.type
         */
        type: (key: string, path?: string | undefined) => Pipeline<[...TCommands, Command<any, string[]>]>;
    };
}

/**
 * Creates a new script.
 *
 * Scripts offer the ability to optimistically try to execute a script without having to send the
 * entire script to the server. If the script is loaded on the server, it tries again by sending
 * the entire script. Afterwards, the script is cached on the server.
 *
 * @example
 * ```ts
 * const redis = new Redis({...})
 *
 * const script = redis.createScript<string>("return ARGV[1];")
 * const arg1 = await script.eval([], ["Hello World"])
 * expect(arg1, "Hello World")
 * ```
 */
declare class Script<TResult = unknown> {
    readonly script: string;
    /**
     * @deprecated This property is initialized to an empty string and will be set in the init method
     * asynchronously. Do not use this property immidiately after the constructor.
     *
     * This property is only exposed for backwards compatibility and will be removed in the
     * future major release.
     */
    sha1: string;
    private readonly redis;
    constructor(redis: Redis, script: string);
    /**
     * Initialize the script by computing its SHA-1 hash.
     */
    private init;
    /**
     * Send an `EVAL` command to redis.
     */
    eval(keys: string[], args: string[]): Promise<TResult>;
    /**
     * Calculates the sha1 hash of the script and then calls `EVALSHA`.
     */
    evalsha(keys: string[], args: string[]): Promise<TResult>;
    /**
     * Optimistically try to run `EVALSHA` first.
     * If the script is not loaded in redis, it will fall back and try again with `EVAL`.
     *
     * Following calls will be able to use the cached script
     */
    exec(keys: string[], args: string[]): Promise<TResult>;
    /**
     * Compute the sha1 hash of the script and return its hex representation.
     */
    private digest;
}

/**
 * Creates a new script.
 *
 * Scripts offer the ability to optimistically try to execute a script without having to send the
 * entire script to the server. If the script is loaded on the server, it tries again by sending
 * the entire script. Afterwards, the script is cached on the server.
 *
 * @example
 * ```ts
 * const redis = new Redis({...})
 *
 * const script = redis.createScript<string>("return ARGV[1];", { readOnly: true })
 * const arg1 = await script.evalRo([], ["Hello World"])
 * expect(arg1, "Hello World")
 * ```
 */
declare class ScriptRO<TResult = unknown> {
    readonly script: string;
    /**
     * @deprecated This property is initialized to an empty string and will be set in the init method
     * asynchronously. Do not use this property immidiately after the constructor.
     *
     * This property is only exposed for backwards compatibility and will be removed in the
     * future major release.
     */
    sha1: string;
    private readonly redis;
    constructor(redis: Redis, script: string);
    private init;
    /**
     * Send an `EVAL_RO` command to redis.
     */
    evalRo(keys: string[], args: string[]): Promise<TResult>;
    /**
     * Calculates the sha1 hash of the script and then calls `EVALSHA_RO`.
     */
    evalshaRo(keys: string[], args: string[]): Promise<TResult>;
    /**
     * Optimistically try to run `EVALSHA_RO` first.
     * If the script is not loaded in redis, it will fall back and try again with `EVAL_RO`.
     *
     * Following calls will be able to use the cached script
     */
    exec(keys: string[], args: string[]): Promise<TResult>;
    /**
     * Compute the sha1 hash of the script and return its hex representation.
     */
    private digest;
}

/**
 * Serverless redis client for upstash.
 */
declare class Redis {
    protected client: Requester;
    protected opts?: CommandOptions<any, any>;
    protected enableTelemetry: boolean;
    protected enableAutoPipelining: boolean;
    /**
     * Create a new redis client
     *
     * @example
     * ```typescript
     * const redis = new Redis({
     *  url: "<UPSTASH_REDIS_REST_URL>",
     *  token: "<UPSTASH_REDIS_REST_TOKEN>",
     * });
     * ```
     */
    constructor(client: Requester, opts?: RedisOptions);
    get readYourWritesSyncToken(): string | undefined;
    set readYourWritesSyncToken(session: string | undefined);
    get json(): {
        /**
         * @see https://redis.io/commands/json.arrappend
         */
        arrappend: (key: string, path: string, ...values: unknown[]) => Promise<(number | null)[]>;
        /**
         * @see https://redis.io/commands/json.arrindex
         */
        arrindex: (key: string, path: string, value: unknown, start?: number | undefined, stop?: number | undefined) => Promise<(number | null)[]>;
        /**
         * @see https://redis.io/commands/json.arrinsert
         */
        arrinsert: (key: string, path: string, index: number, ...values: unknown[]) => Promise<(number | null)[]>;
        /**
         * @see https://redis.io/commands/json.arrlen
         */
        arrlen: (key: string, path?: string | undefined) => Promise<(number | null)[]>;
        /**
         * @see https://redis.io/commands/json.arrpop
         */
        arrpop: (key: string, path?: string | undefined, index?: number | undefined) => Promise<unknown[]>;
        /**
         * @see https://redis.io/commands/json.arrtrim
         */
        arrtrim: (key: string, path?: string | undefined, start?: number | undefined, stop?: number | undefined) => Promise<(number | null)[]>;
        /**
         * @see https://redis.io/commands/json.clear
         */
        clear: (key: string, path?: string | undefined) => Promise<number>;
        /**
         * @see https://redis.io/commands/json.del
         */
        del: (key: string, path?: string | undefined) => Promise<number>;
        /**
         * @see https://redis.io/commands/json.forget
         */
        forget: (key: string, path?: string | undefined) => Promise<number>;
        /**
         * @see https://redis.io/commands/json.get
         */
        get: <TData>(...args: CommandArgs<typeof JsonGetCommand>) => Promise<TData | null>;
        /**
         * @see https://redis.io/commands/json.merge
         */
        merge: (key: string, path: string, value: string | number | unknown[] | Record<string, unknown>) => Promise<"OK" | null>;
        /**
         * @see https://redis.io/commands/json.mget
         */
        mget: <TData>(keys: string[], path: string) => Promise<TData>;
        /**
         * @see https://redis.io/commands/json.mset
         */
        mset: (...args: CommandArgs<typeof JsonMSetCommand>) => Promise<"OK" | null>;
        /**
         * @see https://redis.io/commands/json.numincrby
         */
        numincrby: (key: string, path: string, value: number) => Promise<(number | null)[]>;
        /**
         * @see https://redis.io/commands/json.nummultby
         */
        nummultby: (key: string, path: string, value: number) => Promise<(number | null)[]>;
        /**
         * @see https://redis.io/commands/json.objkeys
         */
        objkeys: (key: string, path?: string | undefined) => Promise<(string[] | null)[]>;
        /**
         * @see https://redis.io/commands/json.objlen
         */
        objlen: (key: string, path?: string | undefined) => Promise<(number | null)[]>;
        /**
         * @see https://redis.io/commands/json.resp
         */
        resp: (key: string, path?: string | undefined) => Promise<any>;
        /**
         * @see https://redis.io/commands/json.set
         */
        set: (key: string, path: string, value: string | number | boolean | Record<string, unknown> | (string | number | boolean | Record<string, unknown>)[], opts?: {
            nx: true;
            xx?: never;
        } | {
            nx?: never;
            xx: true;
        } | undefined) => Promise<"OK" | null>;
        /**
         * @see https://redis.io/commands/json.strappend
         */
        strappend: (key: string, path: string, value: string) => Promise<(number | null)[]>;
        /**
         * @see https://redis.io/commands/json.strlen
         */
        strlen: (key: string, path?: string | undefined) => Promise<(number | null)[]>;
        /**
         * @see https://redis.io/commands/json.toggle
         */
        toggle: (key: string, path: string) => Promise<number[]>;
        /**
         * @see https://redis.io/commands/json.type
         */
        type: (key: string, path?: string | undefined) => Promise<string[]>;
    };
    /**
     * Wrap a new middleware around the HTTP client.
     */
    use: <TResult = unknown>(middleware: (r: UpstashRequest, next: <TResult_1 = unknown>(req: UpstashRequest) => Promise<UpstashResponse<TResult_1>>) => Promise<UpstashResponse<TResult>>) => void;
    /**
     * Technically this is not private, we can hide it from intellisense by doing this
     */
    protected addTelemetry: (telemetry: Telemetry) => void;
    /**
     * Creates a new script.
     *
     * Scripts offer the ability to optimistically try to execute a script without having to send the
     * entire script to the server. If the script is loaded on the server, it tries again by sending
     * the entire script. Afterwards, the script is cached on the server.
     *
     * @param script - The script to create
     * @param opts - Optional options to pass to the script `{ readonly?: boolean }`
     * @returns A new script
     *
     * @example
     * ```ts
     * const redis = new Redis({...})
     *
     * const script = redis.createScript<string>("return ARGV[1];")
     * const arg1 = await script.eval([], ["Hello World"])
     * expect(arg1, "Hello World")
     * ```
     * @example
     * ```ts
     * const redis = new Redis({...})
     *
     * const script = redis.createScript<string>("return ARGV[1];", { readonly: true })
     * const arg1 = await script.evalRo([], ["Hello World"])
     * expect(arg1, "Hello World")
     * ```
     */
    createScript<TResult = unknown, TReadonly extends boolean = false>(script: string, opts?: {
        readonly?: TReadonly;
    }): TReadonly extends true ? ScriptRO<TResult> : Script<TResult>;
    /**
     * Create a new pipeline that allows you to send requests in bulk.
     *
     * @see {@link Pipeline}
     */
    pipeline: () => Pipeline<[]>;
    protected autoPipeline: () => Redis;
    /**
     * Create a new transaction to allow executing multiple steps atomically.
     *
     * All the commands in a transaction are serialized and executed sequentially. A request sent by
     * another client will never be served in the middle of the execution of a Redis Transaction. This
     * guarantees that the commands are executed as a single isolated operation.
     *
     * @see {@link Pipeline}
     */
    multi: () => Pipeline<[]>;
    /**
     * Returns an instance that can be used to execute `BITFIELD` commands on one key.
     *
     * @example
     * ```typescript
     * redis.set("mykey", 0);
     * const result = await redis.bitfield("mykey")
     *   .set("u4", 0, 16)
     *   .incr("u4", "#1", 1)
     *   .exec();
     * console.log(result); // [0, 1]
     * ```
     *
     * @see https://redis.io/commands/bitfield
     */
    bitfield: (key: string) => BitFieldCommand<Promise<number[]>>;
    /**
     * @see https://redis.io/commands/append
     */
    append: (key: string, value: string) => Promise<number>;
    /**
     * @see https://redis.io/commands/bitcount
     */
    bitcount: (key: string, start: number, end: number) => Promise<number>;
    /**
     * @see https://redis.io/commands/bitop
     */
    bitop: {
        (op: "and" | "or" | "xor", destinationKey: string, sourceKey: string, ...sourceKeys: string[]): Promise<number>;
        (op: "not", destinationKey: string, sourceKey: string): Promise<number>;
    };
    /**
     * @see https://redis.io/commands/bitpos
     */
    bitpos: (key: string, bit: 0 | 1, start?: number | undefined, end?: number | undefined) => Promise<number>;
    /**
     * @see https://redis.io/commands/copy
     */
    copy: (key: string, destinationKey: string, opts?: {
        replace: boolean;
    } | undefined) => Promise<"COPIED" | "NOT_COPIED">;
    /**
     * @see https://redis.io/commands/dbsize
     */
    dbsize: () => Promise<number>;
    /**
     * @see https://redis.io/commands/decr
     */
    decr: (key: string) => Promise<number>;
    /**
     * @see https://redis.io/commands/decrby
     */
    decrby: (key: string, decrement: number) => Promise<number>;
    /**
     * @see https://redis.io/commands/del
     */
    del: (...args: CommandArgs<typeof DelCommand>) => Promise<number>;
    /**
     * @see https://redis.io/commands/echo
     */
    echo: (message: string) => Promise<string>;
    /**
     * @see https://redis.io/commands/eval_ro
     */
    evalRo: <TArgs extends unknown[], TData = unknown>(script: string, keys: string[], args: TArgs) => Promise<TData>;
    /**
     * @see https://redis.io/commands/eval
     */
    eval: <TArgs extends unknown[], TData = unknown>(script: string, keys: string[], args: TArgs) => Promise<TData>;
    /**
     * @see https://redis.io/commands/evalsha_ro
     */
    evalshaRo: <TArgs extends unknown[], TData = unknown>(sha1: string, keys: string[], args: TArgs) => Promise<TData>;
    /**
     * @see https://redis.io/commands/evalsha
     */
    evalsha: <TArgs extends unknown[], TData = unknown>(sha1: string, keys: string[], args: TArgs) => Promise<TData>;
    /**
     * Generic method to execute any Redis command.
     */
    exec: <TResult>(args: [command: string, ...args: (string | number | boolean)[]]) => Promise<TResult>;
    /**
     * @see https://redis.io/commands/exists
     */
    exists: (...args: CommandArgs<typeof ExistsCommand>) => Promise<number>;
    /**
     * @see https://redis.io/commands/expire
     */
    expire: (key: string, seconds: number, option?: ExpireOption | undefined) => Promise<0 | 1>;
    /**
     * @see https://redis.io/commands/expireat
     */
    expireat: (key: string, unix: number, option?: ExpireOption | undefined) => Promise<0 | 1>;
    /**
     * @see https://redis.io/commands/flushall
     */
    flushall: (args?: CommandArgs<typeof FlushAllCommand>) => Promise<"OK">;
    /**
     * @see https://redis.io/commands/flushdb
     */
    flushdb: (opts?: {
        async?: boolean;
    } | undefined) => Promise<"OK">;
    /**
     * @see https://redis.io/commands/geoadd
     */
    geoadd: <TData>(args_0: string, args_1: GeoAddCommandOptions | GeoMember<TData>, ...args_2: GeoMember<TData>[]) => Promise<number | null>;
    /**
     * @see https://redis.io/commands/geopos
     */
    geopos: <TData>(args_0: string, ...args_1: TData[]) => Promise<{
        lng: number;
        lat: number;
    }[]>;
    /**
     * @see https://redis.io/commands/geodist
     */
    geodist: <TData>(key: string, member1: TData, member2: TData, unit?: "M" | "KM" | "FT" | "MI" | undefined) => Promise<number | null>;
    /**
     * @see https://redis.io/commands/geohash
     */
    geohash: <TData>(args_0: string, ...args_1: TData[]) => Promise<(string | null)[]>;
    /**
     * @see https://redis.io/commands/geosearch
     */
    geosearch: <TData>(key: string, centerPoint: {
        type: "FROMLONLAT" | "fromlonlat";
        coordinate: {
            lon: number;
            lat: number;
        };
    } | {
        type: "FROMMEMBER" | "frommember";
        member: TData;
    }, shape: {
        type: "BYRADIUS" | "byradius";
        radius: number;
        radiusType: "M" | "KM" | "FT" | "MI";
    } | {
        type: "BYBOX" | "bybox";
        rect: {
            width: number;
            height: number;
        };
        rectType: "M" | "KM" | "FT" | "MI";
    }, order: "ASC" | "DESC" | "asc" | "desc", opts?: {
        count?: {
            limit: number;
            any?: boolean;
        };
        withCoord?: boolean;
        withDist?: boolean;
        withHash?: boolean;
    } | undefined) => Promise<({
        member: TData;
    } & {
        coord?: {
            long: number;
            lat: number;
        } | undefined;
        dist?: number | undefined;
        hash?: string | undefined;
    })[]>;
    /**
     * @see https://redis.io/commands/geosearchstore
     */
    geosearchstore: <TData>(destination: string, key: string, centerPoint: {
        type: "FROMLONLAT" | "fromlonlat";
        coordinate: {
            lon: number;
            lat: number;
        };
    } | {
        type: "FROMMEMBER" | "frommember";
        member: TData;
    }, shape: {
        type: "BYRADIUS" | "byradius";
        radius: number;
        radiusType: "M" | "KM" | "FT" | "MI";
    } | {
        type: "BYBOX" | "bybox";
        rect: {
            width: number;
            height: number;
        };
        rectType: "M" | "KM" | "FT" | "MI";
    }, order: "ASC" | "DESC" | "asc" | "desc", opts?: {
        count?: {
            limit: number;
            any?: boolean;
        };
        storeDist?: boolean;
    } | undefined) => Promise<number>;
    /**
     * @see https://redis.io/commands/get
     */
    get: <TData>(key: string) => Promise<TData | null>;
    /**
     * @see https://redis.io/commands/getbit
     */
    getbit: (key: string, offset: number) => Promise<0 | 1>;
    /**
     * @see https://redis.io/commands/getdel
     */
    getdel: <TData>(key: string) => Promise<TData | null>;
    /**
     * @see https://redis.io/commands/getex
     */
    getex: <TData>(key: string, opts?: ({
        ex: number;
        px?: never;
        exat?: never;
        pxat?: never;
        persist?: never;
    } | {
        ex?: never;
        px: number;
        exat?: never;
        pxat?: never;
        persist?: never;
    } | {
        ex?: never;
        px?: never;
        exat: number;
        pxat?: never;
        persist?: never;
    } | {
        ex?: never;
        px?: never;
        exat?: never;
        pxat: number;
        persist?: never;
    } | {
        ex?: never;
        px?: never;
        exat?: never;
        pxat?: never;
        persist: true;
    } | {
        ex?: never;
        px?: never;
        exat?: never;
        pxat?: never;
        persist?: never;
    }) | undefined) => Promise<TData | null>;
    /**
     * @see https://redis.io/commands/getrange
     */
    getrange: (key: string, start: number, end: number) => Promise<string>;
    /**
     * @see https://redis.io/commands/getset
     */
    getset: <TData>(key: string, value: TData) => Promise<TData | null>;
    /**
     * @see https://redis.io/commands/hdel
     */
    hdel: (key: string, ...fields: string[]) => Promise<0 | 1>;
    /**
     * @see https://redis.io/commands/hexists
     */
    hexists: (key: string, field: string) => Promise<number>;
    /**
     * @see https://redis.io/commands/hexpire
     */
    hexpire: (key: string, fields: string | number | (string | number)[], seconds: number, option?: ExpireOption | undefined) => Promise<(0 | 1 | 2 | -2)[]>;
    /**
     * @see https://redis.io/commands/hexpireat
     */
    hexpireat: (key: string, fields: string | number | (string | number)[], timestamp: number, option?: ExpireOption | undefined) => Promise<(0 | 1 | 2 | -2)[]>;
    /**
     * @see https://redis.io/commands/hexpiretime
     */
    hexpiretime: (key: string, fields: string | number | (string | number)[]) => Promise<number[]>;
    /**
     * @see https://redis.io/commands/httl
     */
    httl: (key: string, fields: string | number | (string | number)[]) => Promise<number[]>;
    /**
     * @see https://redis.io/commands/hpexpire
     */
    hpexpire: (key: string, fields: string | number | (string | number)[], milliseconds: number, option?: ExpireOption | undefined) => Promise<(0 | 1 | 2 | -2)[]>;
    /**
     * @see https://redis.io/commands/hpexpireat
     */
    hpexpireat: (key: string, fields: string | number | (string | number)[], timestamp: number, option?: ExpireOption | undefined) => Promise<(0 | 1 | 2 | -2)[]>;
    /**
     * @see https://redis.io/commands/hpexpiretime
     */
    hpexpiretime: (key: string, fields: string | number | (string | number)[]) => Promise<number[]>;
    /**
     * @see https://redis.io/commands/hpttl
     */
    hpttl: (key: string, fields: string | number | (string | number)[]) => Promise<number[]>;
    /**
     * @see https://redis.io/commands/hpersist
     */
    hpersist: (key: string, fields: string | number | (string | number)[]) => Promise<(1 | -2 | -1)[]>;
    /**
     * @see https://redis.io/commands/hget
     */
    hget: <TData>(key: string, field: string) => Promise<TData | null>;
    /**
     * @see https://redis.io/commands/hgetall
     */
    hgetall: <TData extends Record<string, unknown>>(key: string) => Promise<TData | null>;
    /**
     * @see https://redis.io/commands/hincrby
     */
    hincrby: (key: string, field: string, increment: number) => Promise<number>;
    /**
     * @see https://redis.io/commands/hincrbyfloat
     */
    hincrbyfloat: (key: string, field: string, increment: number) => Promise<number>;
    /**
     * @see https://redis.io/commands/hkeys
     */
    hkeys: (key: string) => Promise<string[]>;
    /**
     * @see https://redis.io/commands/hlen
     */
    hlen: (key: string) => Promise<number>;
    /**
     * @see https://redis.io/commands/hmget
     */
    hmget: <TData extends Record<string, unknown>>(key: string, ...fields: string[]) => Promise<TData | null>;
    /**
     * @see https://redis.io/commands/hmset
     */
    hmset: <TData>(key: string, kv: Record<string, TData>) => Promise<"OK">;
    /**
     * @see https://redis.io/commands/hrandfield
     */
    hrandfield: {
        (key: string): Promise<string | null>;
        (key: string, count: number): Promise<string[]>;
        <TData extends Record<string, unknown>>(key: string, count: number, withValues: boolean): Promise<Partial<TData>>;
    };
    /**
     * @see https://redis.io/commands/hscan
     */
    hscan: (key: string, cursor: string | number, cmdOpts?: ScanCommandOptions | undefined) => Promise<[string, (string | number)[]]>;
    /**
     * @see https://redis.io/commands/hset
     */
    hset: <TData>(key: string, kv: Record<string, TData>) => Promise<number>;
    /**
     * @see https://redis.io/commands/hsetnx
     */
    hsetnx: <TData>(key: string, field: string, value: TData) => Promise<0 | 1>;
    /**
     * @see https://redis.io/commands/hstrlen
     */
    hstrlen: (key: string, field: string) => Promise<number>;
    /**
     * @see https://redis.io/commands/hvals
     */
    hvals: (key: string) => Promise<any>;
    /**
     * @see https://redis.io/commands/incr
     */
    incr: (key: string) => Promise<number>;
    /**
     * @see https://redis.io/commands/incrby
     */
    incrby: (key: string, value: number) => Promise<number>;
    /**
     * @see https://redis.io/commands/incrbyfloat
     */
    incrbyfloat: (key: string, value: number) => Promise<number>;
    /**
     * @see https://redis.io/commands/keys
     */
    keys: (pattern: string) => Promise<string[]>;
    /**
     * @see https://redis.io/commands/lindex
     */
    lindex: (key: string, index: number) => Promise<any>;
    /**
     * @see https://redis.io/commands/linsert
     */
    linsert: <TData>(key: string, direction: "before" | "after", pivot: TData, value: TData) => Promise<number>;
    /**
     * @see https://redis.io/commands/llen
     */
    llen: (key: string) => Promise<number>;
    /**
     * @see https://redis.io/commands/lmove
     */
    lmove: <TData = string>(source: string, destination: string, whereFrom: "left" | "right", whereTo: "left" | "right") => Promise<TData>;
    /**
     * @see https://redis.io/commands/lpop
     */
    lpop: <TData>(key: string, count?: number | undefined) => Promise<TData | null>;
    /**
     * @see https://redis.io/commands/lmpop
     */
    lmpop: <TData>(numkeys: number, keys: string[], args_2: "LEFT" | "RIGHT", count?: number | undefined) => Promise<[string, TData[]] | null>;
    /**
     * @see https://redis.io/commands/lpos
     */
    lpos: <TData = number>(key: string, element: unknown, opts?: {
        rank?: number;
        count?: number;
        maxLen?: number;
    } | undefined) => Promise<TData>;
    /**
     * @see https://redis.io/commands/lpush
     */
    lpush: <TData>(key: string, ...elements: TData[]) => Promise<number>;
    /**
     * @see https://redis.io/commands/lpushx
     */
    lpushx: <TData>(key: string, ...elements: TData[]) => Promise<number>;
    /**
     * @see https://redis.io/commands/lrange
     */
    lrange: <TResult = string>(key: string, start: number, end: number) => Promise<TResult[]>;
    /**
     * @see https://redis.io/commands/lrem
     */
    lrem: <TData>(key: string, count: number, value: TData) => Promise<number>;
    /**
     * @see https://redis.io/commands/lset
     */
    lset: <TData>(key: string, index: number, value: TData) => Promise<"OK">;
    /**
     * @see https://redis.io/commands/ltrim
     */
    ltrim: (key: string, start: number, end: number) => Promise<"OK">;
    /**
     * @see https://redis.io/commands/mget
     */
    mget: <TData extends unknown[]>(...args: CommandArgs<typeof MGetCommand>) => Promise<TData>;
    /**
     * @see https://redis.io/commands/mset
     */
    mset: <TData>(kv: Record<string, TData>) => Promise<"OK">;
    /**
     * @see https://redis.io/commands/msetnx
     */
    msetnx: <TData>(kv: Record<string, TData>) => Promise<number>;
    /**
     * @see https://redis.io/commands/persist
     */
    persist: (key: string) => Promise<0 | 1>;
    /**
     * @see https://redis.io/commands/pexpire
     */
    pexpire: (key: string, milliseconds: number, option?: ExpireOption | undefined) => Promise<0 | 1>;
    /**
     * @see https://redis.io/commands/pexpireat
     */
    pexpireat: (key: string, unix: number, option?: ExpireOption | undefined) => Promise<0 | 1>;
    /**
     * @see https://redis.io/commands/pfadd
     */
    pfadd: (args_0: string, ...args_1: unknown[]) => Promise<number>;
    /**
     * @see https://redis.io/commands/pfcount
     */
    pfcount: (args_0: string, ...args_1: string[]) => Promise<number>;
    /**
     * @see https://redis.io/commands/pfmerge
     */
    pfmerge: (destination_key: string, ...args_1: string[]) => Promise<"OK">;
    /**
     * @see https://redis.io/commands/ping
     */
    ping: (args?: CommandArgs<typeof PingCommand>) => Promise<string>;
    /**
     * @see https://redis.io/commands/psetex
     */
    psetex: <TData>(key: string, ttl: number, value: TData) => Promise<string>;
    /**
     * @see https://redis.io/commands/psubscribe
     */
    psubscribe: <TMessage>(patterns: string | string[]) => Subscriber<TMessage>;
    /**
     * @see https://redis.io/commands/pttl
     */
    pttl: (key: string) => Promise<number>;
    /**
     * @see https://redis.io/commands/publish
     */
    publish: (channel: string, message: unknown) => Promise<number>;
    /**
     * @see https://redis.io/commands/randomkey
     */
    randomkey: () => Promise<string | null>;
    /**
     * @see https://redis.io/commands/rename
     */
    rename: (source: string, destination: string) => Promise<"OK">;
    /**
     * @see https://redis.io/commands/renamenx
     */
    renamenx: (source: string, destination: string) => Promise<0 | 1>;
    /**
     * @see https://redis.io/commands/rpop
     */
    rpop: <TData = string>(key: string, count?: number | undefined) => Promise<TData | null>;
    /**
     * @see https://redis.io/commands/rpush
     */
    rpush: <TData>(key: string, ...elements: TData[]) => Promise<number>;
    /**
     * @see https://redis.io/commands/rpushx
     */
    rpushx: <TData>(key: string, ...elements: TData[]) => Promise<number>;
    /**
     * @see https://redis.io/commands/sadd
     */
    sadd: <TData>(key: string, member: TData, ...members: TData[]) => Promise<number>;
    /**
     * @see https://redis.io/commands/scan
     */
    scan(cursor: string | number): Promise<ScanResultStandard>;
    scan<TOptions extends ScanCommandOptions>(cursor: string | number, opts: TOptions): Promise<TOptions extends {
        withType: true;
    } ? ScanResultWithType : ScanResultStandard>;
    /**
     * @see https://redis.io/commands/scard
     */
    scard: (key: string) => Promise<number>;
    /**
     * @see https://redis.io/commands/script-exists
     */
    scriptExists: (...args: CommandArgs<typeof ScriptExistsCommand>) => Promise<number[]>;
    /**
     * @see https://redis.io/commands/script-flush
     */
    scriptFlush: (opts?: ScriptFlushCommandOptions | undefined) => Promise<"OK">;
    /**
     * @see https://redis.io/commands/script-load
     */
    scriptLoad: (script: string) => Promise<string>;
    /**
     * @see https://redis.io/commands/sdiff
     */
    sdiff: (key: string, ...keys: string[]) => Promise<unknown[]>;
    /**
     * @see https://redis.io/commands/sdiffstore
     */
    sdiffstore: (destination: string, ...keys: string[]) => Promise<number>;
    /**
     * @see https://redis.io/commands/set
     */
    set: <TData>(key: string, value: TData, opts?: SetCommandOptions) => Promise<"OK" | TData | null>;
    /**
     * @see https://redis.io/commands/setbit
     */
    setbit: (key: string, offset: number, value: 0 | 1) => Promise<0 | 1>;
    /**
     * @see https://redis.io/commands/setex
     */
    setex: <TData>(key: string, ttl: number, value: TData) => Promise<"OK">;
    /**
     * @see https://redis.io/commands/setnx
     */
    setnx: <TData>(key: string, value: TData) => Promise<number>;
    /**
     * @see https://redis.io/commands/setrange
     */
    setrange: (key: string, offset: number, value: string) => Promise<number>;
    /**
     * @see https://redis.io/commands/sinter
     */
    sinter: (key: string, ...keys: string[]) => Promise<string[]>;
    /**
     * @see https://redis.io/commands/sinterstore
     */
    sinterstore: (destination: string, key: string, ...keys: string[]) => Promise<number>;
    /**
     * @see https://redis.io/commands/sismember
     */
    sismember: <TData>(key: string, member: TData) => Promise<0 | 1>;
    /**
     * @see https://redis.io/commands/smismember
     */
    smismember: <TMembers extends unknown[]>(key: string, members: TMembers) => Promise<(0 | 1)[]>;
    /**
     * @see https://redis.io/commands/smembers
     */
    smembers: <TData extends unknown[] = string[]>(key: string) => Promise<TData>;
    /**
     * @see https://redis.io/commands/smove
     */
    smove: <TData>(source: string, destination: string, member: TData) => Promise<0 | 1>;
    /**
     * @see https://redis.io/commands/spop
     */
    spop: <TData>(key: string, count?: number | undefined) => Promise<TData | null>;
    /**
     * @see https://redis.io/commands/srandmember
     */
    srandmember: <TData>(key: string, count?: number | undefined) => Promise<TData | null>;
    /**
     * @see https://redis.io/commands/srem
     */
    srem: <TData>(key: string, ...members: TData[]) => Promise<number>;
    /**
     * @see https://redis.io/commands/sscan
     */
    sscan: (key: string, cursor: string | number, opts?: ScanCommandOptions | undefined) => Promise<[string, (string | number)[]]>;
    /**
     * @see https://redis.io/commands/strlen
     */
    strlen: (key: string) => Promise<number>;
    /**
     * @see https://redis.io/commands/subscribe
     */
    subscribe: <TMessage>(channels: string | string[]) => Subscriber<TMessage>;
    /**
     * @see https://redis.io/commands/sunion
     */
    sunion: (key: string, ...keys: string[]) => Promise<unknown[]>;
    /**
     * @see https://redis.io/commands/sunionstore
     */
    sunionstore: (destination: string, key: string, ...keys: string[]) => Promise<number>;
    /**
     * @see https://redis.io/commands/time
     */
    time: () => Promise<[number, number]>;
    /**
     * @see https://redis.io/commands/touch
     */
    touch: (...args: CommandArgs<typeof TouchCommand>) => Promise<number>;
    /**
     * @see https://redis.io/commands/ttl
     */
    ttl: (key: string) => Promise<number>;
    /**
     * @see https://redis.io/commands/type
     */
    type: (key: string) => Promise<Type>;
    /**
     * @see https://redis.io/commands/unlink
     */
    unlink: (...args: CommandArgs<typeof UnlinkCommand>) => Promise<number>;
    /**
     * @see https://redis.io/commands/xadd
     */
    xadd: (key: string, id: string, entries: Record<string, unknown>, opts?: {
        nomkStream?: boolean;
        trim?: ({
            type: "MAXLEN" | "maxlen";
            threshold: number;
        } | {
            type: "MINID" | "minid";
            threshold: string;
        }) & ({
            comparison: "~";
            limit?: number;
        } | {
            comparison: "=";
            limit?: never;
        });
    } | undefined) => Promise<string>;
    /**
     * @see https://redis.io/commands/xack
     */
    xack: (key: string, group: string, id: string | string[]) => Promise<number>;
    /**
     * @see https://redis.io/commands/xdel
     */
    xdel: (key: string, ids: string | string[]) => Promise<number>;
    /**
     * @see https://redis.io/commands/xgroup
     */
    xgroup: (key: string, opts: {
        type: "CREATE";
        group: string;
        id: `$` | string;
        options?: {
            MKSTREAM?: boolean;
            ENTRIESREAD?: number;
        };
    } | {
        type: "CREATECONSUMER";
        group: string;
        consumer: string;
    } | {
        type: "DELCONSUMER";
        group: string;
        consumer: string;
    } | {
        type: "DESTROY";
        group: string;
    } | {
        type: "SETID";
        group: string;
        id: `$` | string;
        options?: {
            ENTRIESREAD?: number;
        };
    }) => Promise<never>;
    /**
     * @see https://redis.io/commands/xread
     */
    xread: (...args: CommandArgs<typeof XReadCommand>) => Promise<unknown[]>;
    /**
     * @see https://redis.io/commands/xreadgroup
     */
    xreadgroup: (...args: CommandArgs<typeof XReadGroupCommand>) => Promise<unknown[]>;
    /**
     * @see https://redis.io/commands/xinfo
     */
    xinfo: (key: string, options: {
        type: "CONSUMERS";
        group: string;
    } | {
        type: "GROUPS";
    }) => Promise<unknown[]>;
    /**
     * @see https://redis.io/commands/xlen
     */
    xlen: (key: string) => Promise<number>;
    /**
     * @see https://redis.io/commands/xpending
     */
    xpending: (key: string, group: string, start: string, end: string, count: number, options?: {
        idleTime?: number;
        consumer?: string | string[];
    } | undefined) => Promise<unknown[]>;
    /**
     * @see https://redis.io/commands/xclaim
     */
    xclaim: (key: string, group: string, consumer: string, minIdleTime: number, id: string | string[], options?: {
        idleMS?: number;
        timeMS?: number;
        retryCount?: number;
        force?: boolean;
        justId?: boolean;
        lastId?: number;
    } | undefined) => Promise<unknown[]>;
    /**
     * @see https://redis.io/commands/xautoclaim
     */
    xautoclaim: (key: string, group: string, consumer: string, minIdleTime: number, start: string, options?: {
        count?: number;
        justId?: boolean;
    } | undefined) => Promise<unknown[]>;
    /**
     * @see https://redis.io/commands/xtrim
     */
    xtrim: (key: string, options: {
        strategy: "MAXLEN" | "MINID";
        exactness?: "~" | "=";
        threshold: number | string;
        limit?: number;
    }) => Promise<number>;
    /**
     * @see https://redis.io/commands/xrange
     */
    xrange: (key: string, start: string, end: string, count?: number | undefined) => Promise<Record<string, Record<string, unknown>>>;
    /**
     * @see https://redis.io/commands/xrevrange
     */
    xrevrange: (key: string, end: string, start: string, count?: number | undefined) => Promise<Record<string, Record<string, unknown>>>;
    /**
     * @see https://redis.io/commands/zadd
     */
    zadd: <TData>(...args: [key: string, scoreMember: ScoreMember<TData>, ...scoreMemberPairs: ScoreMember<TData>[]] | [key: string, opts: ZAddCommandOptions, ...scoreMemberPairs: [ScoreMember<TData>, ...ScoreMember<TData>[]]]) => Promise<number | null>;
    /**
     * @see https://redis.io/commands/zcard
     */
    zcard: (key: string) => Promise<number>;
    /**
     * @see https://redis.io/commands/zcount
     */
    zcount: (key: string, min: string | number, max: string | number) => Promise<number>;
    /**
     * @see https://redis.io/commands/zdiffstore
     */
    zdiffstore: (destination: string, numkeys: number, ...keys: string[]) => Promise<number>;
    /**
     * @see https://redis.io/commands/zincrby
     */
    zincrby: <TData>(key: string, increment: number, member: TData) => Promise<number>;
    /**
     * @see https://redis.io/commands/zinterstore
     */
    zinterstore: (destination: string, numKeys: number, keys: string[], opts?: ZInterStoreCommandOptions | undefined) => Promise<number>;
    /**
     * @see https://redis.io/commands/zlexcount
     */
    zlexcount: (key: string, min: string, max: string) => Promise<number>;
    /**
     * @see https://redis.io/commands/zmscore
     */
    zmscore: (key: string, members: unknown[]) => Promise<number[] | null>;
    /**
     * @see https://redis.io/commands/zpopmax
     */
    zpopmax: <TData>(key: string, count?: number | undefined) => Promise<TData[]>;
    /**
     * @see https://redis.io/commands/zpopmin
     */
    zpopmin: <TData>(key: string, count?: number | undefined) => Promise<TData[]>;
    /**
     * @see https://redis.io/commands/zrange
     */
    zrange: <TData extends unknown[]>(...args: [key: string, min: number, max: number, opts?: ZRangeCommandOptions] | [key: string, min: `(${string}` | `[${string}` | "-" | "+", max: `(${string}` | `[${string}` | "-" | "+", opts: {
        byLex: true;
    } & ZRangeCommandOptions] | [key: string, min: number | `(${number}` | "-inf" | "+inf", max: number | `(${number}` | "-inf" | "+inf", opts: {
        byScore: true;
    } & ZRangeCommandOptions]) => Promise<TData>;
    /**
     * @see https://redis.io/commands/zrank
     */
    zrank: <TData>(key: string, member: TData) => Promise<number | null>;
    /**
     * @see https://redis.io/commands/zrem
     */
    zrem: <TData>(key: string, ...members: TData[]) => Promise<number>;
    /**
     * @see https://redis.io/commands/zremrangebylex
     */
    zremrangebylex: (key: string, min: string, max: string) => Promise<number>;
    /**
     * @see https://redis.io/commands/zremrangebyrank
     */
    zremrangebyrank: (key: string, start: number, stop: number) => Promise<number>;
    /**
     * @see https://redis.io/commands/zremrangebyscore
     */
    zremrangebyscore: (key: string, min: number, max: number) => Promise<number>;
    /**
     * @see https://redis.io/commands/zrevrank
     */
    zrevrank: <TData>(key: string, member: TData) => Promise<number | null>;
    /**
     * @see https://redis.io/commands/zscan
     */
    zscan: (key: string, cursor: string | number, opts?: ScanCommandOptions | undefined) => Promise<[string, (string | number)[]]>;
    /**
     * @see https://redis.io/commands/zscore
     */
    zscore: <TData>(key: string, member: TData) => Promise<number | null>;
    /**
     * @see https://redis.io/commands/zunion
     */
    zunion: (numKeys: number, keys: string[], opts?: ZUnionCommandOptions | undefined) => Promise<any>;
    /**
     * @see https://redis.io/commands/zunionstore
     */
    zunionstore: (destination: string, numKeys: number, keys: string[], opts?: ZUnionStoreCommandOptions | undefined) => Promise<number>;
}

type UpstashErrorOptions = Pick<NonNullable<ConstructorParameters<typeof Error>[1]>, "cause">;
/**
 * Result of a bad request to upstash
 */
declare class UpstashError extends Error {
    constructor(message: string, options?: ErrorOptions);
}
declare class UrlError extends Error {
    constructor(url: string);
}
declare class UpstashJSONParseError extends UpstashError {
    constructor(body: string, options?: UpstashErrorOptions);
}

type error_UpstashError = UpstashError;
declare const error_UpstashError: typeof UpstashError;
type error_UpstashJSONParseError = UpstashJSONParseError;
declare const error_UpstashJSONParseError: typeof UpstashJSONParseError;
type error_UrlError = UrlError;
declare const error_UrlError: typeof UrlError;
declare namespace error {
  export { error_UpstashError as UpstashError, error_UpstashJSONParseError as UpstashJSONParseError, error_UrlError as UrlError };
}

/**
 * @see https://redis.io/commands/zdiffstore
 */
declare class ZDiffStoreCommand extends Command<number, number> {
    constructor(cmd: [destination: string, numkeys: number, ...keys: string[]], opts?: CommandOptions<number, number>);
}

/**
 * @see https://redis.io/commands/zmscore
 */
declare class ZMScoreCommand<TData> extends Command<string[] | null, number[] | null> {
    constructor(cmd: [key: string, members: TData[]], opts?: CommandOptions<string[] | null, number[] | null>);
}

export { HPersistCommand as $, AppendCommand as A, BitCountCommand as B, CopyCommand as C, DBSizeCommand as D, EchoCommand as E, FlushAllCommand as F, GeoAddCommand as G, type HttpClientConfig as H, GetCommand as I, GetBitCommand as J, GetDelCommand as K, GetExCommand as L, GetRangeCommand as M, GetSetCommand as N, HDelCommand as O, Pipeline as P, HExistsCommand as Q, type RedisOptions as R, HExpireCommand as S, HExpireAtCommand as T, type UpstashRequest as U, HExpireTimeCommand as V, HTtlCommand as W, HPExpireCommand as X, HPExpireAtCommand as Y, HPExpireTimeCommand as Z, HPTtlCommand as _, type RequesterConfig as a, RenameNXCommand as a$, HGetCommand as a0, HGetAllCommand as a1, HIncrByCommand as a2, HIncrByFloatCommand as a3, HKeysCommand as a4, HLenCommand as a5, HMGetCommand as a6, HMSetCommand as a7, HRandFieldCommand as a8, HScanCommand as a9, JsonStrLenCommand as aA, JsonToggleCommand as aB, JsonTypeCommand as aC, KeysCommand as aD, LIndexCommand as aE, LInsertCommand as aF, LLenCommand as aG, LMoveCommand as aH, LPopCommand as aI, LPushCommand as aJ, LPushXCommand as aK, LRangeCommand as aL, LRemCommand as aM, LSetCommand as aN, LTrimCommand as aO, MGetCommand as aP, MSetCommand as aQ, MSetNXCommand as aR, PersistCommand as aS, PExpireCommand as aT, PExpireAtCommand as aU, PingCommand as aV, PSetEXCommand as aW, PTtlCommand as aX, PublishCommand as aY, RandomKeyCommand as aZ, RenameCommand as a_, HSetCommand as aa, HSetNXCommand as ab, HStrLenCommand as ac, HValsCommand as ad, IncrCommand as ae, IncrByCommand as af, IncrByFloatCommand as ag, JsonArrAppendCommand as ah, JsonArrIndexCommand as ai, JsonArrInsertCommand as aj, JsonArrLenCommand as ak, JsonArrPopCommand as al, JsonArrTrimCommand as am, JsonClearCommand as an, JsonDelCommand as ao, JsonForgetCommand as ap, JsonGetCommand as aq, JsonMergeCommand as ar, JsonMGetCommand as as, JsonNumIncrByCommand as at, JsonNumMultByCommand as au, JsonObjKeysCommand as av, JsonObjLenCommand as aw, JsonRespCommand as ax, JsonSetCommand as ay, JsonStrAppendCommand as az, Redis as b, type ZUnionCommandOptions as b$, RPopCommand as b0, RPushCommand as b1, RPushXCommand as b2, SAddCommand as b3, ScanCommand as b4, type ScanCommandOptions as b5, SCardCommand as b6, ScriptExistsCommand as b7, ScriptFlushCommand as b8, ScriptLoadCommand as b9, UnlinkCommand as bA, XAddCommand as bB, XRangeCommand as bC, type ScoreMember as bD, type ZAddCommandOptions as bE, ZAddCommand as bF, ZCardCommand as bG, ZCountCommand as bH, ZDiffStoreCommand as bI, ZIncrByCommand as bJ, ZInterStoreCommand as bK, type ZInterStoreCommandOptions as bL, ZLexCountCommand as bM, ZMScoreCommand as bN, ZPopMaxCommand as bO, ZPopMinCommand as bP, ZRangeCommand as bQ, type ZRangeCommandOptions as bR, ZRankCommand as bS, ZRemCommand as bT, ZRemRangeByLexCommand as bU, ZRemRangeByRankCommand as bV, ZRemRangeByScoreCommand as bW, ZRevRankCommand as bX, ZScanCommand as bY, ZScoreCommand as bZ, ZUnionCommand as b_, SDiffCommand as ba, SDiffStoreCommand as bb, SetCommand as bc, type SetCommandOptions as bd, SetBitCommand as be, SetExCommand as bf, SetNxCommand as bg, SetRangeCommand as bh, SInterCommand as bi, SInterStoreCommand as bj, SIsMemberCommand as bk, SMembersCommand as bl, SMIsMemberCommand as bm, SMoveCommand as bn, SPopCommand as bo, SRandMemberCommand as bp, SRemCommand as bq, SScanCommand as br, StrLenCommand as bs, SUnionCommand as bt, SUnionStoreCommand as bu, TimeCommand as bv, TouchCommand as bw, TtlCommand as bx, type Type as by, TypeCommand as bz, type UpstashResponse as c, ZUnionStoreCommand as c0, type ZUnionStoreCommandOptions as c1, type Requester as d, error as e, BitOpCommand as f, BitPosCommand as g, DecrCommand as h, DecrByCommand as i, DelCommand as j, EvalROCommand as k, EvalCommand as l, EvalshaROCommand as m, EvalshaCommand as n, ExistsCommand as o, ExpireCommand as p, type ExpireOption as q, ExpireAtCommand as r, FlushDBCommand as s, type GeoAddCommandOptions as t, type GeoMember as u, GeoDistCommand as v, GeoHashCommand as w, GeoPosCommand as x, GeoSearchCommand as y, GeoSearchStoreCommand as z };
