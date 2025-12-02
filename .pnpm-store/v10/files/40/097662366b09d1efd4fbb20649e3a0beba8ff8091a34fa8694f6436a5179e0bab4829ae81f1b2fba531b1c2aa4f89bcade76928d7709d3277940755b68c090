import { H as HttpClientConfig, R as RedisOptions, a as RequesterConfig, b as Redis$1 } from './zmscore-Cq_Bzgy4.mjs';
export { A as AppendCommand, B as BitCountCommand, f as BitOpCommand, g as BitPosCommand, C as CopyCommand, D as DBSizeCommand, i as DecrByCommand, h as DecrCommand, j as DelCommand, E as EchoCommand, l as EvalCommand, k as EvalROCommand, n as EvalshaCommand, m as EvalshaROCommand, o as ExistsCommand, r as ExpireAtCommand, p as ExpireCommand, q as ExpireOption, F as FlushAllCommand, s as FlushDBCommand, G as GeoAddCommand, t as GeoAddCommandOptions, v as GeoDistCommand, w as GeoHashCommand, u as GeoMember, x as GeoPosCommand, y as GeoSearchCommand, z as GeoSearchStoreCommand, J as GetBitCommand, I as GetCommand, K as GetDelCommand, L as GetExCommand, M as GetRangeCommand, N as GetSetCommand, O as HDelCommand, Q as HExistsCommand, T as HExpireAtCommand, S as HExpireCommand, V as HExpireTimeCommand, a1 as HGetAllCommand, a0 as HGetCommand, a2 as HIncrByCommand, a3 as HIncrByFloatCommand, a4 as HKeysCommand, a5 as HLenCommand, a6 as HMGetCommand, a7 as HMSetCommand, Y as HPExpireAtCommand, X as HPExpireCommand, Z as HPExpireTimeCommand, _ as HPTtlCommand, $ as HPersistCommand, a8 as HRandFieldCommand, a9 as HScanCommand, aa as HSetCommand, ab as HSetNXCommand, ac as HStrLenCommand, W as HTtlCommand, ad as HValsCommand, af as IncrByCommand, ag as IncrByFloatCommand, ae as IncrCommand, ah as JsonArrAppendCommand, ai as JsonArrIndexCommand, aj as JsonArrInsertCommand, ak as JsonArrLenCommand, al as JsonArrPopCommand, am as JsonArrTrimCommand, an as JsonClearCommand, ao as JsonDelCommand, ap as JsonForgetCommand, aq as JsonGetCommand, as as JsonMGetCommand, ar as JsonMergeCommand, at as JsonNumIncrByCommand, au as JsonNumMultByCommand, av as JsonObjKeysCommand, aw as JsonObjLenCommand, ax as JsonRespCommand, ay as JsonSetCommand, az as JsonStrAppendCommand, aA as JsonStrLenCommand, aB as JsonToggleCommand, aC as JsonTypeCommand, aD as KeysCommand, aE as LIndexCommand, aF as LInsertCommand, aG as LLenCommand, aH as LMoveCommand, aI as LPopCommand, aJ as LPushCommand, aK as LPushXCommand, aL as LRangeCommand, aM as LRemCommand, aN as LSetCommand, aO as LTrimCommand, aP as MGetCommand, aQ as MSetCommand, aR as MSetNXCommand, aU as PExpireAtCommand, aT as PExpireCommand, aW as PSetEXCommand, aX as PTtlCommand, aS as PersistCommand, aV as PingCommand, P as Pipeline, aY as PublishCommand, b0 as RPopCommand, b1 as RPushCommand, b2 as RPushXCommand, aZ as RandomKeyCommand, a_ as RenameCommand, a$ as RenameNXCommand, d as Requester, b3 as SAddCommand, b6 as SCardCommand, ba as SDiffCommand, bb as SDiffStoreCommand, bi as SInterCommand, bj as SInterStoreCommand, bk as SIsMemberCommand, bm as SMIsMemberCommand, bl as SMembersCommand, bn as SMoveCommand, bo as SPopCommand, bp as SRandMemberCommand, bq as SRemCommand, br as SScanCommand, bt as SUnionCommand, bu as SUnionStoreCommand, b4 as ScanCommand, b5 as ScanCommandOptions, bD as ScoreMember, b7 as ScriptExistsCommand, b8 as ScriptFlushCommand, b9 as ScriptLoadCommand, be as SetBitCommand, bc as SetCommand, bd as SetCommandOptions, bf as SetExCommand, bg as SetNxCommand, bh as SetRangeCommand, bs as StrLenCommand, bv as TimeCommand, bw as TouchCommand, bx as TtlCommand, by as Type, bz as TypeCommand, bA as UnlinkCommand, U as UpstashRequest, c as UpstashResponse, bB as XAddCommand, bC as XRangeCommand, bF as ZAddCommand, bE as ZAddCommandOptions, bG as ZCardCommand, bH as ZCountCommand, bI as ZDiffStoreCommand, bJ as ZIncrByCommand, bK as ZInterStoreCommand, bL as ZInterStoreCommandOptions, bM as ZLexCountCommand, bN as ZMScoreCommand, bO as ZPopMaxCommand, bP as ZPopMinCommand, bQ as ZRangeCommand, bR as ZRangeCommandOptions, bS as ZRankCommand, bT as ZRemCommand, bU as ZRemRangeByLexCommand, bV as ZRemRangeByRankCommand, bW as ZRemRangeByScoreCommand, bX as ZRevRankCommand, bY as ZScanCommand, bZ as ZScoreCommand, b_ as ZUnionCommand, b$ as ZUnionCommandOptions, c0 as ZUnionStoreCommand, c1 as ZUnionStoreCommandOptions, e as errors } from './zmscore-Cq_Bzgy4.mjs';

type Env = {
    UPSTASH_DISABLE_TELEMETRY?: string;
};

/**
 * Connection credentials for upstash redis.
 * Get them from https://console.upstash.com/redis/<uuid>
 */
type RedisConfigCloudflare = {
    /**
     * UPSTASH_REDIS_REST_URL
     */
    url: string | undefined;
    /**
     * UPSTASH_REDIS_REST_TOKEN
     */
    token: string | undefined;
    /**
     * The signal will allow aborting requests on the fly.
     * For more check: https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal
     */
    signal?: HttpClientConfig["signal"];
    keepAlive?: boolean;
    /**
     * When this flag is enabled, any subsequent commands issued by this client are guaranteed to observe the effects of all earlier writes submitted by the same client.
     */
    readYourWrites?: boolean;
} & RedisOptions & RequesterConfig & Env;
/**
 * Serverless redis client for upstash.
 */
declare class Redis extends Redis$1 {
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
    constructor(config: RedisConfigCloudflare, env?: Env);
    static fromEnv(env?: {
        UPSTASH_REDIS_REST_URL: string;
        UPSTASH_REDIS_REST_TOKEN: string;
        UPSTASH_DISABLE_TELEMETRY?: string;
    }, opts?: Omit<RedisConfigCloudflare, "url" | "token">): Redis;
}

export { Redis, type RedisConfigCloudflare };
